// `pnpm prepare:site` — runs before `next build` and `next dev`. Checks the exports in .sources/
// against the contract (a problem fails the build, with its file and line), then turns them
// into what the site serves:
//
//   .sources/<slug>/embed/<fw>/**     → public/<slug>/embed/<fw>/**   the embed apps (§5)
//   manifest + examples.json files    → public/<slug>/code/**         the code panel's files,
//                                       highlighted, one JSON per example + the shared files
//                                       once + the themes' CSS (lib/code.ts)
//   .sources/<slug>/r/*.json          → public/r/*.json + a merged index.json (§7)
//   .sources/ui/r (theme, palettes)   → styles/fragiola/ (the site is painted by Fragiola UI,
//                                       installed the way a consumer installs it)
//
// Everything under public/<slug>/ is generated (marked with public/<slug>/.generated).

import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { bundledLanguages, createHighlighter } from "shiki";
import type { CodeFile, ExampleCode } from "../lib/code.ts";
import type {
    ExamplesConfig,
    RegistryItem,
    SourceFile,
} from "../lib/contract/types.ts";
import { validateAll } from "../lib/contract/validate.ts";
import {
    label,
    ORIGIN_FILE,
    ROOT,
    readJson,
    readProjects,
    SOURCES,
} from "./projects.ts";

/** The project whose registry paints the site. */
const THEME_PROJECT = "ui";
const PUBLIC = join(ROOT, "public");
const STYLES = join(ROOT, "styles", "fragiola");
const GENERATED = ".generated";

const started = performance.now();
const projects = readProjects();
const missing = projects.filter(
    ({ slug }) => !existsSync(join(SOURCES, slug, "project.json")),
);
if (missing.length > 0) {
    console.error(
        `prepare:site — no export for ${missing.map((p) => p.slug).join(", ")} in ${label(SOURCES)}: run \`pnpm sources:sync\` (the projects) or \`pnpm sources:fixtures\` first`,
    );
    process.exit(1);
}

// ─── the contract (§8) ──────────────────────────────────────────────────────
const reads = validateAll(
    projects.map(({ slug }) => ({ slug, dir: join(SOURCES, slug) })),
    label,
);
if (!reads) process.exit(1);

const write = (file: string, content: string) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
};

// ─── public/<slug>: embed apps and code ──────────────────────────────────────
for (const name of existsSync(PUBLIC) ? readdirSync(PUBLIC) : []) {
    if (existsSync(join(PUBLIC, name, GENERATED))) {
        rmSync(join(PUBLIC, name), { recursive: true, force: true });
    }
}

const highlighter = await createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: [],
});

async function highlight(file: SourceFile): Promise<CodeFile> {
    const lang = file.lang in bundledLanguages ? file.lang : "text";
    if (lang !== "text" && !highlighter.getLoadedLanguages().includes(lang)) {
        await highlighter.loadLanguage(lang as keyof typeof bundledLanguages);
    }
    const html = highlighter.codeToHtml(file.content, {
        lang,
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
    });
    const match =
        /^<pre class="([^"]*)" style="([^"]*)"[^>]*><code>([\s\S]*)<\/code><\/pre>$/.exec(
            html,
        );
    if (!match) throw new Error(`unexpected Shiki output for ${file.path}`);
    return {
        path: file.path,
        lang: file.lang,
        code: file.content,
        html: match[3] ?? "",
        pre: { className: match[1] ?? "", style: match[2] ?? "" },
    };
}

let codeFiles = 0;
for (const read of reads) {
    const { slug, dir } = read;
    const out = join(PUBLIC, slug);
    write(join(out, GENERATED), "scripts/prepare-site.ts\n");
    for (const [framework, manifest] of read.manifests) {
        cpSync(join(dir, "embed", framework), join(out, "embed", framework), {
            recursive: true,
        });
        const highlighted = new Map<string, CodeFile>();
        for (const [path, file] of Object.entries(manifest.files)) {
            highlighted.set(
                path,
                await highlight({
                    path,
                    lang: file.lang,
                    content: file.content,
                }),
            );
        }
        codeFiles += highlighted.size;
        const shared: Record<string, CodeFile> = {};
        for (const [path, file] of Object.entries(manifest.files)) {
            const code = highlighted.get(path);
            if (file.shared && code) shared[path] = code;
        }
        write(
            join(out, "code", framework, "shared.json"),
            JSON.stringify(shared),
        );
        for (const example of manifest.examples) {
            const own: ExampleCode["own"] = {};
            for (const path of example.files) {
                const code = highlighted.get(path);
                if (code && !manifest.files[path]?.shared) own[path] = code;
            }
            write(
                join(out, "code", framework, `${example.id}.json`),
                JSON.stringify({
                    files: example.files,
                    own,
                } satisfies ExampleCode),
            );
        }
    }
    const examples = readJson<ExamplesConfig>(join(dir, "examples.json"));
    const themes: Record<string, CodeFile> = {};
    for (const theme of examples.themes) {
        if (theme.file) themes[theme.name] = await highlight(theme.file);
    }
    write(join(out, "code", "themes.json"), JSON.stringify(themes));
}

// ─── registry (§7) ───────────────────────────────────────────────────────────
const registryOut = join(PUBLIC, "r");
rmSync(registryOut, { recursive: true, force: true });
const items: Omit<RegistryItem, "files">[] = [];
for (const read of reads) {
    for (const [name, item] of read.registry) {
        cpSync(
            join(read.dir, "r", `${name}.json`),
            join(registryOut, `${name}.json`),
        );
        const { files: _files, ...summary } = item;
        items.push(summary);
    }
}
write(
    join(registryOut, "index.json"),
    `${JSON.stringify({ name: "fragiola", homepage: "https://fragiola.com", items }, null, 4)}\n`,
);

// ─── the site's theme ────────────────────────────────────────────────────────
// Every item whose files land under styles/ (the theme and the palettes), written under
// styles/fragiola/ with the path they would have in a consumer's app, plus an index.css that
// imports them in order.
const themeRead = reads.find((read) => read.slug === THEME_PROJECT);
if (!themeRead || themeRead.registry.size === 0) {
    console.error(
        `prepare:site — the site's theme comes from the "${THEME_PROJECT}" registry, and there is none`,
    );
    process.exit(1);
}
rmSync(STYLES, { recursive: true, force: true });
const imports: string[] = [];
for (const [name, item] of [...themeRead.registry].sort(([a], [b]) =>
    a.localeCompare(b),
)) {
    for (const entry of item.files ?? []) {
        // "styles/…" (the registry today) or "~/styles/…" (before its namespacing fix)
        const target = entry.target?.match(/^(?:~\/)?styles\/(.+\.css)$/)?.[1];
        if (!target || entry.content === undefined) continue;
        write(
            join(STYLES, target),
            `/* Vendored from ${label(join(themeRead.dir, "r", `${name}.json`))} (${entry.path}) by scripts/prepare-site.ts. Do not edit. */\n${entry.content}`,
        );
        // the theme first: the palettes are written against its @theme
        if (item.type === "registry:theme") imports.unshift(target);
        else imports.push(target);
    }
}
if (!imports.includes("global.css")) {
    console.error(
        `prepare:site — the "${THEME_PROJECT}" registry has no theme (styles/global.css)`,
    );
    process.exit(1);
}
write(
    join(STYLES, "index.css"),
    `${imports.map((target) => `@import "./${target}";`).join("\n")}\n`,
);

// ─── what the site was built from ────────────────────────────────────────────
const originFile = join(SOURCES, ORIGIN_FILE);
write(
    join(PUBLIC, "_sources.json"),
    `${JSON.stringify({
        origin: existsSync(originFile)
            ? readFileSync(originFile, "utf-8").trim()
            : "unknown",
        projects: reads.map((read) => read.slug),
    })}\n`,
);

const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
    `prepare:site — ${reads.map((r) => `${r.slug} (${[...r.manifests.keys()].join(", ")})`).join(", ")} · ${codeFiles} code files · ${items.length} registry items · ${imports.length} theme files · ${seconds}s`,
);
