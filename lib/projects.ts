import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Root } from "fumadocs-core/page-tree";
import { docsIcon } from "@/components/docs-icon";
import { docsHref, exampleHref, siteHref } from "@/lib/contract/links";
import {
    type LandingExample,
    landingExample,
    readFrontmatter,
    scanPage,
} from "@/lib/contract/mdx";
import { DOCS_SPACES } from "@/lib/site-paths";

export { AI_SPACE } from "@/lib/site-paths";

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
    /** project.json's adapters (v1.5), else its frameworks; none for a docs space */
    adapters: string[];
    /** the folder its docs/ is read from: the export, or content/<slug> for a docs space */
    dir: string;
    /** a docs space www writes itself (content/<slug>/): docs only, no landing, no gallery */
    space?: true;
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
                adapters: info.adapters ?? info.frameworks,
                dir,
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

// ─── docs spaces (content/<slug>/) ───────────────────────────────────────────
//
// Docs www writes itself, served at /<slug>/docs/** by the same layout as a project's docs: the
// AI agents space (content/ai/: the agent skills and the MCP server). Docs only: no landing (its
// /<slug>/ goes to the first page), no gallery, no frameworks to choose from. Its docs/ has the
// shape of an export's (§3.1) and passes the same checks (validateDocsSpace, run by
// scripts/prepare-site.ts). Never in getProjects(): the landings, the gallery, the sitemap's
// project pages and the agent index list projects only.

/** The docs spaces' folder: content/ in the repository, whatever the sources. */
export const SPACES = join(ROOT, "content");

let spaces: Project[] | undefined;

export function getSpaces(): Project[] {
    if (spaces && CACHE) return spaces;
    spaces = DOCS_SPACES.map((space) => {
        const dir = join(SPACES, space.slug);
        return {
            contract: 1,
            ...space,
            // one tree key: a space has no framework to choose
            frameworks: ["react"],
            defaultFramework: "react",
            adapters: [],
            dir,
            space: true as const,
            docs: readJson<DocsConfig>(join(dir, "docs", "config.json")),
            examples: { levels: [], themes: [] },
            manifests: new Map(),
        };
    });
    return spaces;
}

/** Every docs the site serves at /<slug>/docs/**: the projects', then the spaces'. */
export function getDocsSpaces(): Project[] {
    return [...getProjects(), ...getSpaces()];
}

export function getDocsSpace(slug: string): Project | undefined {
    return getDocsSpaces().find((project) => project.slug === slug);
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

/** The sidebar section a page is listed in (§3.1: exactly once), for the page's header. */
export function pageSection(
    project: Project,
    path: string,
): { label: string; icon?: string } | undefined {
    const section = project.docs.sections.find((s) =>
        s.pages.some((entry) => "path" in entry && entry.path === path),
    );
    return section && { label: section.label, icon: section.icon };
}

/** A page's frontmatter description: the page footer's next/previous links show it. */
function pageDescription(project: Project, path: string): string | undefined {
    const file = join(project.dir, "docs", `${path}.mdx`);
    const description = readFrontmatter(
        readFileSync(file, "utf-8"),
    )?.description;
    return typeof description === "string" ? description : undefined;
}

/** A config entry's icon (§3.1, v1.4) for a page tree node: none when it names none. */
function iconOf(name: string | undefined) {
    const icon = docsIcon(name);
    return icon === undefined ? {} : { icon };
}

/**
 * The sidebar for one framework: config.json's sections in order, other frameworks' left out.
 * Each section is a folder, so the page's breadcrumb names it (§3.1): `collapsible` folds it,
 * `defaultOpen` opens it on load, and the section of the current page is always open
 * (Fumadocs opens a folder holding the active page). A section that does not fold is always
 * open. A section or page that names an icon (v1.4) carries it as a Lucide element: the icons
 * are client components, so the tree still crosses to the client layout (a client reference).
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
                ...iconOf(section.icon),
                collapsible: section.collapsible ?? false,
                ...(section.collapsible
                    ? { defaultOpen: section.defaultOpen ?? false }
                    : {}),
                children: section.pages.map((entry) => {
                    if (!("path" in entry)) {
                        return {
                            type: "page" as const,
                            name: entry.label,
                            ...iconOf(entry.icon),
                            url: entry.href,
                            external: true,
                        };
                    }
                    const description = pageDescription(project, entry.path);
                    return {
                        type: "page" as const,
                        name: entry.label,
                        ...iconOf(entry.icon),
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
    frameworks: string[];
    defaultFramework: string;
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
        frameworks: project.frameworks,
        defaultFramework: project.defaultFramework,
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

/** A project's slide on the organization's landing ("See it live"): its landing's example. */
export interface FeaturedExample {
    project: ProjectSummary & { title: string; description: string };
    id: string;
    variants: Record<string, ExampleVariant>;
    themes: Pick<
        ThemeSummary,
        "name" | "title" | "description" | "scheme" | "swatch"
    >[];
    /** the landing's `theme`, `framework` and `height` on the tag, when it writes them */
    theme?: string;
    framework?: string;
    height?: number;
    /** the project's landing, and the example in its gallery */
    landing: string;
    gallery: string;
}

/**
 * The example a project's landing features (`docs/index.mdx`, read by lib/contract/mdx.ts): its
 * showcase, else its first `<Example>`. Undefined when the landing has none, or names an example
 * no manifest has: that project gets no slide.
 */
export function featuredExample(project: Project): FeaturedExample | undefined {
    const file = join(project.dir, "docs", "index.mdx");
    if (!existsSync(file)) return undefined;
    const tag = landingExample(scanPage(readFileSync(file, "utf-8")));
    return tag && liveExample(project, tag.id, tag);
}

/** One of a project's examples, in the shape the organization's landing embeds it. */
function liveExample(
    project: Project,
    id: string,
    tag: Pick<LandingExample, "theme" | "framework" | "height"> = {},
): FeaturedExample | undefined {
    const example = getExample(project, id);
    if (!example) return undefined;
    return {
        project: {
            ...projectSummary(project),
            title: project.title,
            description: project.description,
        },
        id,
        variants: example.variants,
        themes: themeSummaries(project).map(
            ({ name, title, description, scheme, swatch }) => ({
                name,
                title,
                description,
                scheme,
                swatch,
            }),
        ),
        ...(tag.theme ? { theme: tag.theme } : {}),
        ...(tag.framework ? { framework: tag.framework } : {}),
        ...(tag.height ? { height: tag.height } : {}),
        landing: `/${project.slug}/`,
        gallery: exampleHref(project.slug, id),
    };
}

/**
 * The examples of Fragiola UI the organization's landing shows under "One class, one palette",
 * in order of preference: `palette-maker` (a hue becomes a new palette class), else `palettes`.
 */
export const PALETTE_EXAMPLES = ["palette-maker", "palettes"] as const;

/** Fragiola UI's palette example for the organization's landing, or undefined: no section. */
export function paletteExample(): FeaturedExample | undefined {
    const ui = getProject("ui");
    if (!ui) return undefined;
    for (const id of PALETTE_EXAMPLES) {
        const example = liveExample(ui, id);
        if (example) return example;
    }
    return undefined;
}

export function featuredExamples(): FeaturedExample[] {
    return getProjects().flatMap((project) => {
        const featured = featuredExample(project);
        return featured ? [featured] : [];
    });
}

/** The pages of a project, for the static params: every `.mdx` path but the landing. */
export function pagePaths(project: Project): string[] {
    const docs = join(project.dir, "docs");
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
