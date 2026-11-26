// The agent index (server only: `prepare:site` writes it). What AI agents read of the site:
// `fragiola mcp` (fragiola/cli) reads /agents/index.json and the Markdown pages, any other agent
// starts from /llms.txt. Built from the same exports as the site, so it never says more than the
// site does.
//
//   /agents/index.json          the index: projects, their kind, packages, pages, examples and
//                               Fragiola UI's components (fragiola/cli docs/agent-index.md, v1)
//   /agents/overview.md         the ecosystem for agents (content/agents/overview.md)
//   /agents/<slug>/<path>.md    each docs page as plain Markdown
//   /llms.txt                   https://llmstxt.org
//
// The contract is fragiola/cli's docs/agent-index.md: a field here is a field there. Pages are
// read only by lib/contract/mdx.ts and links rewritten only by lib/contract/links.ts (rules 2).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { baseDir, basesOf } from "./contract/bases.ts";
import { siteHref } from "./contract/links.ts";
import { lowerPage, readFrontmatter } from "./contract/mdx.ts";
import type {
    DocsConfig,
    Manifest,
    ProjectInfo,
    RegistryItem,
} from "./contract/types.ts";
import { plainText } from "./contract/types.ts";

export const AGENT_INDEX_VERSION = 1;

/** The site's origin: lib/seo.ts's SITE_URL (tests/agents.test.ts keeps them equal). */
export const AGENT_SITE = "https://fragiola.com";

export type ProjectKind = "registry" | "library";

export type ComponentGroup =
    | "component"
    | "atom"
    | "family"
    | "lib"
    | "theme"
    | "palette";

export interface AgentPackage {
    name: string;
    role: "core" | "adapter";
    framework?: string;
}

export interface AgentPage {
    path: string;
    title: string;
    description?: string;
    section: string;
    api: boolean;
    url: string;
    markdown: string;
}

export interface AgentExample {
    id: string;
    title: string;
    description?: string;
    level?: string;
    url: string;
}

export interface AgentComponent {
    name: string;
    type: string;
    group: ComponentGroup;
    title?: string;
    description?: string;
    docs: string | null;
    item: string;
}

export interface AgentProject {
    slug: string;
    title: string;
    description: string;
    kind: ProjectKind;
    packages: AgentPackage[];
    frameworks: string[];
    repository?: string;
    keywords: string[];
    docs: string;
    pages: AgentPage[];
    examples: AgentExample[];
    components: AgentComponent[];
}

export interface AgentIndex {
    version: typeof AGENT_INDEX_VERSION;
    site: string;
    overview: string;
    registry?: {
        namespace: string;
        index: string;
        item: string;
        componentsJson: Record<string, { url: string }>;
        /**
         * v1.8 (CONTRACT.md §7): the primitive libraries the registry is offered on, the default
         * first (its paths are the ones above). Additive: a reader that ignores it gets the
         * default base. Absent when the registry has one base.
         */
        bases?: AgentRegistryBase[];
    };
    projects: AgentProject[];
}

/** One base of the registry (v1.8): its paths, and the components.json entry that selects it. */
export interface AgentRegistryBase {
    name: string;
    title: string;
    default: boolean;
    index: string;
    item: string;
    componentsJson: Record<string, { url: string }>;
}

/** What one export gives the index (an `ExportRead` of lib/contract/validate.ts is one). */
export interface AgentSource {
    slug: string;
    dir: string;
    project?: ProjectInfo;
    manifests: Map<string, Manifest>;
    registry: Map<string, RegistryItem>;
}

/** A generated file: its path under public/ and its content. */
export interface AgentFile {
    path: string;
    content: string;
}

export const OVERVIEW_PATH = "/agents/overview.md";
export const INDEX_PATH = "/agents/index.json";
/** The MCP server's and the agent skills' docs (the AI agents space, lib/site-paths.ts). */
export const MCP_PAGE = "/ai/docs/mcp/";
export const SKILLS_PAGE = "/ai/docs/skills/";

const readJson = <T>(file: string): T =>
    JSON.parse(readFileSync(file, "utf8")) as T;

/** The group of a Fragiola UI item, from its type and where its files land (§7). */
export function componentGroup(item: RegistryItem): ComponentGroup {
    const targets = (item.files ?? []).map((file) => file.target ?? file.path);
    const under = (folder: RegExp) =>
        targets.some((target) => folder.test(target));
    if (item.type === "registry:theme") return "theme";
    if (item.type === "registry:file" && under(/styles\/palettes\//))
        return "palette";
    if (item.type === "registry:lib")
        return under(/components\/families\//) ? "family" : "lib";
    if (under(/(^@ui\/|components\/ui\/)/)) return "component";
    if (under(/components\/atoms\//)) return "atom";
    if (under(/components\/families\//)) return "family";
    return item.type === "registry:file" ? "lib" : "component";
}

/**
 * A library's packages: the `@fragiola/<slug>` ones its examples import (core first), else the
 * convention (`@fragiola/<slug>` and `@fragiola/<slug>-<framework>`).
 */
export function libraryPackages(
    slug: string,
    frameworks: string[],
    manifests: Map<string, Manifest>,
): AgentPackage[] {
    const core = `@fragiola/${slug}`;
    const used = new Set<string>();
    for (const manifest of manifests.values()) {
        for (const example of manifest.examples) {
            for (const name of example.packages) {
                if (name === core || name.startsWith(`${core}-`))
                    used.add(name);
            }
        }
    }
    // the core always; the adapters the examples use, else one per framework
    const adapters = [...used].filter((name) => name !== core);
    const names = [
        core,
        ...(adapters.length > 0
            ? adapters
            : frameworks.map((framework) => `${core}-${framework}`)),
    ];
    return names
        .sort((a, b) => (a === core ? -1 : b === core ? 1 : a.localeCompare(b)))
        .map((name) =>
            name === core
                ? { name, role: "core" as const }
                : {
                      name,
                      role: "adapter" as const,
                      framework: name.slice(core.length + 1),
                  },
        );
}

function absolute(site: string, path: string): string {
    if (path.startsWith("#")) return path;
    return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : `${site}${path}`;
}

/** A page's Markdown: its title and description, then its body with the vocabulary lowered. */
export function pageMarkdown(
    source: string,
    slug: string,
    site: string,
    namespace: string | undefined,
): string {
    const frontmatter = readFrontmatter(source) ?? {};
    const title = String(frontmatter.title ?? "");
    const description =
        typeof frontmatter.description === "string"
            ? plainText(frontmatter.description)
            : undefined;
    const link = (href: string) => absolute(site, siteHref(slug, href));
    const body = lowerPage(source, {
        link,
        element(name, props, children, flow) {
            const text = (key: string) =>
                typeof props[key] === "string" ? (props[key] as string) : "";
            switch (name) {
                case "Example": {
                    const id = text("id");
                    const href = link(`/examples/${id}`);
                    return flow
                        ? `[Example: ${id}](${href})`
                        : `[${id}](${href})`;
                }
                case "InstallCommand":
                    return [
                        "```bash",
                        `npx shadcn@latest add ${namespace ?? "@fragiola"}/${text("item")}`,
                        "```",
                    ].join("\n");
                case "Callout": {
                    const kind = text("type") || "info";
                    const heading = text("title")
                        ? `**${text("title")}** (${kind})`
                        : `**${kind[0]?.toUpperCase()}${kind.slice(1)}**`;
                    return [heading, "", children]
                        .join("\n")
                        .split("\n")
                        .map((line) => (line === "" ? ">" : `> ${line}`))
                        .join("\n");
                }
                case "Tabs":
                case "Steps":
                case "Cards":
                    return children;
                case "Tab":
                    return `**${text("value")}**\n\n${children}`;
                case "Step":
                    return `1. ${children.replace(/\n/g, "\n   ")}`;
                case "Card": {
                    const about = text("description")
                        ? `: ${text("description")}`
                        : "";
                    return `- [${text("title")}](${link(text("href"))})${about}`;
                }
                case "Framework":
                    return `**For ${text("name")}:**\n\n${children}`;
                default:
                    // the landing vocabulary (Hero, Section, Feature, Pills) never reaches a
                    // docs page (the contract checks it); keep its text, if any
                    return children;
            }
        },
    });
    const lead = [`# ${title}`];
    if (description) lead.push("", description);
    return `${lead.join("\n")}\n\n${body}\n`;
}

/** Every docs page of an export, in sidebar order, with its source file. */
function sidebarPages(
    dir: string,
    config: DocsConfig,
): { page: Omit<AgentPage, "url" | "markdown">; file: string }[] {
    const pages: { page: Omit<AgentPage, "url" | "markdown">; file: string }[] =
        [];
    for (const section of config.sections) {
        for (const entry of section.pages) {
            if (!("path" in entry)) continue;
            const file = join(dir, "docs", `${entry.path}.mdx`);
            const frontmatter =
                readFrontmatter(readFileSync(file, "utf8")) ?? {};
            const description =
                typeof frontmatter.description === "string"
                    ? plainText(frontmatter.description)
                    : undefined;
            pages.push({
                file,
                page: {
                    path: entry.path,
                    title: String(frontmatter.title ?? entry.label),
                    ...(description ? { description } : {}),
                    section: section.label,
                    api: /^API\b/.test(section.label),
                },
            });
        }
    }
    return pages;
}

/** The agent index and every file it points to, from the validated exports. */
export function buildAgentFiles(
    sources: AgentSource[],
    options: { site: string; overview: string },
): { index: AgentIndex; files: AgentFile[] } {
    const site = options.site.replace(/\/+$/, "");
    const files: AgentFile[] = [];
    const projects: AgentProject[] = [];
    let registry: AgentIndex["registry"];

    for (const source of sources) {
        const info = source.project;
        if (!info) continue;
        const namespace = info.registry?.namespace;
        const kind: ProjectKind = namespace ? "registry" : "library";
        if (namespace && !registry) {
            const bases = basesOf(info).map((base) => {
                const dir = baseDir(base);
                return {
                    name: base.name,
                    title: base.title,
                    default: base.default === true,
                    index: `/r/${dir}index.json`,
                    item: `/r/${dir}{name}.json`,
                    componentsJson: {
                        [namespace]: { url: `${site}/r/${dir}{name}.json` },
                    },
                };
            });
            registry = {
                namespace,
                index: "/r/index.json",
                item: "/r/{name}.json",
                componentsJson: {
                    [namespace]: { url: `${site}/r/{name}.json` },
                },
                ...(bases.length > 0 ? { bases } : {}),
            };
        }
        const config = readJson<DocsConfig>(
            join(source.dir, "docs", "config.json"),
        );
        const pages: AgentPage[] = [];
        for (const { page, file } of sidebarPages(source.dir, config)) {
            const markdown = `/agents/${source.slug}/${page.path}.md`;
            pages.push({
                ...page,
                url: `/${source.slug}/docs/${page.path}/`,
                markdown,
            });
            files.push({
                path: markdown,
                content: pageMarkdown(
                    readFileSync(file, "utf8"),
                    source.slug,
                    site,
                    namespace,
                ),
            });
        }

        const examples = new Map<string, AgentExample>();
        for (const manifest of source.manifests.values()) {
            for (const example of [...manifest.examples].sort(
                (a, b) => a.order - b.order,
            )) {
                if (examples.has(example.id)) continue;
                examples.set(example.id, {
                    id: example.id,
                    title: example.title,
                    ...(example.description
                        ? { description: example.description }
                        : {}),
                    ...(example.level ? { level: example.level } : {}),
                    url: `/${source.slug}/examples/${example.id}/`,
                });
            }
        }

        const components: AgentComponent[] = [];
        if (kind === "registry") {
            // a component's page ends with its name; an ambiguous name links no page
            const byLeaf = new Map<string, string | null>();
            for (const page of pages) {
                const leaf = page.path.split("/").at(-1) ?? page.path;
                byLeaf.set(leaf, byLeaf.has(leaf) ? null : page.path);
            }
            for (const [name, item] of source.registry) {
                components.push({
                    name,
                    type: item.type,
                    group: componentGroup(item),
                    ...(item.title ? { title: item.title } : {}),
                    ...(item.description
                        ? { description: item.description }
                        : {}),
                    docs: byLeaf.get(name) ?? null,
                    item: `/r/${name}.json`,
                });
            }
        }

        projects.push({
            slug: source.slug,
            title: info.title,
            description: plainText(info.description),
            kind,
            packages:
                kind === "library"
                    ? libraryPackages(
                          source.slug,
                          info.frameworks,
                          source.manifests,
                      )
                    : [],
            frameworks: info.frameworks,
            ...(info.repository ? { repository: info.repository } : {}),
            keywords: info.keywords ?? [],
            docs: `/${source.slug}/docs/`,
            pages,
            examples: [...examples.values()],
            components,
        });
    }

    const index: AgentIndex = {
        version: AGENT_INDEX_VERSION,
        site,
        overview: OVERVIEW_PATH,
        ...(registry ? { registry } : {}),
        projects,
    };
    files.push({
        path: OVERVIEW_PATH,
        content: `${options.overview.trim()}\n`,
    });
    files.push({
        path: INDEX_PATH,
        content: `${JSON.stringify(index, null, 4)}\n`,
    });
    files.push({ path: "/llms.txt", content: llmsTxt(index) });
    return { index, files };
}

/** /llms.txt (https://llmstxt.org): what Fragiola is, the two kinds, then every page. */
export function llmsTxt(index: AgentIndex): string {
    const { site } = index;
    const lines = [
        "# Fragiola",
        "",
        "> Fragiola is an ecosystem of components and libraries for the web. Fragiola UI is source code copied into a project through the shadcn registry; the libraries are headless npm packages (a core and framework adapters).",
        "",
        "Two kinds of components, consumed differently:",
        "",
        `- **Fragiola UI** (source code): \`npx shadcn@latest add ${index.registry?.namespace ?? "@fragiola"}/<name>\` after adding the registry to components.json. The project owns the copied code.`,
        "- **Libraries** (npm packages): install only the adapter for the project's framework (`@fragiola/<x>-react`, `-vue`, `-angular`): it brings the core and re-exports it. They ship behaviour and accessibility, never CSS.",
        "",
        "## For agents",
        "",
        `- [MCP server](${site}${MCP_PAGE}): \`npx fragiola@latest mcp\` gives AI agents every component, page and API below`,
        `- [Agent skills](${site}${SKILLS_PAGE}): \`npx skills add fragiola/skills\` teaches AI agents Fragiola's rules (palettes, composition, the libraries)`,
        `- [Agent index](${site}${INDEX_PATH}): every project, page, example and component as JSON`,
        `- [Overview](${site}${OVERVIEW_PATH}): the ecosystem, written for agents`,
    ];
    for (const project of index.projects) {
        lines.push(
            "",
            `## ${project.title}`,
            "",
            `${project.description} (${project.kind === "registry" ? "source code, shadcn registry" : `npm: ${project.packages.map((pkg) => pkg.name).join(", ")}`})`,
            "",
        );
        for (const page of project.pages) {
            const about = page.description ? `: ${page.description}` : "";
            lines.push(`- [${page.title}](${site}${page.markdown})${about}`);
        }
    }
    return `${lines.join("\n")}\n`;
}

/** The files under `dir`, relative, for tests and checks. */
export function listFiles(dir: string): string[] {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    const walk = (current: string) => {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const full = join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else out.push(relative(dir, full));
        }
    };
    walk(dir);
    return out.sort();
}
