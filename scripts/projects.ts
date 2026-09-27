import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { ProjectEntry } from "../lib/contract/types.ts";

// Shared by the scripts (run with Node's type stripping: erasable syntax only, relative imports
// carry their extension).

export const ROOT = resolve(import.meta.dirname, "..");

/**
 * Where the exports the site is built from live: `.sources/<slug>`. `FRAGIOLA_SOURCES` points
 * the scripts elsewhere (the tests build from a copy with a broken link).
 */
export const SOURCES = process.env.FRAGIOLA_SOURCES
    ? resolve(process.env.FRAGIOLA_SOURCES)
    : join(ROOT, ".sources");

/** Written in SOURCES by the command that filled it: "projects" or "fixtures". */
export const ORIGIN_FILE = ".origin";

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
