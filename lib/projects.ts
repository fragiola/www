import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Root } from "fumadocs-core/page-tree";
import { docsHref, exampleHref, siteHref } from "@/lib/contract/links";
import { readFrontmatter } from "@/lib/contract/mdx";
import type {
    DocsConfig,
    ExamplesConfig,
    Manifest,
    ManifestExample,
    ProjectEntry,
    ProjectInfo,
    RegistryIndex,
} from "@/lib/contract/types";

// Build-time reads of .sources/ (the exports, already checked by scripts/prepare-site.ts), or of
// $FRAGIOLA_SOURCES (.sources-fixtures/ for the tests' build, scripts/build.ts). Server only.
// What reaches the client is the small, serializable shapes at the bottom.

const ROOT = process.cwd();
const SOURCES = resolve(ROOT, process.env.FRAGIOLA_SOURCES ?? ".sources");

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf-8")) as T;
}

export interface Project extends ProjectInfo {
    docs: DocsConfig;
    examples: ExamplesConfig;
    manifests: Map<string, Manifest>;
    repoUrl?: string;
}

// read once per build; in dev every request reads again, so an edited export shows on reload
const CACHE = process.env.NODE_ENV === "production";
let projects: Project[] | undefined;

export function getProjects(): Project[] {
    if (projects && CACHE) return projects;
    projects = readJson<ProjectEntry[]>(join(ROOT, "projects.json")).map(
        (entry) => {
            const dir = join(SOURCES, entry.slug);
            const info = readJson<ProjectInfo>(join(dir, "project.json"));
            return {
                ...info,
                docs: readJson<DocsConfig>(join(dir, "docs", "config.json")),
                examples: readJson<ExamplesConfig>(join(dir, "examples.json")),
                manifests: new Map(
                    info.frameworks.map((framework) => [
                        framework,
                        readJson<Manifest>(
                            join(dir, "embed", framework, "manifest.json"),
                        ),
                    ]),
                ),
                // project.json's repository (v1.1), else the repo projects.json clones
                repoUrl: info.repository ?? entry.repo.replace(/\.git$/, ""),
            };
        },
    );
    return projects;
}

export function getProject(slug: string): Project | undefined {
    return getProjects().find((project) => project.slug === slug);
}

/** The first page of the sidebar: where the project's "Docs" link goes. */
export function firstPageUrl(project: Project): string {
    for (const section of project.docs.sections) {
        for (const entry of section.pages) {
            if ("path" in entry) return docsHref(project.slug, entry.path);
        }
    }
    return `/${project.slug}/`;
}

/** A page's frontmatter description: the page footer's next/previous links show it. */
function pageDescription(slug: string, path: string): string | undefined {
    const file = join(SOURCES, slug, "docs", `${path}.mdx`);
    const description = readFrontmatter(
        readFileSync(file, "utf-8"),
    )?.description;
    return typeof description === "string" ? description : undefined;
}

/**
 * The sidebar for one framework: config.json's sections in order, other frameworks' left out.
 * Each section is a folder, so the page's breadcrumb names it (§3.1): `collapsible` folds it,
 * `defaultOpen` opens it on load, and the section of the current page is always open
 * (Fumadocs opens a folder holding the active page). A section that does not fold is always
 * open.
 */
export function getPageTree(project: Project, framework: string): Root {
    const $id = `${project.slug}:${framework}`;
    return {
        // Fumadocs memoizes the tree by $id: one per framework, or switching keeps the first
        $id,
        name: project.title,
        children: project.docs.sections
            .filter((s) => !s.framework || s.framework === framework)
            .map((section, index) => ({
                $id: `${$id}:${index}`,
                type: "folder" as const,
                name: section.label,
                collapsible: section.collapsible ?? false,
                ...(section.collapsible
                    ? { defaultOpen: section.defaultOpen ?? false }
                    : {}),
                children: section.pages.map((entry) => {
                    if (!("path" in entry)) {
                        return {
                            type: "page" as const,
                            name: entry.label,
                            url: entry.href,
                            external: true,
                        };
                    }
                    const description = pageDescription(
                        project.slug,
                        entry.path,
                    );
                    return {
                        type: "page" as const,
                        name: entry.label,
                        // without the trailing slash: Fumadocs finds the current page (the
                        // breadcrumb, the open section) by comparing it with the pathname, which
                        // it normalizes without one. Next adds it back when it navigates.
                        url: docsHref(project.slug, entry.path).replace(
                            /\/$/,
                            "",
                        ),
                        ...(description ? { description } : {}),
                    };
                }),
            })),
    };
}

// ─── registry (§7) ───────────────────────────────────────────────────────────

let namespaces: Map<string, string> | undefined;

/** Every registry item of the site, with the namespace of the project that exports it. */
export function registryNamespaces(): Map<string, string> {
    if (!namespaces || !CACHE) {
        namespaces = new Map();
        for (const project of getProjects()) {
            const namespace = project.registry?.namespace;
            if (!namespace) continue;
            const dir = join(SOURCES, project.slug, "r");
            const index = readJson<RegistryIndex>(join(dir, "index.json"));
            for (const item of index.items)
                namespaces.set(item.name, namespace);
        }
    }
    return namespaces;
}

export function installCommand(items: string[]): string {
    const ns = registryNamespaces();
    return `npx shadcn@latest add ${items.map((item) => `${ns.get(item) ?? "@fragiola"}/${item}`).join(" ")}`;
}

/** The gallery's setup command (§4): the packages, then the registry items, namespaced. */
export function setupCommand(example: ManifestExample): string {
    const lines: string[] = [];
    if (example.packages.length > 0) {
        lines.push(`npm install ${example.packages.join(" ")}`);
    }
    if (example.registry.length > 0)
        lines.push(installCommand(example.registry));
    return lines.join("\n");
}

// ─── what the client gets ────────────────────────────────────────────────────

export interface ProjectSummary {
    slug: string;
    title: string;
    frameworks: string[];
    defaultFramework: string;
    docsUrl: string;
    repoUrl?: string;
}

export interface ThemeSummary {
    name: string;
    title: string;
    description: string;
    scheme: "light" | "dark";
    swatch: string[];
    hasFile: boolean;
}

/** One framework's take on an example (the ids are shared across frameworks, §5.3). */
export interface ExampleVariant {
    title: string;
    description: string;
    features: string[];
    /** the docs page, as a site URL */
    docs?: string;
    layout: "fill" | "flow";
    height: number;
    setup: string;
}

export interface GalleryExample {
    id: string;
    level: string;
    order: number;
    variants: Record<string, ExampleVariant>;
}

export interface Gallery {
    project: ProjectSummary;
    levels: { id: string; title: string }[];
    themes: ThemeSummary[];
    /** in gallery order: by level (examples.json order), then `order` */
    examples: GalleryExample[];
}

export function projectSummary(project: Project): ProjectSummary {
    return {
        slug: project.slug,
        title: project.title,
        frameworks: project.frameworks,
        defaultFramework: project.defaultFramework,
        docsUrl: firstPageUrl(project),
        ...(project.repoUrl ? { repoUrl: project.repoUrl } : {}),
    };
}

export function themeSummaries(project: Project): ThemeSummary[] {
    return project.examples.themes.map((theme) => ({
        name: theme.name,
        title: theme.title,
        description: theme.description,
        scheme: theme.scheme,
        swatch: theme.swatch,
        hasFile: Boolean(theme.file),
    }));
}

function variantOf(project: Project, example: ManifestExample): ExampleVariant {
    return {
        title: example.title,
        description: example.description,
        features: example.features,
        ...(example.docs ? { docs: siteHref(project.slug, example.docs) } : {}),
        layout: example.layout,
        height: example.height,
        setup: setupCommand(example),
    };
}

/** An example across the project's frameworks, or undefined when no manifest has it. */
export function getExample(
    project: Project,
    id: string,
): GalleryExample | undefined {
    let first: ManifestExample | undefined;
    const variants: Record<string, ExampleVariant> = {};
    // the default framework first: its level and order place the example
    const frameworks = [
        project.defaultFramework,
        ...project.frameworks.filter((f) => f !== project.defaultFramework),
    ];
    for (const framework of frameworks) {
        const example = project.manifests
            .get(framework)
            ?.examples.find((entry) => entry.id === id);
        if (!example) continue;
        first ??= example;
        variants[framework] = variantOf(project, example);
    }
    return first
        ? { id, level: first.level, order: first.order, variants }
        : undefined;
}

export function getGallery(project: Project): Gallery {
    const ids = new Set<string>();
    for (const manifest of project.manifests.values()) {
        for (const example of manifest.examples) ids.add(example.id);
    }
    const levels = project.examples.levels.map((level) => level.id);
    const examples = [...ids]
        .flatMap((id) => {
            const example = getExample(project, id);
            return example ? [example] : [];
        })
        .sort(
            (a, b) =>
                levels.indexOf(a.level) - levels.indexOf(b.level) ||
                a.order - b.order ||
                a.id.localeCompare(b.id),
        );
    return {
        project: projectSummary(project),
        levels: project.examples.levels,
        themes: themeSummaries(project),
        examples,
    };
}

export function firstExampleUrl(project: Project): string | undefined {
    const [first] = getGallery(project).examples;
    return first ? exampleHref(project.slug, first.id) : undefined;
}

/** The pages of a project, for the static params: every `.mdx` path but the landing. */
export function pagePaths(project: Project): string[] {
    const docs = join(SOURCES, project.slug, "docs");
    const walk = (dir: string, prefix: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
            entry.isDirectory()
                ? walk(join(dir, entry.name), `${prefix}${entry.name}/`)
                : entry.name.endsWith(".mdx") &&
                    `${prefix}${entry.name}` !== "index.mdx"
                  ? [`${prefix}${entry.name.replace(/\.mdx$/, "")}`]
                  : [],
        );
    return walk(docs, "");
}
