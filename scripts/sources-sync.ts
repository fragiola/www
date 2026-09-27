// `pnpm sources:sync [--install] [slug…]`
//
// Runs `pnpm site:export --base /<slug> --out .sources/<slug>` inside every
// project of projects.json and checks that what came out follows the "site
// export" contract v0. The export runs in the project's own repo, with its
// own install and lockfile: this repo never installs a project's
// dependencies.
//
// Where a project is read from:
//   - `localPath` from projects.json (the POC: sibling worktrees);
//   - `$FRAGIOLA_PROJECTS_DIR/<slug>` when set (CI: a clone of `repo@ref`).
// `--install` runs `pnpm install --frozen-lockfile` in the project first
// (CI does; a local worktree is already installed).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
    type DocsConfig,
    type ExampleEntry,
    type ProjectInfo,
    ROOT,
    readJson,
    readProjects,
    SOURCES,
} from "./projects.ts";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { install: { type: "boolean", default: false } },
});

// The child pnpm must see its own repo's settings, not this one's: drop the
// npm_*/pnpm_* variables the outer `pnpm sources:sync` exported.
const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(npm|pnpm)_/i.test(key)),
) as NodeJS.ProcessEnv;

function pnpm(cwd: string, args: string[]) {
    execFileSync("pnpm", args, { cwd, stdio: "inherit", env });
}

/** Contract checks the host relies on. Returns the problems found. */
function validate(slug: string, out: string): string[] {
    const problems: string[] = [];
    const info = readJson<ProjectInfo>(join(out, "project.json"));
    if (info.slug !== slug) {
        problems.push(`project.json: slug "${info.slug}", expected "${slug}"`);
    }
    if (!info.frameworks.includes(info.defaultFramework)) {
        problems.push(
            `project.json: defaultFramework "${info.defaultFramework}" is not in frameworks`,
        );
    }
    const config = readJson<DocsConfig>(join(out, "docs", "config.json"));
    for (const section of config.sections) {
        if (section.framework && !info.frameworks.includes(section.framework)) {
            problems.push(
                `config.json: section "${section.label}" names framework "${section.framework}"`,
            );
        }
        for (const page of section.pages) {
            if (!existsSync(join(out, "docs", `${page.path}.mdx`))) {
                problems.push(`config.json: ${page.path}.mdx is missing`);
            }
        }
    }
    for (const framework of info.frameworks) {
        const dir = join(out, "examples", framework);
        for (const file of ["index.html", "manifest.json"]) {
            if (!existsSync(join(dir, file))) {
                problems.push(`examples/${framework}/${file} is missing`);
            }
        }
        if (existsSync(join(dir, "manifest.json"))) {
            const ids = new Set<string>();
            for (const entry of readJson<ExampleEntry[]>(
                join(dir, "manifest.json"),
            )) {
                if (ids.has(entry.id)) {
                    problems.push(
                        `examples/${framework}: duplicate id "${entry.id}"`,
                    );
                }
                ids.add(entry.id);
            }
        }
    }
    return problems;
}

const projects = readProjects().filter(
    (p) => positionals.length === 0 || positionals.includes(p.slug),
);
mkdirSync(SOURCES, { recursive: true });

let failed = false;
for (const project of projects) {
    const dir = process.env.FRAGIOLA_PROJECTS_DIR
        ? resolve(process.env.FRAGIOLA_PROJECTS_DIR, project.slug)
        : resolve(ROOT, project.localPath);
    if (!existsSync(join(dir, "package.json"))) {
        console.error(`✗ ${project.slug}: no repo at ${dir}`);
        failed = true;
        continue;
    }
    const out = join(SOURCES, project.slug);
    console.log(`\n▶ ${project.slug} (${dir})`);
    const started = performance.now();
    if (values.install) pnpm(dir, ["install", "--frozen-lockfile"]);
    pnpm(dir, ["site:export", "--base", `/${project.slug}`, "--out", out]);
    const problems = validate(project.slug, out);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    if (problems.length > 0) {
        failed = true;
        console.error(`✗ ${project.slug}: ${problems.length} problem(s)`);
        for (const problem of problems) console.error(`  ${problem}`);
    } else {
        const frameworks = readdirSync(join(out, "examples")).join(", ");
        console.log(
            `✓ ${project.slug} → .sources/${project.slug} (${frameworks}) in ${seconds}s`,
        );
    }
}
if (failed) process.exit(1);
