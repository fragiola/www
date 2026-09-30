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
// .sources/.origin.json records, per project, the checkout's commit and uncommitted changes as
// they were exported: `pnpm build` refuses an export its checkout has moved away from.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { CONTRACT_REVISION } from "../lib/contract/types.ts";
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

let failed = false;
for (const project of projects) {
    const dir = checkoutOf(project);
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
    const install = values.install || !process.env.FRAGIOLA_PROJECTS_DIR;
    if (install) {
        try {
            execFileSync("pnpm", ["install", "--frozen-lockfile"], {
                cwd: dir,
                stdio: "inherit",
                env: childEnv,
            });
        } catch {
            console.error(
                `✗ ${project.slug}: \`pnpm install --frozen-lockfile\` failed in ${dir} (is its lockfile up to date?)`,
            );
            failed = true;
            continue;
        }
    }
    try {
        execFileSync(
            "pnpm",
            ["site:export", "--base", `/${project.slug}`, "--out", out],
            { cwd: dir, stdio: "inherit", env: childEnv },
        );
    } catch {
        console.error(`✗ ${project.slug}: site:export failed`);
        delete origin.projects[project.slug];
        failed = true;
        continue;
    }
    origin.projects[project.slug] = {
        dir,
        syncedAt: new Date().toISOString(),
        ...checkoutState(dir),
    };
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`✓ ${project.slug} → ${label(out)} in ${seconds}s`);
}
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
