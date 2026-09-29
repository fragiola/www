// `pnpm registry:copy [--check]` — the Fragiola UI components the site itself is built with (the
// header's navigation menu), copied from ui's registry the way a consumer installs them: each
// item of ITEMS and its registryDependencies, from the export in .sources/ui/r, written at its
// `target` with the registry's aliases resolved as a consumer's components.json would:
//
//   @ui/…          → components/ui/…
//   @components/…  → components/…
//   @lib/…         → lib/…
//
// The files are the registry's content, byte for byte: never edit them here (a fix belongs in
// ../ui), re-copy them. The theme and the palettes are not copied: prepare:site vendors them
// into styles/fragiola/ on every build. `--check` writes nothing and fails when a copy differs
// from the registry (after a `pnpm sources:sync` that brought a newer ui).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import type { RegistryItem } from "../lib/contract/types.ts";
import { label, PROJECT_SOURCES, ROOT, readJson } from "./projects.ts";

const ITEMS = ["navigation-menu"];

const ALIASES: [string, string][] = [
    ["@ui/", "components/ui/"],
    ["@components/", "components/"],
    ["@lib/", "lib/"],
];

const { values } = parseArgs({ options: { check: { type: "boolean" } } });
const registry = join(PROJECT_SOURCES, "ui", "r");
if (!existsSync(registry)) {
    console.error(
        `registry:copy — no ${label(registry)}: run \`pnpm sources:sync ui\` first`,
    );
    process.exit(1);
}

function target(path: string): string {
    for (const [alias, dir] of ALIASES) {
        if (path.startsWith(alias)) return dir + path.slice(alias.length);
    }
    throw new Error(`registry:copy — no alias for the target "${path}"`);
}

// ITEMS and their registry dependencies, the theme and the palettes left to prepare:site
const files = new Map<string, string>();
const seen = new Set<string>();
const copied: string[] = [];
const queue = [...ITEMS];
for (let name = queue.shift(); name; name = queue.shift()) {
    if (seen.has(name)) continue;
    seen.add(name);
    const item = readJson<RegistryItem>(join(registry, `${name}.json`));
    if (item.type === "registry:theme" || item.type === "registry:style") {
        continue;
    }
    copied.push(name);
    for (const file of item.files ?? []) {
        if (!file.target || file.content === undefined) {
            throw new Error(
                `registry:copy — ${name}: ${file.path} has no target`,
            );
        }
        files.set(target(file.target), file.content);
    }
    for (const dependency of item.registryDependencies ?? []) {
        queue.push(dependency.replace(/^@[^/]+\//, ""));
    }
}

const stale: string[] = [];
for (const [path, content] of [...files].sort(([a], [b]) =>
    a.localeCompare(b),
)) {
    const file = join(ROOT, path);
    const current = existsSync(file) ? readFileSync(file, "utf-8") : undefined;
    if (current === content) continue;
    if (values.check) {
        stale.push(path);
        continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`registry:copy — ${path}`);
}
if (stale.length > 0) {
    console.error(
        `registry:copy — differs from ${label(registry)}:\n  ${stale.join("\n  ")}\nrun \`pnpm registry:copy\``,
    );
    process.exit(1);
}
console.log(
    `registry:copy — ${files.size} files from ${copied.sort().join(", ")}${values.check ? ", up to date" : ""}`,
);
