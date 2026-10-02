// `pnpm sources:sync [--install] [slug…]`
//
// Runs `pnpm site:export --base /<slug> --out .sources/<slug>` inside every project of
// projects.json, then checks the exports against the site export contract v1 (CONTRACT.md §8).
// The export runs in the project's own repo, with its own install and lockfile: this repo never
// installs a project's dependencies into its own workspace (§1).
//
// Where a project is read from:
//   - `$FRAGIOLA_PROJECTS_DIR/<slug>` when set (CI: a clone of `repo@ref`);
//   - `localPath` from projects.json otherwise (a sibling checkout).
//
// `pnpm install --frozen-lockfile` runs in the project first: always for a `localPath` checkout
// (after a pull or a merge its node_modules may be missing or behind its lockfile), and with
// `--install` for `$FRAGIOLA_PROJECTS_DIR` (CI passes it).
//
// The projects run concurrently, each one's output printed as a block when it is done.
//
// .sources/.origin.json records, per project, the checkout's commit and uncommitted changes as
// they were exported: `pnpm build` refuses an export its checkout has moved away from.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { CONTRACT_REVISION, type ProjectEntry } from "../lib/contract/types.ts";
import { validateAll } from "../lib/contract/validate.ts";
import {
    checkoutOf,
    checkoutState,
    childEnv,
    label,
    type Origin,
    PROJECT_SOURCES,
    readOrigin,
    readProjects,
    writeOrigin,
} from "./projects.ts";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { install: { type: "boolean", default: false } },
});

// always the projects' folder: FRAGIOLA_SOURCES is for building from elsewhere, never a sync
const SOURCES = PROJECT_SOURCES;

const all = readProjects();
const unknown = positionals.filter((slug) => !all.some((p) => p.slug === slug));
if (unknown.length > 0) {
    console.error(`sources:sync — not in projects.json: ${unknown.join(", ")}`);
    process.exit(1);
}
const projects = all.filter(
    (p) => positionals.length === 0 || positionals.includes(p.slug),
);
mkdirSync(SOURCES, { recursive: true });

const previous = readOrigin(SOURCES);
const origin: Origin = {
    origin: "projects",
    projects: previous?.origin === "projects" ? previous.projects : {},
};

interface Step {
    ok: boolean;
    output: string;
}

/** Runs a command in a project's checkout, its output (stdout and stderr, in order) kept. */
function run(dir: string, args: string[]): Promise<Step> {
    return new Promise((resolve) => {
        const child = spawn("pnpm", args, {
            cwd: dir,
            env: childEnv,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const chunks: Buffer[] = [];
        child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
        const output = () => Buffer.concat(chunks).toString();
        child.on("error", (error) =>
            resolve({ ok: false, output: `${output()}${error.message}\n` }),
        );
        child.on("close", (code) =>
            resolve({ ok: code === 0, output: output() }),
        );
    });
}

const install = values.install || !process.env.FRAGIOLA_PROJECTS_DIR;

/**
 * One project: install, export, then its block of output, printed whole so that the projects
 * running side by side never interleave.
 */
async function sync(project: ProjectEntry): Promise<boolean> {
    const dir = checkoutOf(project);
    if (!dir || !existsSync(join(dir, "package.json"))) {
        console.error(
            `✗ ${project.slug}: no repo at ${dir ?? "(no localPath in projects.json)"}`,
        );
        return false;
    }
    const out = join(SOURCES, project.slug);
    const started = performance.now();
    const print = (steps: Step[]) =>
        process.stdout.write(
            `\n▶ ${project.slug} (${dir})\n${steps.map((s) => s.output).join("")}`,
        );
    const steps: Step[] = [];
    if (install) {
        const step = await run(dir, ["install", "--frozen-lockfile"]);
        steps.push(step);
        if (!step.ok) {
            print(steps);
            console.error(
                `✗ ${project.slug}: \`pnpm install --frozen-lockfile\` failed in ${dir} (is its lockfile up to date?)`,
            );
            return false;
        }
    }
    const step = await run(dir, [
        "site:export",
        "--base",
        `/${project.slug}`,
        "--out",
        out,
    ]);
    steps.push(step);
    print(steps);
    if (!step.ok) {
        console.error(`✗ ${project.slug}: site:export failed`);
        delete origin.projects[project.slug];
        return false;
    }
    origin.projects[project.slug] = {
        dir,
        syncedAt: new Date().toISOString(),
        ...checkoutState(dir),
    };
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`✓ ${project.slug} → ${label(out)} in ${seconds}s`);
    return true;
}

// The projects run side by side: each writes only to its own checkout and .sources/<slug>, and
// pnpm's store is safe for concurrent installs. The origin is written once, after all of them.
const failed = (await Promise.all(projects.map(sync))).includes(false);
writeOrigin(SOURCES, origin);
if (failed) process.exit(1);

// Every export, also the ones not synced now: the checks are across exports.
const reads = validateAll(
    all.map(({ slug }) => ({ slug, dir: join(SOURCES, slug) })),
    label,
);
if (!reads) process.exit(1);
console.log(
    `\nsources:sync — ${reads.length} exports valid against contract v${CONTRACT_REVISION}`,
);
