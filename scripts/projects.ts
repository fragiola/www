import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Shared by the scripts (run with Node's type stripping: erasable syntax
// only, relative imports carry their extension) and the site (lib/projects.ts).

export const ROOT = resolve(import.meta.dirname, "..");
export const SOURCES = join(ROOT, ".sources");

/** An entry of projects.json: where a project's repo lives and which ref the site is built from. */
export interface ProjectEntry {
    slug: string;
    repo: string;
    ref: string;
    localPath: string;
}

/** `<out>/project.json` of the "site export" contract v0. */
export interface ProjectInfo {
    slug: string;
    title: string;
    description: string;
    frameworks: string[];
    defaultFramework: string;
}

/** `<out>/docs/config.json`. */
export interface DocsConfig {
    sections: {
        label: string;
        framework?: string;
        pages: { label: string; path: string }[];
    }[];
}

/** An entry of `<out>/examples/<fw>/manifest.json`. */
export interface ExampleEntry {
    id: string;
    title: string;
    description?: string;
    height?: number;
    files: { path: string; lang: string; content: string }[];
}

export function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf-8")) as T;
}

export function readProjects(): ProjectEntry[] {
    return readJson<ProjectEntry[]>(join(ROOT, "projects.json"));
}
