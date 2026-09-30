import { execFileSync, spawnSync } from "node:child_process";
import {
    appendFileSync,
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

// `pnpm build` is `prepare:site && next build` (scripts/build.ts): prepare:site stops it before
// Next compiles anything. Run against copies of the fixtures (FRAGIOLA_SOURCES); prepare:site
// checks before it writes anything, so .sources/ and public/ are left alone.
//
//   - a broken export fails it with the file and the line (the fixtures' build, --fixtures);
//   - the publishing build (no flag) takes the projects' exports only: it refuses an empty
//     folder, the fixtures, a folder no sources:sync wrote, and an export whose checkout has
//     moved on since (a new commit, an uncommitted change).

const ROOT = join(import.meta.dirname, "..");
const SLUGS = ["ui", "dockable"];
let temp: string;
let sources: string;

beforeEach(() => {
    temp = mkdtempSync(join(tmpdir(), "www-build-"));
    sources = join(temp, "sources");
    for (const slug of SLUGS) {
        cpSync(join(ROOT, "fixtures", slug), join(sources, slug), {
            recursive: true,
        });
    }
});
afterEach(() => rmSync(temp, { recursive: true, force: true }));

function prepare(args: string[], env: Record<string, string> = {}) {
    return spawnSync("node", [join(ROOT, "scripts/prepare-site.ts"), ...args], {
        cwd: ROOT,
        env: { ...process.env, FRAGIOLA_SOURCES: sources, ...env },
        encoding: "utf-8",
    });
}

const writeOrigin = (origin: unknown) =>
    writeFileSync(join(sources, ".origin.json"), JSON.stringify(origin));

test("a broken link fails the build, naming the file and the line", () => {
    writeOrigin({ origin: "fixtures", projects: {} });
    const page = join(sources, "dockable/docs/guides/popouts.mdx");
    const line = readFileSync(page, "utf-8").split("\n").length;
    appendFileSync(page, "See [the reference](/docs/api/root#props).\n");
    const run = prepare(["--fixtures"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
        `dockable/docs/guides/popouts.mdx:${line}:5: broken link (markdown) "/docs/api/root#props": /docs/api/root: no such page`,
    );
    expect(run.stderr).toContain(
        "1 problem(s) against the site export contract v1.2",
    );
});

test("the fixtures' build takes the fixtures only", () => {
    writeOrigin({ origin: "projects", projects: {} });
    const run = prepare(["--fixtures"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("does not hold the fixtures");
});

describe("the publishing build takes the projects' exports only", () => {
    test("an empty folder", () => {
        for (const slug of SLUGS)
            rmSync(join(sources, slug), { recursive: true });
        const run = prepare(["--check"]);
        expect(run.status).toBe(1);
        expect(run.stderr).toMatch(
            /not building: .* is empty: run `pnpm sources:sync`/,
        );
    });

    test("the fixtures", () => {
        writeOrigin({ origin: "fixtures", projects: {} });
        const run = prepare(["--check"]);
        expect(run.status).toBe(1);
        expect(run.stderr).toContain(
            "holds the fixtures, not the projects' exports: run `pnpm sources:sync`",
        );
    });

    test("a folder sources:sync did not write", () => {
        const run = prepare(["--check"]);
        expect(run.status).toBe(1);
        expect(run.stderr).toContain("has no .origin.json");
    });

    test("an export older than its checkout", () => {
        // one git checkout per project, as sources:sync records them
        const projects = join(temp, "projects");
        const git = (dir: string, ...args: string[]) =>
            execFileSync("git", args, { cwd: dir, encoding: "utf-8" }).trim();
        const record: Record<string, unknown> = {};
        for (const slug of SLUGS) {
            const dir = join(projects, slug);
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, "README.md"), `${slug}\n`);
            git(dir, "init", "-q");
            git(dir, "add", ".");
            git(
                dir,
                "-c",
                "user.name=t",
                "-c",
                "user.email=t@t",
                "commit",
                "-qm",
                "one",
            );
            record[slug] = {
                dir,
                syncedAt: "2026-01-01T00:00:00.000Z",
                commit: git(dir, "rev-parse", "HEAD"),
                changes: null,
            };
        }
        writeOrigin({ origin: "projects", projects: record });
        const env = { FRAGIOLA_PROJECTS_DIR: projects };

        // as synced: it can be built
        const synced = prepare(["--check"], env);
        expect(synced.stderr).toBe("");
        expect(synced.status).toBe(0);

        // an uncommitted change in dockable
        appendFileSync(join(projects, "dockable", "README.md"), "more\n");
        const changed = prepare(["--check"], env);
        expect(changed.status).toBe(1);
        expect(changed.stderr).toMatch(
            /dockable: \S*projects\/dockable has changed since the export \(2026-01-01/,
        );
        expect(changed.stderr).toContain("run `pnpm sources:sync` dockable");

        // a new commit in ui
        const ui = join(projects, "ui");
        writeFileSync(join(ui, "new.md"), "new\n");
        git(ui, "add", ".");
        git(
            ui,
            "-c",
            "user.name=t",
            "-c",
            "user.email=t@t",
            "commit",
            "-qm",
            "two",
        );
        const moved = prepare(["--check"], env);
        expect(moved.status).toBe(1);
        expect(moved.stderr).toMatch(
            /ui: exported at [0-9a-f]{7}, \S*projects\/ui is at [0-9a-f]{7}/,
        );
    });
});
