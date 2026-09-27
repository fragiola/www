// `pnpm sources:sync [--install] [slug…]`
//
// Runs `pnpm site:export --base /<slug> --out .sources/<slug>` inside every project of
// projects.json, then checks the exports against the site export contract v1 (CONTRACT.md §8).
// The export runs in the project's own repo, with its own install and lockfile: this repo never
// installs a project's dependencies (§1).
//
// Where a project is read from:
//   - `$FRAGIOLA_PROJECTS_DIR/<slug>` when set (CI: a clone of `repo@ref`);
//   - `localPath` from projects.json otherwise (a sibling checkout).
// `--install` runs `pnpm install --frozen-lockfile` in the project first (CI does).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { validateAll } from "../lib/contract/validate.ts";
import {
    childEnv,
    label,
    ORIGIN_FILE,
    ROOT,
    readProjects,
    SOURCES,
} from "./projects.ts";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { install: { type: "boolean", default: false } },
});

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

let failed = false;
for (const project of projects) {
    const dir = process.env.FRAGIOLA_PROJECTS_DIR
        ? resolve(process.env.FRAGIOLA_PROJECTS_DIR, project.slug)
        : project.localPath
          ? resolve(ROOT, project.localPath)
          : undefined;
    if (!dir || !existsSync(join(dir, "package.json"))) {
        console.error(
            `✗ ${project.slug}: no repo at ${dir ?? "(no localPath in projects.json)"}`,
        );
        failed = true;
        continue;
    }
    const out = join(SOURCES, project.slug);
    console.log(`\n▶ ${project.slug} (${dir})`);
    const started = performance.now();
    try {
        if (values.install) {
            execFileSync("pnpm", ["install", "--frozen-lockfile"], {
                cwd: dir,
                stdio: "inherit",
                env: childEnv,
            });
        }
        execFileSync(
            "pnpm",
            ["site:export", "--base", `/${project.slug}`, "--out", out],
            { cwd: dir, stdio: "inherit", env: childEnv },
        );
    } catch {
        console.error(`✗ ${project.slug}: site:export failed`);
        failed = true;
        continue;
    }
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`✓ ${project.slug} → ${label(out)} in ${seconds}s`);
}
if (failed) process.exit(1);

writeFileSync(join(SOURCES, ORIGIN_FILE), "projects\n");
// Every export, also the ones not synced now: the checks are across exports.
const reads = validateAll(
    all.map(({ slug }) => ({ slug, dir: join(SOURCES, slug) })),
    label,
);
if (!reads) process.exit(1);
console.log(
    `\nsources:sync — ${reads.length} exports valid against contract v1`,
);
