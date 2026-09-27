// `pnpm dev` — the site in dev, over the exports in .sources/ (`pnpm sources:sync` first), with
// the projects' checkouts live (`localPath` in projects.json, or $FRAGIOLA_PROJECTS_DIR/<slug>
// as for sources:sync):
//
//   pages     <localPath>/site/docs is mirrored into .sources/<slug>/docs and watched: an edited
//             page shows without a restart (Fumadocs reloads it; a sidebar change on reload),
//             and every change is checked against the contract, problems printed, not fatal
//   examples  a project with a `devUrl` gets `pnpm site:dev --base /<slug> --port <port>`
//             started in its checkout (unless something already answers there), and
//             /<slug>/embed/** proxied to it: the examples hot-reload inside the site
//
// Then prepare:site, and `next dev` behind a small proxy on the site's port (3000, or
// `pnpm dev --port <n>`): /<slug>/embed/** goes to the project's site:dev, everything else to
// Next, websockets included (Vite's and Next's hot reload both go through it; Next's own
// rewrites do not carry a websocket).

import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
    statSync,
    watch,
} from "node:fs";
import {
    createServer,
    request as httpRequest,
    type IncomingMessage,
} from "node:http";
import { connect } from "node:net";
import { dirname, join, resolve } from "node:path";
import type { Duplex } from "node:stream";
import { parseArgs } from "node:util";
import { formatProblem, validateExport } from "../lib/contract/validate.ts";
import { childEnv, label, ROOT, readProjects, SOURCES } from "./projects.ts";

const { values: options } = parseArgs({
    options: { port: { type: "string", default: "3000" } },
});
const PORT = Number(options.port);
/** `next dev` itself, behind the proxy. */
const NEXT_PORT = PORT + 1;

/** Where a project keeps the pages its export copies into docs/ (both projects: site/docs). */
const DOCS_IN_REPO = join("site", "docs");

const children: ChildProcess[] = [];
function stopAll() {
    for (const child of children) child.kill("SIGTERM");
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        stopAll();
        process.exit(0);
    });
}

function prefixed(name: string, child: ChildProcess) {
    for (const stream of [child.stdout, child.stderr]) {
        stream?.on("data", (chunk: Buffer) => {
            for (const line of chunk.toString().split("\n")) {
                if (line.trim()) console.log(`[${name}] ${line}`);
            }
        });
    }
}

function check(slug: string) {
    const read = validateExport(join(SOURCES, slug), slug);
    if (read.problems.length === 0) {
        console.log(`✓ ${slug}: the pages follow the contract`);
        return;
    }
    for (const problem of read.problems) {
        console.error(`✗ ${formatProblem(label(read.dir), problem)}`);
    }
}

/** Mirrors a project's pages into its export, then keeps them in step. */
function mirrorDocs(slug: string, from: string) {
    const to = join(SOURCES, slug, "docs");
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<string>();
    watch(from, { recursive: true }, (_event, file) => {
        if (!file) return;
        pending.add(file.toString());
        clearTimeout(timer);
        timer = setTimeout(() => {
            for (const path of pending) {
                const source = join(from, path);
                const target = join(to, path);
                if (!existsSync(source)) {
                    rmSync(target, { recursive: true, force: true });
                } else if (statSync(source).isFile()) {
                    mkdirSync(dirname(target), { recursive: true });
                    cpSync(source, target);
                }
            }
            console.log(`↻ ${slug}: ${[...pending].join(", ")}`);
            pending.clear();
            check(slug);
        }, 100);
    });
    console.log(`◉ ${slug}: watching ${label(from)}`);
}

async function answers(url: string): Promise<boolean> {
    try {
        await fetch(url, { signal: AbortSignal.timeout(1000) });
        return true;
    } catch {
        return false;
    }
}

const proxy: Record<string, string> = {};
for (const project of readProjects()) {
    if (!existsSync(join(SOURCES, project.slug, "project.json"))) {
        console.error(
            `✗ ${project.slug}: no export in ${label(SOURCES)} — run \`pnpm sources:sync\` (or \`pnpm sources:fixtures\`) first`,
        );
        process.exit(1);
    }
    // the same checkout sources:sync exports from
    const checkout = process.env.FRAGIOLA_PROJECTS_DIR
        ? resolve(process.env.FRAGIOLA_PROJECTS_DIR, project.slug)
        : project.localPath && resolve(ROOT, project.localPath);
    if (!checkout || !existsSync(checkout)) continue;
    const docs = join(checkout, DOCS_IN_REPO);
    if (existsSync(docs) && readdirSync(docs).length > 0) {
        mirrorDocs(project.slug, docs);
    } else {
        console.log(
            `· ${project.slug}: no ${DOCS_IN_REPO} in ${label(checkout)}; page changes need \`pnpm sources:sync ${project.slug}\``,
        );
    }
    if (project.devUrl) {
        const url = new URL(project.devUrl);
        proxy[project.slug] = url.origin;
        if (await answers(url.origin)) {
            console.log(
                `◉ ${project.slug}: embed proxied to ${url.origin} (already running)`,
            );
            continue;
        }
        const child = spawn(
            "pnpm",
            [
                "site:dev",
                "--base",
                `/${project.slug}`,
                "--port",
                url.port || "80",
            ],
            { cwd: checkout, env: childEnv, stdio: ["ignore", "pipe", "pipe"] },
        );
        prefixed(`${project.slug} site:dev`, child);
        children.push(child);
        console.log(
            `◉ ${project.slug}: site:dev on ${url.origin}, embed proxied`,
        );
    }
}

try {
    execFileSync("node", [join(ROOT, "scripts", "prepare-site.ts")], {
        stdio: "inherit",
    });
} catch {
    stopAll();
    process.exit(1);
}

const next = spawn(
    "pnpm",
    [
        "exec",
        "next",
        "dev",
        "--port",
        String(NEXT_PORT),
        "--hostname",
        "localhost",
    ],
    { cwd: ROOT, stdio: "inherit", env: process.env },
);
children.push(next);
next.on("exit", (code) => {
    stopAll();
    process.exit(code ?? 0);
});

// ─── the proxy ───────────────────────────────────────────────────────────────

/** Where a request goes: a project's site:dev for its embed, else Next. */
function targetOf(url: string | undefined): URL {
    const slug = /^\/([^/]+)\/embed\//.exec(url ?? "")?.[1];
    const embed = slug ? proxy[slug] : undefined;
    return new URL(embed ?? `http://localhost:${NEXT_PORT}`);
}

function unavailable(
    response: {
        writeHead: (s: number) => unknown;
        end: (b: string) => unknown;
    },
    target: URL,
) {
    response.writeHead(502);
    response.end(`nothing answers at ${target.origin} yet`);
}

const server = createServer((request, response) => {
    const target = targetOf(request.url);
    const forward = httpRequest(
        {
            host: target.hostname,
            port: target.port,
            method: request.method,
            path: request.url,
            headers: request.headers,
        },
        (upstream) => {
            response.writeHead(upstream.statusCode ?? 502, upstream.headers);
            upstream.pipe(response);
        },
    );
    forward.on("error", () => unavailable(response, target));
    request.pipe(forward);
});

// a websocket (Vite's and Next's hot reload): replay the upgrade request, then pipe both ways
server.on(
    "upgrade",
    (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const target = targetOf(request.url);
        const upstream = connect(Number(target.port), target.hostname, () => {
            const lines = [
                `${request.method} ${request.url} HTTP/${request.httpVersion}`,
            ];
            for (let index = 0; index < request.rawHeaders.length; index += 2) {
                lines.push(
                    `${request.rawHeaders[index]}: ${request.rawHeaders[index + 1]}`,
                );
            }
            upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
            if (head.length > 0) upstream.write(head);
            upstream.pipe(socket);
            socket.pipe(upstream);
        });
        upstream.on("error", () => socket.destroy());
        socket.on("error", () => upstream.destroy());
    },
);

server.listen(PORT, () => {
    console.log(`\n▲ fragiola.com in dev: http://localhost:${PORT}/`);
});
