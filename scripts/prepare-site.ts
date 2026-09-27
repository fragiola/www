// `pnpm prepare:site` — runs before `next build`/`next dev`. Turns the
// project exports in .sources/ into what the site serves and imports:
//
//   .sources/<slug>/examples/**  → public/<slug>/examples/**
//   .sources/<slug>/r/*.json     → public/r/*.json, plus a merged index.json;
//                                  the same item from two projects fails
//   .sources/ui/r (theme, palettes) → styles/fragiola/ (the site's colours
//                                  are Fragiola UI's, installed the way a
//                                  consumer installs them)

import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, readJson, readProjects, SOURCES } from "./projects.ts";

interface RegistryFile {
    path: string;
    target?: string;
    content: string;
}

interface RegistryItem {
    name: string;
    type: string;
    registryDependencies?: string[];
    files?: RegistryFile[];
}

/** The project whose registry paints the site. */
const THEME_PROJECT = "ui";
/** Registry files that describe the registry itself, not an item. */
const REGISTRY_META = new Set(["index.json", "registry.json"]);
const PUBLIC = join(ROOT, "public");
const STYLES = join(ROOT, "styles", "fragiola");

const projects = readProjects();
const missing = projects.filter(
    (p) => !existsSync(join(SOURCES, p.slug, "project.json")),
);
if (missing.length > 0) {
    console.error(
        `prepare:site — no export for ${missing.map((p) => p.slug).join(", ")}: run \`pnpm sources:sync\` first`,
    );
    process.exit(1);
}

// ─── examples ───────────────────────────────────────────────────────────────
for (const { slug } of projects) {
    const from = join(SOURCES, slug, "examples");
    const to = join(PUBLIC, slug, "examples");
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
}

// ─── registry ───────────────────────────────────────────────────────────────
const registryOut = join(PUBLIC, "r");
rmSync(registryOut, { recursive: true, force: true });
mkdirSync(registryOut, { recursive: true });
const owners = new Map<string, string>();
const items: RegistryItem[] = [];
const conflicts: string[] = [];
for (const { slug } of projects) {
    const dir = join(SOURCES, slug, "r");
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir, {
        recursive: true,
        encoding: "utf-8",
    })) {
        if (!file.endsWith(".json") || REGISTRY_META.has(file)) continue;
        const owner = owners.get(file);
        if (owner) {
            conflicts.push(
                `r/${file}: exported by both "${owner}" and "${slug}"`,
            );
            continue;
        }
        owners.set(file, slug);
        mkdirSync(dirname(join(registryOut, file)), { recursive: true });
        cpSync(join(dir, file), join(registryOut, file));
        const item = readJson<RegistryItem>(join(dir, file));
        const { files: _files, ...summary } = item;
        items.push(summary);
    }
}
if (conflicts.length > 0) {
    console.error(`prepare:site — ${conflicts.length} registry conflict(s):`);
    for (const conflict of conflicts) console.error(`  ✗ ${conflict}`);
    process.exit(1);
}
// The shadcn CLI resolves a bare registryDependency ("cn") against ITS
// default registry, not the one the item came from: a dependency on one of
// our items has to be namespaced ("@fragiola/cn"). A warning while the
// exports still ship bare names; to become an error.
const itemNames = new Set(items.map((item) => item.name));
const bare = items.flatMap((item) =>
    (item.registryDependencies ?? [])
        .filter((dep) => itemNames.has(dep))
        .map((dep) => `${item.name} → ${dep}`),
);
if (bare.length > 0) {
    console.warn(
        `prepare:site — warn: ${bare.length} registryDependencies name a @fragiola item without the namespace (shadcn resolves them from its own registry), e.g. ${bare.slice(0, 3).join(", ")}`,
    );
}
writeFileSync(
    join(registryOut, "index.json"),
    `${JSON.stringify({ name: "fragiola", items }, null, 4)}\n`,
);

// ─── theme ──────────────────────────────────────────────────────────────────
// Every item whose files land under ~/styles/ (the theme and the palettes),
// written under styles/fragiola/ with the path they would have in a
// consumer's app, plus an index.css that imports them in order.
const themeRegistry = join(SOURCES, THEME_PROJECT, "r");
rmSync(STYLES, { recursive: true, force: true });
const imports: string[] = [];
for (const file of readdirSync(themeRegistry).sort()) {
    if (REGISTRY_META.has(file) || !file.endsWith(".json")) continue;
    const item = readJson<RegistryItem>(join(themeRegistry, file));
    for (const entry of item.files ?? []) {
        const target = entry.target?.match(/^~\/styles\/(.+\.css)$/)?.[1];
        if (!target) continue;
        const out = join(STYLES, target);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(
            out,
            `/* Vendored from .sources/${THEME_PROJECT}/r/${file} (${entry.path}) by scripts/prepare-site.ts. Do not edit. */\n${entry.content}`,
        );
        // The theme first: the palettes are written against its @theme.
        if (item.type === "registry:theme") imports.unshift(target);
        else imports.push(target);
    }
}
if (!imports.some((target) => target === "global.css")) {
    console.error(
        `prepare:site — .sources/${THEME_PROJECT}/r has no theme (global.css)`,
    );
    process.exit(1);
}
writeFileSync(
    join(STYLES, "index.css"),
    `${imports.map((target) => `@import "./${target}";`).join("\n")}\n`,
);

console.log(
    `prepare:site — examples for ${projects.map((p) => p.slug).join(", ")} · ${items.length} registry items · ${imports.length} theme files`,
);
