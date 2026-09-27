import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Root } from "fumadocs-core/page-tree";
import type {
    DocsConfig,
    ExampleEntry,
    ProjectEntry,
    ProjectInfo,
} from "@/scripts/projects.ts";

// Build-time reads of .sources/ (the project exports). Server only.

const SOURCES = join(process.cwd(), ".sources");

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf-8")) as T;
}

export interface Project extends ProjectInfo {
    docs: DocsConfig;
}

export function getProjects(): Project[] {
    const entries = readJson<ProjectEntry[]>(
        join(process.cwd(), "projects.json"),
    );
    return entries.map(({ slug }) => ({
        ...readJson<ProjectInfo>(join(SOURCES, slug, "project.json")),
        docs: readJson<DocsConfig>(join(SOURCES, slug, "docs", "config.json")),
    }));
}

export function getProject(slug: string): Project | undefined {
    return getProjects().find((project) => project.slug === slug);
}

export function docsUrl(slug: string, path: string): string {
    return `/${slug}/docs/${path}/`;
}

/** The first page of the sidebar: where the project's "Docs" link goes. */
export function firstPageUrl(project: Project): string {
    const first = project.docs.sections[0]?.pages[0];
    return first ? docsUrl(project.slug, first.path) : `/${project.slug}/`;
}

/**
 * The sidebar for one framework: config.json's sections in order, a section
 * that names another framework left out.
 */
export function getPageTree(project: Project, framework: string): Root {
    return {
        name: project.title,
        children: project.docs.sections
            .filter((s) => !s.framework || s.framework === framework)
            .flatMap((section) => [
                { type: "separator" as const, name: section.label },
                ...section.pages.map((page) => ({
                    type: "page" as const,
                    name: page.label,
                    url: docsUrl(project.slug, page.path),
                })),
            ]),
    };
}

const manifests = new Map<string, ExampleEntry[]>();

export function getExample(
    slug: string,
    framework: string,
    id: string,
): ExampleEntry | undefined {
    const key = `${slug}/${framework}`;
    let manifest = manifests.get(key);
    if (!manifest) {
        manifest = readJson<ExampleEntry[]>(
            join(SOURCES, slug, "examples", framework, "manifest.json"),
        );
        manifests.set(key, manifest);
    }
    return manifest.find((entry) => entry.id === id);
}

/** The project's repository page, from projects.json. */
export function readRepoUrl(slug: string): string | undefined {
    const entries = readJson<ProjectEntry[]>(
        join(process.cwd(), "projects.json"),
    );
    return entries
        .find((entry) => entry.slug === slug)
        ?.repo.replace(/\.git$/, "");
}
