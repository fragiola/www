import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { ProjectEntry } from "../lib/contract/types.ts";

// Shared by the scripts (run with Node's type stripping: erasable syntax only, relative imports
// carry their extension).

export const ROOT = resolve(import.meta.dirname, "..");

/** The projects' exports, written by `pnpm sources:sync`: what `pnpm build` publishes. */
export const PROJECT_SOURCES = join(ROOT, ".sources");

/** The fixtures' exports, written by `pnpm sources:fixtures`: what the tests build from. */
export const FIXTURE_SOURCES = join(ROOT, ".sources-fixtures");

/**
 * Where the exports the site is built from live. `FRAGIOLA_SOURCES` points the scripts (and
 * `next build`, lib/projects.ts) elsewhere: `.sources-fixtures` for the tests' build, a broken
 * copy for the build test.
 */
export const SOURCES = process.env.FRAGIOLA_SOURCES
    ? resolve(ROOT, process.env.FRAGIOLA_SOURCES)
    : PROJECT_SOURCES;

/** Written in a sources folder by the command that filled it (`Origin`). */
export const ORIGIN_FILE = ".origin.json";

/** What a sources folder was filled from, and, for the projects, the checkouts' state then. */
export interface Origin {
    origin: "projects" | "fixtures";
    /** per slug: the checkout it was exported from and its state */
    projects: Record<string, CheckoutState & { dir: string; syncedAt: string }>;
}

export interface CheckoutState {
    /** `git rev-parse HEAD`, or null outside git */
    commit: string | null;
    /** a hash of the uncommitted changes (tracked diff + untracked files), or null when clean */
    changes: string | null;
}

export function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf-8")) as T;
}

export function readProjects(): ProjectEntry[] {
    return readJson<ProjectEntry[]>(join(ROOT, "projects.json"));
}

/** A folder as the scripts print it: relative to the repo when inside it. */
export function label(dir: string): string {
    const path = relative(ROOT, dir);
    return path.startsWith("..") ? dir : path;
}

// The child pnpm must see its own repo's settings, not this one's: drop the npm_*/pnpm_*
// variables the outer `pnpm <script>` exported.
export const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(npm|pnpm)_/i.test(key)),
) as NodeJS.ProcessEnv;

/**
 * The checkout a project is exported from: `$FRAGIOLA_PROJECTS_DIR/<slug>` when set (CI: a
 * clone of `repo@ref`), else `localPath` from projects.json (a sibling checkout).
 */
export function checkoutOf(project: ProjectEntry): string | undefined {
    if (process.env.FRAGIOLA_PROJECTS_DIR) {
        return resolve(process.env.FRAGIOLA_PROJECTS_DIR, project.slug);
    }
    return project.localPath ? resolve(ROOT, project.localPath) : undefined;
}

function git(dir: string, args: string[]): string | null {
    try {
        return execFileSync("git", args, {
            cwd: dir,
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
            maxBuffer: 256 * 1024 * 1024,
        });
    } catch {
        return null;
    }
}

/** A checkout's commit and uncommitted changes, to tell later whether an export is stale. */
export function checkoutState(dir: string): CheckoutState {
    const commit = git(dir, ["rev-parse", "HEAD"])?.trim() || null;
    if (!commit) return { commit: null, changes: null };
    const diff = git(dir, ["diff", "HEAD", "--binary"]) ?? "";
    const untracked = (
        git(dir, ["ls-files", "--others", "--exclude-standard", "-z"]) ?? ""
    )
        .split("\0")
        .filter(Boolean)
        .sort();
    if (diff === "" && untracked.length === 0) return { commit, changes: null };
    const hash = createHash("sha256").update(diff);
    for (const file of untracked) {
        hash.update(`\0${file}\0`);
        try {
            hash.update(readFileSync(join(dir, file)));
        } catch {
            // gone since the listing
        }
    }
    return { commit, changes: hash.digest("hex") };
}

export function readOrigin(sources: string): Origin | undefined {
    const file = join(sources, ORIGIN_FILE);
    if (!existsSync(file)) return undefined;
    try {
        const origin = readJson<Origin>(file);
        return origin.origin === "projects" || origin.origin === "fixtures"
            ? origin
            : undefined;
    } catch {
        return undefined;
    }
}

export function writeOrigin(sources: string, origin: Origin) {
    writeFileSync(
        join(sources, ORIGIN_FILE),
        `${JSON.stringify(origin, null, 4)}\n`,
    );
}

/**
 * Why the sources folder cannot be published: empty, filled from the fixtures, or older than a
 * project's checkout. Undefined when every project of projects.json has an export synced from
 * its checkout as it is now. A checkout that is not there (a CI clone already removed) is not
 * held against the export.
 */
export function unpublishable(sources: string): string | undefined {
    const projects = readProjects();
    const sync = "run `pnpm sources:sync`";
    const missing = projects.filter(
        ({ slug }) => !existsSync(join(sources, slug, "project.json")),
    );
    if (missing.length === projects.length) {
        return `${label(sources)} is empty: ${sync} (the projects' exports) first`;
    }
    const origin = readOrigin(sources);
    if (origin?.origin === "fixtures") {
        return `${label(sources)} holds the fixtures, not the projects' exports: ${sync}. The fixtures are for the tests (\`pnpm e2e:build\`, from ${label(FIXTURE_SOURCES)})`;
    }
    if (!origin) {
        return `${label(sources)} has no ${ORIGIN_FILE} (filled by hand, or by an older sources:sync): ${sync}`;
    }
    if (missing.length > 0) {
        return `no export for ${missing.map((p) => p.slug).join(", ")} in ${label(sources)}: ${sync} ${missing.map((p) => p.slug).join(" ")}`;
    }
    const stale: string[] = [];
    for (const project of projects) {
        const synced = origin.projects[project.slug];
        if (!synced) {
            stale.push(`${project.slug}: not synced by sources:sync`);
            continue;
        }
        const dir = checkoutOf(project);
        if (!dir || !existsSync(dir)) continue;
        if (resolve(dir) !== resolve(synced.dir)) {
            stale.push(
                `${project.slug}: exported from ${label(synced.dir)}, the checkout is now ${label(dir)}`,
            );
            continue;
        }
        const now = checkoutState(dir);
        if (now.commit !== synced.commit) {
            stale.push(
                `${project.slug}: exported at ${synced.commit?.slice(0, 7) ?? "?"}, ${label(dir)} is at ${now.commit?.slice(0, 7) ?? "?"}`,
            );
        } else if (now.changes !== synced.changes) {
            stale.push(
                `${project.slug}: ${label(dir)} has changed since the export (${synced.syncedAt})`,
            );
        }
    }
    if (stale.length > 0) {
        return `${label(sources)} is stale:\n  ${stale.join("\n  ")}\n${sync} ${stale.map((line) => line.split(":")[0]).join(" ")}`;
    }
    return undefined;
}
