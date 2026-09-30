// What `www` checks on every build (§8), per export and across exports. Every problem names the
// file and, where there is one, the line, relative to the export's folder; `formatProblem`
// prefixes the folder, so a problem reads `.sources/dockable/docs/guides/tabs.mdx:12:5: …`.
//
//   validateExport(dir, slug)   one export: project.json, config ↔ files, frontmatter,
//                               vocabulary, links, <Example>/<InstallCommand> and manifest
//                               references, levels and themes, registry namespacing, and
//                               v1.2's search and sharing rules (lengths, keywords, the
//                               landing's title, headings, images, noindex embeds)
//   validateSite(exports)       across exports: slugs, registry duplicates, the registry items
//                               the examples name
//
// Node only (reads the file system); run by the scripts before `next build`.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseLink } from "./links.ts";
import { type PageScan, type PropValue, scanPage, type Tag } from "./mdx.ts";
import {
    ACTION_ICONS,
    ACTION_VARIANTS,
    CONTRACT,
    CONTRACT_REVISION,
    type DocsConfig,
    type ExamplesConfig,
    LABEL_TOKEN,
    LIMITS,
    type Manifest,
    type ProjectInfo,
    type RegistryIndex,
    type RegistryItem,
} from "./types.ts";

export interface Problem {
    /** the file, relative to the export's folder */
    file: string;
    line?: number;
    column?: number;
    message: string;
}

/** An export read from disk, with what the cross-export checks need. */
export interface ExportRead {
    slug: string;
    dir: string;
    project?: ProjectInfo;
    manifests: Map<string, Manifest>;
    /** the registry items of r/index.json, by name */
    registry: Map<string, RegistryItem>;
    problems: Problem[];
}

/** Slugs the site uses for itself. */
const RESERVED_SLUGS = new Set(["r", "api", "_next", "docs", "examples"]);

/**
 * The vocabulary (§3.4, v1.1): each component, the props it takes and the ones it needs, and
 * whether it belongs on the landing only.
 */
const VOCABULARY: Record<
    string,
    { props: string[]; required: string[]; landing?: true }
> = {
    Example: {
        props: ["id", "framework", "theme", "height", "variant", "label"],
        required: ["id"],
    },
    Callout: { props: ["type", "title"], required: ["type"] },
    Tabs: { props: ["items"], required: ["items"] },
    Tab: { props: ["value"], required: ["value"] },
    Steps: { props: [], required: [] },
    Step: { props: [], required: [] },
    Cards: { props: [], required: [] },
    Card: {
        props: ["title", "href", "description"],
        required: ["title", "href"],
    },
    InstallCommand: { props: ["item"], required: ["item"] },
    Framework: { props: ["name"], required: ["name"] },
    Hero: {
        props: ["title", "description", "eyebrow", "background", "actions"],
        required: ["title"],
        landing: true,
    },
    Section: {
        props: ["title", "eyebrow", "description"],
        required: ["title"],
        landing: true,
    },
    Features: { props: ["columns", "numbered"], required: [], landing: true },
    Feature: { props: ["title"], required: ["title"], landing: true },
    Pills: { props: ["items", "strike"], required: ["items"], landing: true },
};

const VARIANTS = ["inline", "bleed", "card", "showcase"];
const BACKGROUNDS = ["none", "grid"];
const COLUMNS = [2, 3, 4];
const ACTION_KEYS = ["label", "href", "variant", "icon"];
const CALLOUTS = ["info", "warn", "danger"];
const LAYOUTS = ["fill", "flow"];
const SCHEMES = ["light", "dark"];

// ─── helpers ────────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

const posix = (path: string) => path.split(sep).join("/");

const isString = (value: unknown): value is string =>
    typeof value === "string" && value.length > 0;

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === "string");

const escapeRegExp = (text: string) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A length in characters: Unicode code points, as the contract counts them (v1.2). */
const length = (text: string) => [...text].length;

/** Why a description is not 50–160 characters long, or undefined when it is (§2, §3.2). */
function descriptionLength(text: string): string | undefined {
    const { min, max } = LIMITS.description;
    const n = length(text);
    return n < min || n > max
        ? `description is ${n} characters: ${min}–${max}`
        : undefined;
}

/** A JSON file's text and value, or a problem at the line where it stopped parsing. */
interface JsonFile<T> {
    text: string;
    value: T;
    /** the line of the first `"key": "value"` (or `"key": value`) pair, when found */
    lineOf: (key: string, value?: string | number) => number | undefined;
}

function readJsonFile<T>(
    dir: string,
    file: string,
    problems: Problem[],
): JsonFile<T> | undefined {
    const path = join(dir, file);
    if (!existsSync(path)) {
        problems.push({ file, message: "is missing" });
        return undefined;
    }
    const text = readFileSync(path, "utf-8");
    try {
        const value = JSON.parse(text) as T;
        return {
            text,
            value,
            lineOf(key, value) {
                const pattern =
                    value === undefined
                        ? new RegExp(`"${escapeRegExp(key)}"\\s*:`)
                        : new RegExp(
                              `"${escapeRegExp(key)}"\\s*:\\s*${typeof value === "string" ? `"${escapeRegExp(value)}"` : escapeRegExp(String(value))}`,
                          );
                const match = pattern.exec(text);
                return match
                    ? text.slice(0, match.index).split("\n").length
                    : undefined;
            },
        };
    } catch (error) {
        const position = /position (\d+)/.exec((error as Error).message)?.[1];
        problems.push({
            file,
            line:
                position === undefined
                    ? undefined
                    : text.slice(0, Number(position)).split("\n").length,
            message: `is not valid JSON: ${(error as Error).message}`,
        });
        return undefined;
    }
}

// ─── one export ──────────────────────────────────────────────────────────────

interface Context {
    slug: string;
    dir: string;
    problems: Problem[];
    project: ProjectInfo;
    examples?: ExamplesConfig;
    manifests: Map<string, Manifest>;
    /** every example id, with the frameworks that have it */
    exampleIds: Map<string, string[]>;
    registry: Map<string, RegistryItem>;
    pages: Map<string, PageScan>;
}

function checkProject(
    project: JsonFile<ProjectInfo>,
    slug: string,
    problems: Problem[],
): ProjectInfo | undefined {
    const file = "project.json";
    const info = project.value;
    const at = (key: string) => project.lineOf(key);
    if (info.contract !== CONTRACT) {
        problems.push({
            file,
            line: at("contract"),
            message: `contract ${JSON.stringify(info.contract)}: www implements contract ${CONTRACT} (v${CONTRACT_REVISION})`,
        });
        return undefined;
    }
    if (info.slug !== slug) {
        problems.push({
            file,
            line: at("slug"),
            message: `slug "${info.slug}", but projects.json exports it as "${slug}"`,
        });
    }
    for (const key of ["title", "description"] as const) {
        if (!isString(info[key])) {
            problems.push({
                file,
                line: at(key),
                message: `${key} is required`,
            });
        }
    }
    const tooShortOrLong = isString(info.description)
        ? descriptionLength(info.description)
        : undefined;
    if (tooShortOrLong) {
        problems.push({
            file,
            line: at("description"),
            message: `${tooShortOrLong} (§2)`,
        });
    }
    if (info.keywords !== undefined) checkKeywords(project, problems);
    if (!isStringArray(info.frameworks) || info.frameworks.length === 0) {
        problems.push({
            file,
            line: at("frameworks"),
            message: "frameworks must list at least one framework",
        });
        return undefined;
    }
    if (new Set(info.frameworks).size !== info.frameworks.length) {
        problems.push({
            file,
            line: at("frameworks"),
            message: "frameworks has a duplicate",
        });
    }
    if (!info.frameworks.includes(info.defaultFramework)) {
        problems.push({
            file,
            line: at("defaultFramework"),
            message: `defaultFramework "${info.defaultFramework}" is not in frameworks`,
        });
    }
    if (
        info.repository !== undefined &&
        !(
            typeof info.repository === "string" &&
            /^https:\/\/\S+$/.test(info.repository)
        )
    ) {
        problems.push({
            file,
            line: at("repository"),
            message: `repository must be an https:// URL (got ${JSON.stringify(info.repository)})`,
        });
    }
    if (
        info.registry !== undefined &&
        !/^@[a-z0-9][a-z0-9-]*$/.test(info.registry?.namespace ?? "")
    ) {
        problems.push({
            file,
            line: at("namespace") ?? at("registry"),
            message: `registry.namespace must look like "@name" (got ${JSON.stringify(info.registry?.namespace)})`,
        });
    }
    return info;
}

/** `keywords` (v1.2, §2): 1–8 unique topics, lowercase, at most 40 characters each. */
function checkKeywords(project: JsonFile<ProjectInfo>, problems: Problem[]) {
    const file = "project.json";
    const line = project.lineOf("keywords");
    const { keywords } = project.value;
    const { min, max } = LIMITS.keywords;
    if (
        !Array.isArray(keywords) ||
        keywords.length < min ||
        keywords.length > max
    ) {
        problems.push({
            file,
            line,
            message: `keywords must list ${min}–${max} topics (§2)`,
        });
        return;
    }
    const seen = new Set<string>();
    for (const keyword of keywords as unknown[]) {
        if (!isString(keyword) || keyword.trim() !== keyword) {
            problems.push({
                file,
                line,
                message: `keywords: ${JSON.stringify(keyword)} is not a topic: a non-empty string, no surrounding spaces (§2)`,
            });
            continue;
        }
        const where = `keywords: "${keyword}"`;
        if (keyword !== keyword.toLowerCase()) {
            problems.push({
                file,
                line,
                message: `${where} is not lowercase (§2)`,
            });
        }
        if (length(keyword) > LIMITS.keywords.length) {
            problems.push({
                file,
                line,
                message: `${where} is ${length(keyword)} characters: at most ${LIMITS.keywords.length} (§2)`,
            });
        }
        if (seen.has(keyword)) {
            problems.push({
                file,
                line,
                message: `${where} is listed twice (§2)`,
            });
        }
        seen.add(keyword);
    }
}

function checkExamplesConfig(
    config: JsonFile<ExamplesConfig>,
    problems: Problem[],
): ExamplesConfig | undefined {
    const file = "examples.json";
    const { value } = config;
    if (!Array.isArray(value.levels) || !Array.isArray(value.themes)) {
        problems.push({ file, message: "needs levels and themes arrays" });
        return undefined;
    }
    const levels = new Set<string>();
    for (const level of value.levels) {
        const line = config.lineOf("id", level.id);
        if (!isString(level.id) || !isString(level.title)) {
            problems.push({
                file,
                line,
                message: "a level needs id and title",
            });
        } else if (levels.has(level.id)) {
            problems.push({
                file,
                line,
                message: `duplicate level "${level.id}"`,
            });
        }
        levels.add(level.id);
    }
    const themes = new Set<string>();
    for (const theme of value.themes) {
        const line = config.lineOf("name", theme.name);
        const where = `theme "${theme.name}"`;
        if (!isString(theme.name) || !isString(theme.title)) {
            problems.push({
                file,
                line,
                message: "a theme needs name and title",
            });
            continue;
        }
        if (themes.has(theme.name)) {
            problems.push({ file, line, message: `duplicate ${where}` });
        }
        themes.add(theme.name);
        if (typeof theme.description !== "string") {
            problems.push({
                file,
                line,
                message: `${where} needs a description`,
            });
        }
        if (!SCHEMES.includes(theme.scheme)) {
            problems.push({
                file,
                line,
                message: `${where} has scheme ${JSON.stringify(theme.scheme)} (light or dark)`,
            });
        }
        if (!isStringArray(theme.swatch) || theme.swatch.length === 0) {
            problems.push({
                file,
                line,
                message: `${where} needs a swatch (a list of colours)`,
            });
        }
        if (
            theme.file !== undefined &&
            (!isString(theme.file.path) ||
                !isString(theme.file.lang) ||
                !isString(theme.file.content))
        ) {
            problems.push({
                file,
                line,
                message: `${where}: file needs path, lang and content`,
            });
        }
    }
    for (const scheme of SCHEMES) {
        if (!value.themes.some((theme) => theme.scheme === scheme)) {
            problems.push({
                file,
                message: `no ${scheme} theme: a project with no themes of its own declares one light and one dark (§4)`,
            });
        }
    }
    return value;
}

function checkEmbed(context: Context, framework: string) {
    const { dir, slug, problems } = context;
    const base = `/${slug}/embed/${framework}/`;
    const index = `embed/${framework}/index.html`;
    if (!existsSync(join(dir, index))) {
        problems.push({ file: index, message: "is missing" });
    } else {
        // an absolute asset URL outside the base: the app was built for another base (§5)
        const html = readFileSync(join(dir, index), "utf-8");
        for (const match of html.matchAll(/\b(?:src|href)="(\/[^"]*)"/g)) {
            const url = match[1] ?? "";
            if (!url.startsWith("//") && !url.startsWith(base)) {
                problems.push({
                    file: index,
                    line: html.slice(0, match.index).split("\n").length,
                    message: `"${url}" is outside ${base}: the embed app must be built with base ${base} (§5)`,
                });
                break;
            }
        }
    }
    checkNoindex(context, framework);
    const manifestFile = `embed/${framework}/manifest.json`;
    const manifest = readJsonFile<Manifest>(dir, manifestFile, problems);
    if (!manifest) return;
    const { value } = manifest;
    if (
        typeof value.files !== "object" ||
        value.files === null ||
        !Array.isArray(value.examples)
    ) {
        problems.push({
            file: manifestFile,
            message: "needs a files map and an examples array (§5.3)",
        });
        return;
    }
    for (const [path, file] of Object.entries(value.files)) {
        if (!isString(file?.lang) || typeof file?.content !== "string") {
            problems.push({
                file: manifestFile,
                line: manifest.lineOf(path),
                message: `files["${path}"] needs lang and content`,
            });
        }
    }
    const levels = new Set(context.examples?.levels.map((level) => level.id));
    const ids = new Set<string>();
    for (const example of value.examples) {
        const line = manifest.lineOf("id", example.id);
        const where = `example "${example.id}"`;
        const fail = (message: string, key?: string, keyValue?: string) =>
            problems.push({
                file: manifestFile,
                line:
                    (key && manifest.lineOf(key, keyValue)) ||
                    line ||
                    undefined,
                message: `${where}: ${message}`,
            });
        if (!isString(example.id)) {
            problems.push({
                file: manifestFile,
                message: "an example needs an id",
            });
            continue;
        }
        if (ids.has(example.id)) fail("duplicate id");
        ids.add(example.id);
        context.exampleIds.set(example.id, [
            ...(context.exampleIds.get(example.id) ?? []),
            framework,
        ]);
        if (!isString(example.title)) fail("title is required");
        if (typeof example.description !== "string")
            fail("description is required");
        if (!levels.has(example.level)) {
            fail(
                `level "${example.level}" is not in examples.json`,
                "level",
                example.level,
            );
        }
        if (typeof example.order !== "number") fail("order must be a number");
        if (!isStringArray(example.features)) fail("features must be a list");
        if (!LAYOUTS.includes(example.layout)) {
            fail(`layout ${JSON.stringify(example.layout)} (fill or flow)`);
        }
        if (!(typeof example.height === "number" && example.height > 0)) {
            fail("height must be a positive number");
        }
        if (!isStringArray(example.files) || example.files.length === 0) {
            fail("files must list the entry first");
        } else {
            for (const path of example.files) {
                if (!value.files[path]) {
                    fail(`file "${path}" is not in files`, "files");
                }
            }
        }
        if (!isStringArray(example.registry)) {
            fail("registry must be a list");
        } else {
            for (const item of example.registry) {
                if (item.includes("/") || item.startsWith("@")) {
                    fail(
                        `registry item "${item}" is written without the namespace (§5.3)`,
                    );
                }
            }
        }
        if (!isStringArray(example.packages)) fail("packages must be a list");
        if (example.docs !== undefined && typeof example.docs !== "string") {
            fail("docs must be a base-free link");
        }
    }
    context.manifests.set(framework, value);
}

/** `<meta name="robots" content="noindex">`, whatever the order and quoting of its attributes. */
function isNoindex(tag: string): boolean {
    return (
        /\bname\s*=\s*(["']?)robots\1(?=[\s/>])/i.test(tag) &&
        /\bcontent\s*=\s*(["'])[^"']*\bnoindex\b[^"']*\1/i.test(tag)
    );
}

/** Every HTML file of an embed app is `noindex` (v1.2, §5.1). */
function checkNoindex(context: Context, framework: string) {
    const root = join(context.dir, "embed", framework);
    if (!existsSync(root)) return;
    for (const path of walk(root)) {
        if (!path.endsWith(".html")) continue;
        const html = readFileSync(path, "utf-8");
        if (
            [...html.matchAll(/<meta\b[^>]*>/gi)].some(([tag]) =>
                isNoindex(tag),
            )
        ) {
            continue;
        }
        const head = /<head\b/i.exec(html);
        context.problems.push({
            file: posix(relative(context.dir, path)),
            line: head
                ? html.slice(0, head.index).split("\n").length
                : undefined,
            message:
                'needs <meta name="robots" content="noindex">: an example is not a page for search engines (§5.1)',
        });
    }
}

function checkRegistry(context: Context) {
    const { dir, problems, project } = context;
    const hasDir = existsSync(join(dir, "r"));
    if (!project.registry && !hasDir) return;
    if (!project.registry) {
        problems.push({
            file: "project.json",
            message:
                "r/ is exported but project.json declares no registry.namespace (§7)",
        });
        return;
    }
    if (!hasDir) {
        problems.push({
            file: "r/index.json",
            message: "is missing: project.json declares a registry (§7)",
        });
        return;
    }
    const index = readJsonFile<RegistryIndex>(dir, "r/index.json", problems);
    if (!index) return;
    if (!Array.isArray(index.value.items)) {
        problems.push({
            file: "r/index.json",
            message: "needs an items array",
        });
        return;
    }
    for (const item of index.value.items) {
        const line = index.lineOf("name", item.name);
        if (!isString(item.name)) {
            problems.push({
                file: "r/index.json",
                line,
                message: "an item needs a name",
            });
            continue;
        }
        if (context.registry.has(item.name)) {
            problems.push({
                file: "r/index.json",
                line,
                message: `item "${item.name}" is listed twice`,
            });
        }
        const file = `r/${item.name}.json`;
        const full = readJsonFile<RegistryItem>(dir, file, problems);
        if (!full) continue;
        if (full.value.name !== item.name) {
            problems.push({
                file,
                line: full.lineOf("name"),
                message: `name "${full.value.name}", but r/index.json lists it as "${item.name}"`,
            });
        }
        for (const dependency of full.value.registryDependencies ?? []) {
            if (
                !/^@[a-z0-9][a-z0-9-]*\/[^/\s]+$/.test(dependency) &&
                !/^https?:\/\//.test(dependency)
            ) {
                problems.push({
                    file,
                    line: full.lineOf("registryDependencies"),
                    message: `registryDependencies "${dependency}" is bare: write "${project.registry.namespace}/${dependency}" or a full URL — the shadcn CLI resolves a bare name against its own registry (§7)`,
                });
            }
        }
        context.registry.set(item.name, full.value);
    }
}

function readPages(context: Context) {
    const docs = join(context.dir, "docs");
    for (const path of walk(docs)) {
        const file = posix(relative(docs, path));
        if (!file.endsWith(".mdx")) continue;
        context.pages.set(
            file.replace(/\.mdx$/, ""),
            scanPage(readFileSync(path, "utf-8")),
        );
    }
}

function checkConfig(context: Context, config: JsonFile<DocsConfig>) {
    const { problems, project, pages } = context;
    const file = "docs/config.json";
    if (!Array.isArray(config.value.sections)) {
        problems.push({ file, message: "needs a sections array (§3.1)" });
        return;
    }
    const listed = new Map<string, number>();
    for (const section of config.value.sections) {
        const sectionLine = config.lineOf("label", section.label);
        if (!isString(section.label)) {
            problems.push({
                file,
                line: sectionLine,
                message: "a section needs a label",
            });
        }
        if (
            section.framework !== undefined &&
            !project.frameworks.includes(section.framework)
        ) {
            problems.push({
                file,
                line: config.lineOf("framework", section.framework),
                message: `section "${section.label}": framework "${section.framework}" is not in project.json`,
            });
        }
        for (const key of ["collapsible", "defaultOpen"] as const) {
            if (
                section[key] !== undefined &&
                typeof section[key] !== "boolean"
            ) {
                problems.push({
                    file,
                    line: config.lineOf(key) ?? sectionLine,
                    message: `section "${section.label}": ${key} is true or false (§3.1)`,
                });
            }
        }
        if (section.defaultOpen !== undefined && section.collapsible !== true) {
            problems.push({
                file,
                line: config.lineOf("defaultOpen") ?? sectionLine,
                message: `section "${section.label}": defaultOpen needs collapsible: true (a section that does not fold is always open)`,
            });
        }
        if (!Array.isArray(section.pages)) {
            problems.push({
                file,
                line: sectionLine,
                message: `section "${section.label}" needs a pages array`,
            });
            continue;
        }
        for (const entry of section.pages) {
            if ("path" in entry) {
                const line = config.lineOf("path", entry.path);
                listed.set(entry.path, (listed.get(entry.path) ?? 0) + 1);
                if (entry.path === "index") {
                    problems.push({
                        file,
                        line,
                        message:
                            "index is the landing: it is not listed (§3.1)",
                    });
                } else if (!pages.has(entry.path)) {
                    problems.push({
                        file,
                        line,
                        message: `"${entry.path}": docs/${entry.path}.mdx does not exist`,
                    });
                }
                if (!isString(entry.label)) {
                    problems.push({
                        file,
                        line,
                        message: `"${entry.path}" needs a label`,
                    });
                }
            } else if ("href" in entry) {
                if (
                    !/^https?:\/\//.test(entry.href) ||
                    entry.external !== true
                ) {
                    problems.push({
                        file,
                        line: config.lineOf("href", entry.href),
                        message: `"${entry.label}": an external link needs an absolute URL and external: true`,
                    });
                }
            } else {
                problems.push({
                    file,
                    line: sectionLine,
                    message: `section "${section.label}": an entry needs a path or an href`,
                });
            }
        }
    }
    for (const [path, count] of listed) {
        if (count > 1) {
            problems.push({
                file,
                line: config.lineOf("path", path),
                message: `"${path}" is listed ${count} times: a page appears exactly once`,
            });
        }
    }
    for (const path of pages.keys()) {
        if (path !== "index" && !listed.has(path)) {
            problems.push({
                file: `docs/${path}.mdx`,
                message: "is not listed in docs/config.json (§3.1)",
            });
        }
    }
}

/** Why a base-free link (§3.3) does not resolve, or undefined when it does. */
function brokenLink(
    context: Context,
    href: string,
    from: string,
): string | undefined {
    const target = parseLink(href);
    const anchorOn = (page: string, hash: string | undefined) =>
        hash !== undefined && !context.pages.get(page)?.anchors.has(hash)
            ? `no heading #${hash} on ${page === "index" ? "the landing" : `/docs/${page}`}`
            : undefined;
    switch (target.kind) {
        case "invalid":
            return target.reason;
        case "external":
            return undefined;
        case "anchor":
            return anchorOn(from, target.hash);
        case "landing":
            return anchorOn("index", target.hash);
        case "gallery":
            return context.exampleIds.size === 0
                ? "/examples: the project has no examples"
                : undefined;
        case "example":
            return context.exampleIds.has(target.id)
                ? undefined
                : `/examples/${target.id}: no example "${target.id}"`;
        case "page":
            if (target.path === "index" || !context.pages.has(target.path)) {
                return `/docs/${target.path}: no such page`;
            }
            return anchorOn(target.path, target.hash);
    }
}

function stringOf(prop: PropValue | undefined): string | undefined {
    if (prop?.kind === "string") return prop.value;
    if (prop?.kind === "expression" && typeof prop.value === "string") {
        return prop.value;
    }
    return undefined;
}

function checkTag(context: Context, page: string, tag: Tag) {
    const { problems, project } = context;
    const file = `docs/${page}.mdx`;
    const at = (place: { line: number; column?: number }, message: string) =>
        problems.push({
            file,
            line: place.line,
            column: place.column,
            message,
        });
    const spec = VOCABULARY[tag.name];
    if (!spec) {
        at(
            tag,
            `<${tag.name}> is not in the vocabulary (§3.4): ${Object.keys(VOCABULARY).join(", ")}`,
        );
        return;
    }
    if (spec.landing && page !== "index") {
        at(tag, `<${tag.name}> belongs on the landing only (§3.4)`);
    }
    for (const spread of tag.spreads) {
        at(spread, `<${tag.name}> takes no {...spread} props`);
    }
    for (const [name, prop] of tag.props) {
        if (!spec.props.includes(name)) {
            at(prop, `<${tag.name}> takes no "${name}" prop`);
        } else if (prop.kind === "expression" && !prop.static) {
            at(
                prop,
                `<${tag.name} ${name}={${prop.source}}>: a prop takes a literal value`,
            );
        }
    }
    for (const name of spec.required) {
        if (!tag.props.has(name)) at(tag, `<${tag.name}> needs "${name}"`);
    }
    const prop = (name: string) => tag.props.get(name);
    const string = (name: string) => stringOf(prop(name));
    /** a bare attribute (`numbered`) or {true}/{false} */
    const checkBoolean = (name: string) => {
        const value = prop(name);
        if (
            value &&
            value.kind !== "boolean" &&
            !(value.kind === "expression" && typeof value.value === "boolean")
        ) {
            at(
                value,
                `<${tag.name} ${name}> is a flag: write ${name} (or ${name}={false})`,
            );
        }
    };

    switch (tag.name) {
        case "Example": {
            const id = string("id");
            const framework = string("framework");
            const frameworks = id ? context.exampleIds.get(id) : undefined;
            if (id !== undefined && !frameworks) {
                at(
                    tag,
                    `<Example id="${id}">: no such example in the manifests`,
                );
            }
            if (prop("framework")) {
                if (!framework || !project.frameworks.includes(framework)) {
                    at(
                        prop("framework") ?? tag,
                        `<Example framework="${framework}">: not a framework of project.json`,
                    );
                } else if (frameworks && !frameworks.includes(framework)) {
                    at(
                        tag,
                        `<Example id="${id}" framework="${framework}">: embed/${framework}/manifest.json has no "${id}"`,
                    );
                }
            }
            const theme = prop("theme");
            if (
                theme &&
                !context.examples?.themes.some(
                    (t) => t.name === stringOf(theme),
                )
            ) {
                at(
                    theme,
                    `<Example theme="${stringOf(theme)}">: not in examples.json`,
                );
            }
            const variant = prop("variant");
            if (variant && !VARIANTS.includes(stringOf(variant) ?? "")) {
                at(
                    variant,
                    `<Example variant="${stringOf(variant)}">: inline, bleed, card or showcase`,
                );
            }
            const label = prop("label");
            if (label && string("variant") !== "showcase") {
                at(label, '<Example label> goes with variant="showcase"');
            } else if (label && !isString(stringOf(label))) {
                at(label, "<Example label> takes a string");
            }
            const height = prop("height");
            if (
                height &&
                !(
                    height.kind === "expression" &&
                    typeof height.value === "number" &&
                    height.value > 0
                )
            ) {
                at(
                    height,
                    "<Example height> takes a positive number: height={480}",
                );
            }
            break;
        }
        case "Callout": {
            const type = prop("type");
            if (type && !CALLOUTS.includes(stringOf(type) ?? "")) {
                at(
                    type,
                    `<Callout type="${stringOf(type)}">: info, warn or danger`,
                );
            }
            break;
        }
        case "Tabs": {
            const items = prop("items");
            if (
                items &&
                !(
                    items.kind === "expression" &&
                    isStringArray(items.value) &&
                    items.value.length > 0
                )
            ) {
                at(
                    items,
                    '<Tabs items> takes a list of strings: items={["a", "b"]}',
                );
            }
            break;
        }
        case "InstallCommand": {
            const item = string("item");
            if (item !== undefined && !context.registry.has(item)) {
                at(
                    tag,
                    project.registry
                        ? `<InstallCommand item="${item}">: not in r/index.json`
                        : `<InstallCommand item="${item}">: the project exports no registry (§7)`,
                );
            }
            break;
        }
        case "Framework": {
            const name = string("name");
            if (name !== undefined && !project.frameworks.includes(name)) {
                at(
                    tag,
                    `<Framework name="${name}">: not a framework of project.json`,
                );
            }
            break;
        }
        case "Hero": {
            const background = prop("background");
            if (
                background &&
                !BACKGROUNDS.includes(stringOf(background) ?? "")
            ) {
                at(
                    background,
                    `<Hero background="${stringOf(background)}">: none or grid`,
                );
            }
            const actions = prop("actions");
            if (!actions) break;
            if (
                !(actions.kind === "expression" && Array.isArray(actions.value))
            ) {
                at(
                    actions,
                    "<Hero actions> takes a list of { label, href, variant?, icon? }",
                );
                break;
            }
            for (const [index, value] of actions.value.entries()) {
                const action = (value ?? {}) as Record<string, unknown>;
                const which = `<Hero actions>[${index}]`;
                if (!isString(action.label) || !isString(action.href)) {
                    at(actions, `${which} needs a label and an href`);
                    continue;
                }
                for (const key of Object.keys(action)) {
                    if (!ACTION_KEYS.includes(key)) {
                        at(actions, `${which} takes no "${key}"`);
                    }
                }
                if (
                    action.variant !== undefined &&
                    !(ACTION_VARIANTS as readonly unknown[]).includes(
                        action.variant,
                    )
                ) {
                    at(
                        actions,
                        `${which}: variant ${JSON.stringify(action.variant)} (${ACTION_VARIANTS.join(", ")})`,
                    );
                }
                if (
                    action.icon !== undefined &&
                    !(ACTION_ICONS as readonly unknown[]).includes(action.icon)
                ) {
                    at(
                        actions,
                        `${which}: icon ${JSON.stringify(action.icon)} (${ACTION_ICONS.join(", ")})`,
                    );
                }
                for (const [, token] of action.label.matchAll(LABEL_TOKEN)) {
                    if (token !== "examples") {
                        at(
                            actions,
                            `${which}: "{${token}}" is not a label token (only {examples})`,
                        );
                    } else if (context.exampleIds.size === 0) {
                        at(
                            actions,
                            `${which}: {examples}, but the project has no examples`,
                        );
                    }
                }
            }
            break;
        }
        case "Features": {
            checkBoolean("numbered");
            const columns = prop("columns");
            if (
                columns &&
                !(
                    columns.kind === "expression" &&
                    COLUMNS.includes(columns.value as number)
                )
            ) {
                at(columns, "<Features columns> is {2}, {3} or {4}");
            }
            break;
        }
        case "Feature": {
            if (tag.within !== "Features") {
                at(tag, "<Feature> goes inside <Features>");
            }
            break;
        }
        case "Pills": {
            checkBoolean("strike");
            const items = prop("items");
            if (
                items &&
                !(
                    items.kind === "expression" &&
                    isStringArray(items.value) &&
                    items.value.length > 0 &&
                    items.value.every(isString)
                )
            ) {
                at(
                    items,
                    '<Pills items> takes a list of strings: items={["CSS", "Icons"]}',
                );
            }
            break;
        }
    }
}

/** The frontmatter's lengths, and the landing's title (v1.2, §3.2). */
function checkSearchFields(context: Context, page: string, scan: PageScan) {
    const { problems, project } = context;
    const file = `docs/${page}.mdx`;
    const frontmatter = scan.frontmatter ?? {};
    const place = (key: string) => scan.fields.get(key) ?? { line: 1 };
    const { title, description } = frontmatter;
    if (isString(title) && length(title) > LIMITS.title) {
        problems.push({
            file,
            ...place("title"),
            message: `frontmatter: title is ${length(title)} characters: at most ${LIMITS.title} (§3.2)`,
        });
    }
    const wrong = isString(description)
        ? descriptionLength(description)
        : undefined;
    if (wrong) {
        problems.push({
            file,
            ...place("description"),
            message: `frontmatter: ${wrong} (§3.2)`,
        });
    }
    if (page !== "index" || !isString(title) || !isString(project.title)) {
        return;
    }
    if (!title.includes(project.title)) {
        problems.push({
            file,
            ...place("title"),
            message: `frontmatter: the landing's title "${title}" is its <title>: it contains the project's title "${project.title}" (§3.2)`,
        });
    } else if (title.trim() === project.title) {
        problems.push({
            file,
            ...place("title"),
            message: `frontmatter: the landing's title is its <title>: say what ${project.title} is, not only its name ("${project.title} — …") (§3.2)`,
        });
    }
}

/**
 * The heading level `www` renders for a component (§3.4): `<Hero>` the h1, a `<Section>`'s title
 * an h2, a `<Feature>`'s title one level below its section (h3, or h2 outside one).
 */
function renderedLevel(tag: Tag): number | undefined {
    switch (tag.name) {
        case "Hero":
            return 1;
        case "Section":
            return 2;
        case "Feature":
            return tag.ancestors.includes("Section") ? 3 : 2;
        default:
            return undefined;
    }
}

/** No `#`, no skipped level, one `<Hero>` on the landing, alt text on images (v1.2, §3.4). */
function checkStructure(context: Context, page: string, scan: PageScan) {
    const { problems } = context;
    const file = `docs/${page}.mdx`;
    const landing = page === "index";
    const at = (place: { line: number; column?: number }, message: string) =>
        problems.push({
            file,
            line: place.line,
            column: place.column,
            message,
        });

    const heroes = scan.tags.filter((tag) => tag.name === "Hero");
    if (landing && heroes.length === 0) {
        at(
            { line: 1 },
            "the landing has no <Hero>: its title is the landing's h1 (§3.4)",
        );
    }
    if (landing) {
        for (const hero of heroes.slice(1)) {
            at(
                hero,
                "a second <Hero>: the landing has exactly one, its only h1 (§3.4)",
            );
        }
    }

    // the page's outline as www renders it, in document order; the page starts under its h1
    const outline = [
        ...scan.headings.map((heading) => ({
            order: heading.order,
            level: heading.depth,
            heading,
        })),
        ...scan.tags.flatMap((tag) => {
            const level = renderedLevel(tag);
            return level === undefined
                ? []
                : [{ order: tag.order, level, heading: undefined }];
        }),
    ].sort((a, b) => a.order - b.order);
    let previous = 1;
    for (const { level, heading } of outline) {
        if (heading && level === 1) {
            at(
                heading,
                `a Markdown # heading: the page's h1 is ${landing ? "its <Hero>'s title" : "its frontmatter title"} (§3.4)`,
            );
        } else if (heading && level > previous + 1) {
            at(
                heading,
                `a ${"#".repeat(level)} heading after an h${previous}: headings do not skip a level (§3.4)`,
            );
        }
        previous = level;
    }

    for (const image of scan.images) {
        if (image.alt.trim() === "") {
            at(image, "an image needs alt text: ![what it shows](…) (§3.4)");
        }
    }
}

function checkPages(context: Context) {
    const { problems } = context;
    if (!context.pages.has("index")) {
        problems.push({
            file: "docs/index.mdx",
            message: "is missing: it is the project's landing (§3.5)",
        });
    }
    for (const [page, scan] of context.pages) {
        const file = `docs/${page}.mdx`;
        for (const problem of scan.problems)
            problems.push({ file, ...problem });
        if (!scan.frontmatter) {
            problems.push({
                file,
                line: 1,
                message:
                    "has no frontmatter: title and description are required (§3.2)",
            });
        } else {
            for (const key of ["title", "description"]) {
                if (!isString(scan.frontmatter[key])) {
                    problems.push({
                        file,
                        line: 1,
                        message: `frontmatter: ${key} is required (§3.2)`,
                    });
                }
            }
            checkSearchFields(context, page, scan);
            const layout = scan.frontmatter.layout;
            if (page === "index" && layout !== "landing") {
                problems.push({
                    file,
                    line: 1,
                    message:
                        'frontmatter: the landing takes layout: "landing" (§3.5)',
                });
            } else if (page !== "index" && layout !== undefined) {
                problems.push({
                    file,
                    line: 1,
                    message:
                        "frontmatter: only the landing (index.mdx) takes a layout",
                });
            }
        }
        for (const fence of scan.fences) {
            if (!fence.lang) {
                problems.push({
                    file,
                    line: fence.line,
                    message: "a code block needs a language (§3.4)",
                });
            } else if (
                fence.meta &&
                !/^title="[^"]*"$/.test(fence.meta.trim())
            ) {
                problems.push({
                    file,
                    line: fence.line,
                    message: `a code block takes only title="…" after its language (got "${fence.meta}")`,
                });
            }
        }
        for (const tag of scan.tags) checkTag(context, page, tag);
        checkStructure(context, page, scan);
        for (const link of scan.links) {
            const broken = brokenLink(context, link.href, page);
            if (broken) {
                problems.push({
                    file,
                    line: link.line,
                    column: link.column,
                    message: `broken link (${link.via}) "${link.href}": ${broken}`,
                });
            }
        }
    }
    // the manifests' docs links (§5.3)
    for (const [framework, manifest] of context.manifests) {
        for (const example of manifest.examples) {
            if (typeof example.docs !== "string") continue;
            const broken = brokenLink(context, example.docs, "index");
            if (broken) {
                problems.push({
                    file: `embed/${framework}/manifest.json`,
                    message: `example "${example.id}": broken docs link "${example.docs}": ${broken}`,
                });
            }
        }
    }
}

/** Reads and checks one export. `slug` is its entry in projects.json. */
export function validateExport(dir: string, slug: string): ExportRead {
    const problems: Problem[] = [];
    const read: ExportRead = {
        slug,
        dir,
        manifests: new Map(),
        registry: new Map(),
        problems,
    };
    if (!existsSync(dir)) {
        problems.push({ file: ".", message: "the export does not exist" });
        return read;
    }
    const projectFile = readJsonFile<ProjectInfo>(
        dir,
        "project.json",
        problems,
    );
    const project = projectFile && checkProject(projectFile, slug, problems);
    if (!project) return read;
    read.project = project;

    const context: Context = {
        slug,
        dir,
        problems,
        project,
        manifests: read.manifests,
        exampleIds: new Map(),
        registry: read.registry,
        pages: new Map(),
    };
    const examplesFile = readJsonFile<ExamplesConfig>(
        dir,
        "examples.json",
        problems,
    );
    if (examplesFile) {
        context.examples = checkExamplesConfig(examplesFile, problems);
    }
    for (const framework of project.frameworks) checkEmbed(context, framework);
    if (existsSync(join(dir, "embed"))) {
        for (const name of readdirSync(join(dir, "embed"))) {
            if (!project.frameworks.includes(name)) {
                problems.push({
                    file: `embed/${name}`,
                    message: `"${name}" is not in project.json frameworks`,
                });
            }
        }
    }
    checkRegistry(context);

    if (!existsSync(join(dir, "docs"))) {
        problems.push({ file: "docs", message: "is missing" });
        return read;
    }
    readPages(context);
    const config = readJsonFile<DocsConfig>(dir, "docs/config.json", problems);
    if (config) checkConfig(context, config);
    checkPages(context);
    return read;
}

// ─── across exports ──────────────────────────────────────────────────────────

/** A cross-export problem, with the export whose file it is in. */
export interface SiteProblem extends Problem {
    slug: string;
}

/** The checks that need every export: slugs, registry duplicates, the items examples name. */
export function validateSite(exports: ExportRead[]): SiteProblem[] {
    const problems: SiteProblem[] = [];
    const owners = new Map<string, ExportRead>();
    for (const read of exports) {
        if (RESERVED_SLUGS.has(read.slug)) {
            problems.push({
                slug: read.slug,
                file: "project.json",
                message: `slug "${read.slug}" is reserved by the site`,
            });
        }
        for (const name of read.registry.keys()) {
            const owner = owners.get(name);
            if (owner) {
                problems.push({
                    slug: read.slug,
                    file: `r/${name}.json`,
                    message: `registry item "${name}" is exported by both "${owner.slug}" and "${read.slug}": /r is shared by every project (§7)`,
                });
            } else {
                owners.set(name, read);
            }
        }
    }
    const namespaces = new Set(
        exports.flatMap((read) =>
            read.project?.registry ? [read.project.registry.namespace] : [],
        ),
    );
    for (const read of exports) {
        // an example's registry items come from any project's registry (dockable's from ui's)
        for (const [framework, manifest] of read.manifests) {
            for (const example of manifest.examples) {
                for (const item of example.registry ?? []) {
                    if (!owners.has(item)) {
                        problems.push({
                            slug: read.slug,
                            file: `embed/${framework}/manifest.json`,
                            message: `example "${example.id}": registry item "${item}" is in no project's r/`,
                        });
                    }
                }
            }
        }
        // a dependency in one of the site's namespaces must exist on the site
        for (const [name, item] of read.registry) {
            for (const dependency of item.registryDependencies ?? []) {
                const match = /^(@[^/]+)\/(.+)$/.exec(dependency);
                if (
                    match?.[1] &&
                    namespaces.has(match[1]) &&
                    !owners.has(match[2] ?? "")
                ) {
                    problems.push({
                        slug: read.slug,
                        file: `r/${name}.json`,
                        message: `registryDependencies "${dependency}": no project exports "${match[2]}"`,
                    });
                }
            }
        }
    }
    return problems;
}

/** One problem as a line: `<dir>/<file>:<line>:<column>: <message>`. */
export function formatProblem(dir: string, problem: Problem): string {
    const place =
        problem.line === undefined
            ? ""
            : `:${problem.line}${problem.column === undefined ? "" : `:${problem.column}`}`;
    const file = problem.file === "." ? dir : `${dir}/${problem.file}`;
    return `${file}${place}: ${problem.message}`;
}

/**
 * Validates every export and prints the problems. Returns the reads, or undefined when any
 * export has a problem. `label(dir)` is how a folder is shown (relative to the cwd).
 */
export function validateAll(
    exports: { slug: string; dir: string }[],
    label: (dir: string) => string,
): ExportRead[] | undefined {
    const reads = exports.map(({ slug, dir }) => validateExport(dir, slug));
    const site = validateSite(reads);
    const lines: string[] = [];
    for (const read of reads) {
        for (const problem of read.problems) {
            lines.push(formatProblem(label(read.dir), problem));
        }
    }
    for (const problem of site) {
        const owner = reads.find((read) => read.slug === problem.slug);
        lines.push(
            formatProblem(owner ? label(owner.dir) : problem.slug, problem),
        );
    }
    if (lines.length === 0) return reads;
    for (const line of lines) console.error(`✗ ${line}`);
    console.error(
        `\n${lines.length} problem(s) against the site export contract v${CONTRACT_REVISION} (CONTRACT.md §8)`,
    );
    return undefined;
}
