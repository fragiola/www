import {
    cpSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
    AGENT_SITE,
    buildAgentFiles,
    componentGroup,
    libraryPackages,
    pageMarkdown,
} from "../lib/agents.ts";
import type { DocsConfig, Manifest } from "../lib/contract/types.ts";
import { validateExport } from "../lib/contract/validate.ts";
import { SITE_URL } from "../lib/seo.ts";

// The agent index (lib/agents.ts) built from the fixtures: its shape is fragiola/cli's
// docs/agent-index.md v1 (https://github.com/fragiola/cli/blob/main/docs/agent-index.md), copied
// below as `checkIndex`, which `fragiola mcp` parses with zod. A change to one is a change to both.

const ROOT = join(import.meta.dirname, "..");
const FIXTURES = join(ROOT, "fixtures");
const SLUGS = (
    JSON.parse(readFileSync(join(ROOT, "projects.json"), "utf-8")) as {
        slug: string;
    }[]
).map((project) => project.slug);
const OVERVIEW = readFileSync(
    join(ROOT, "content", "agents", "overview.md"),
    "utf8",
);

const build = (root = FIXTURES) =>
    buildAgentFiles(
        SLUGS.map((slug) => validateExport(join(root, slug), slug)),
        { site: AGENT_SITE, overview: OVERVIEW },
    );

/** The v1 contract, field by field (required, types, enums). Returns the problems. */
function checkIndex(index: unknown): string[] {
    const problems: string[] = [];
    const is = (value: unknown, type: string, where: string) => {
        const ok =
            type === "array" ? Array.isArray(value) : typeof value === type;
        if (!ok) problems.push(`${where}: expected ${type}`);
        return ok;
    };
    const root = index as Record<string, unknown>;
    if (root.version !== 1) problems.push("version: expected 1");
    is(root.site, "string", "site");
    is(root.overview, "string", "overview");
    if (root.registry !== undefined) {
        const registry = root.registry as Record<string, unknown>;
        for (const key of ["namespace", "index", "item"]) {
            is(registry[key], "string", `registry.${key}`);
        }
        if (!String(registry.item).includes("{name}")) {
            problems.push("registry.item: no {name}");
        }
        is(registry.componentsJson, "object", "registry.componentsJson");
    }
    if (!is(root.projects, "array", "projects")) return problems;
    for (const [i, raw] of (
        root.projects as Record<string, unknown>[]
    ).entries()) {
        const at = `projects[${i}]`;
        for (const key of ["slug", "title", "description", "docs"]) {
            is(raw[key], "string", `${at}.${key}`);
        }
        if (raw.kind !== "registry" && raw.kind !== "library") {
            problems.push(`${at}.kind: ${String(raw.kind)}`);
        }
        for (const key of [
            "packages",
            "frameworks",
            "keywords",
            "pages",
            "examples",
            "components",
        ]) {
            is(raw[key], "array", `${at}.${key}`);
        }
        for (const pkg of (raw.packages ?? []) as Record<string, unknown>[]) {
            is(pkg.name, "string", `${at}.packages.name`);
            if (pkg.role !== "core" && pkg.role !== "adapter") {
                problems.push(`${at}.packages.role: ${String(pkg.role)}`);
            }
        }
        for (const page of (raw.pages ?? []) as Record<string, unknown>[]) {
            for (const key of ["path", "title", "section", "url", "markdown"]) {
                is(page[key], "string", `${at}.pages.${key}`);
            }
            is(page.api, "boolean", `${at}.pages.api`);
        }
        for (const example of (raw.examples ?? []) as Record<
            string,
            unknown
        >[]) {
            for (const key of ["id", "title", "url"]) {
                is(example[key], "string", `${at}.examples.${key}`);
            }
        }
        for (const component of (raw.components ?? []) as Record<
            string,
            unknown
        >[]) {
            for (const key of ["name", "type", "item"]) {
                is(component[key], "string", `${at}.components.${key}`);
            }
            if (
                ![
                    "component",
                    "atom",
                    "family",
                    "lib",
                    "theme",
                    "palette",
                ].includes(String(component.group))
            ) {
                problems.push(
                    `${at}.components.group: ${String(component.group)}`,
                );
            }
            if (component.docs !== null)
                is(component.docs, "string", `${at}.components.docs`);
        }
    }
    return problems;
}

describe("the agent index", () => {
    test("matches fragiola/cli's docs/agent-index.md v1", () => {
        const { index, files } = build();
        expect(checkIndex(index)).toEqual([]);
        const written = files.find(
            (file) => file.path === "/agents/index.json",
        );
        expect(checkIndex(JSON.parse(written?.content ?? "{}"))).toEqual([]);
    });

    test("uses the site's origin", () => {
        expect(AGENT_SITE).toBe(SITE_URL);
        expect(build().index.site).toBe(SITE_URL);
    });

    test("keeps the two kinds apart", () => {
        const { index } = build();
        const ui = index.projects.find((project) => project.slug === "ui");
        expect(ui?.kind).toBe("registry");
        expect(ui?.packages).toEqual([]);
        expect(ui?.components.length).toBeGreaterThan(0);
        expect(
            new Set(ui?.components.map((component) => component.group)),
        ).toEqual(
            new Set(["theme", "palette", "lib", "family", "atom", "component"]),
        );
        expect(
            ui?.components.find((component) => component.name === "clickable"),
        ).toMatchObject({
            group: "atom",
            docs: "atoms/clickable",
            item: "/r/clickable.json",
        });
        for (const slug of ["dockable", "data-grid", "grid-layout"]) {
            const library = index.projects.find(
                (project) => project.slug === slug,
            );
            expect(library?.kind).toBe("library");
            expect(library?.components).toEqual([]);
            expect(library?.packages[0]).toEqual({
                name: `@fragiola/${slug}`,
                role: "core",
            });
            expect(library?.packages).toContainEqual({
                name: `@fragiola/${slug}-react`,
                role: "adapter",
                framework: "react",
            });
        }
        expect(index.registry).toEqual({
            namespace: "@fragiola",
            index: "/r/index.json",
            item: "/r/{name}.json",
            componentsJson: {
                "@fragiola": { url: "https://fragiola.com/r/{name}.json" },
            },
            // v1.8: ui's fixture declares two bases, the default first
            bases: [
                {
                    name: "primitives",
                    title: "Fragiola Primitives",
                    default: true,
                    index: "/r/index.json",
                    item: "/r/{name}.json",
                    componentsJson: {
                        "@fragiola": {
                            url: "https://fragiola.com/r/{name}.json",
                        },
                    },
                },
                {
                    name: "base",
                    title: "Base UI",
                    default: false,
                    index: "/r/base/index.json",
                    item: "/r/base/{name}.json",
                    componentsJson: {
                        "@fragiola": {
                            url: "https://fragiola.com/r/base/{name}.json",
                        },
                    },
                },
            ],
        });
    });

    test("lists every docs page, in sidebar order, each with its Markdown file", () => {
        const { index, files } = build();
        const paths = new Set(files.map((file) => file.path));
        for (const project of index.projects) {
            const config = JSON.parse(
                readFileSync(
                    join(FIXTURES, project.slug, "docs", "config.json"),
                    "utf8",
                ),
            ) as DocsConfig;
            const expected = config.sections.flatMap((section) =>
                section.pages.flatMap((entry) =>
                    "path" in entry ? [entry.path] : [],
                ),
            );
            expect(project.pages.map((page) => page.path)).toEqual(expected);
            for (const page of project.pages) {
                expect(page.url).toBe(`/${project.slug}/docs/${page.path}/`);
                expect(page.markdown).toBe(
                    `/agents/${project.slug}/${page.path}.md`,
                );
                expect(paths.has(page.markdown)).toBe(true);
            }
        }
        expect(paths.has("/agents/overview.md")).toBe(true);
        expect(paths.has("/llms.txt")).toBe(true);
    });

    test("writes Markdown with the vocabulary lowered and absolute links", () => {
        for (const file of build().files) {
            if (
                !file.path.endsWith(".md") ||
                file.path === "/agents/overview.md"
            )
                continue;
            expect(file.content.startsWith("# ")).toBe(true);
            // outside code blocks, no component and no base-free link is left
            const prose = file.content.replace(/```[\s\S]*?```/g, "");
            expect(prose).not.toMatch(
                /<(Example|InstallCommand|Callout|Tabs?|Steps?|Cards?|Framework)\b/,
            );
            expect(prose).not.toMatch(/\]\(\/(?!\/)/);
            expect(prose).not.toContain("{/*");
        }
    });

    test("is deterministic", () => {
        const first = build().files;
        const second = build().files;
        expect(second).toEqual(first);
        expect(
            first.find((file) => file.path === "/agents/index.json")?.content,
        ).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    test("marks the pages of an API section", () => {
        const dir = mkdtempSync(join(tmpdir(), "www-agents-"));
        try {
            for (const slug of SLUGS) {
                cpSync(join(FIXTURES, slug), join(dir, slug), {
                    recursive: true,
                });
            }
            const configFile = join(dir, "dockable", "docs", "config.json");
            const config = JSON.parse(
                readFileSync(configFile, "utf8"),
            ) as DocsConfig;
            config.sections.push({
                label: "API: primitives (@fragiola/dockable-react)",
                pages: [{ label: "Tab", path: "api/tab" }],
            });
            writeFileSync(configFile, JSON.stringify(config));
            cpSync(
                join(dir, "dockable", "docs", "guides", "popouts.mdx"),
                join(dir, "dockable", "docs", "api", "tab.mdx"),
            );
            const dockable = build(dir).index.projects.find(
                (project) => project.slug === "dockable",
            );
            const api = dockable?.pages
                .filter((page) => page.api)
                .map((page) => page.path);
            expect(api).toEqual(["api/tab"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("names the MCP server, the agent skills and the two kinds in llms.txt", () => {
        const llms =
            build().files.find((file) => file.path === "/llms.txt")?.content ??
            "";
        expect(llms.startsWith("# Fragiola\n\n> ")).toBe(true);
        expect(llms).toContain(
            "[MCP server](https://fragiola.com/ai/docs/mcp/)",
        );
        expect(llms).toContain(
            "[Agent skills](https://fragiola.com/ai/docs/skills/): `npx skills add fragiola/skills`",
        );
        expect(llms).toContain(
            "[Agent index](https://fragiola.com/agents/index.json)",
        );
        expect(llms).toContain("**Fragiola UI** (source code)");
        expect(llms).toContain("**Libraries** (npm packages)");
        expect(llms).toContain(
            "install only the adapter for the project's framework",
        );
        expect(llms).toContain(
            "(https://fragiola.com/agents/dockable/getting-started/installation.md)",
        );
    });
});

describe("installing a library", () => {
    test("is the adapter alone everywhere agents read, never the core with it", () => {
        const files = build().files.filter(
            (file) =>
                file.path === "/llms.txt" ||
                file.path === "/agents/overview.md",
        );
        expect(files).toHaveLength(2);
        for (const { content } of files) {
            expect(content).not.toMatch(/install both/i);
            expect(content).not.toContain(
                "`@fragiola/<x>` and `@fragiola/<x>-react`",
            );
        }
        expect(
            files.find((file) => file.path === "/agents/overview.md")?.content,
        ).toContain(
            "Install **only the adapter\nfor the project's framework**",
        );
    });
});

describe("lowering a page", () => {
    const lower = (body: string) =>
        pageMarkdown(
            `---\ntitle: A page\ndescription: What it is about, in a sentence.\n---\n\n${body}\n`,
            "dockable",
            AGENT_SITE,
            "@fragiola",
        );

    test("starts with the title and the description", () => {
        expect(lower("Text.")).toBe(
            "# A page\n\nWhat it is about, in a sentence.\n\nText.\n",
        );
    });

    test("rewrites base-free links to absolute site URLs", () => {
        const out = lower(
            "See [tabs](/docs/guides/tabs#close), [this](#here) and [x](https://x.test).\n\n[ref]: /examples/add-tabs",
        );
        expect(out).toContain(
            "[tabs](https://fragiola.com/dockable/docs/guides/tabs/#close)",
        );
        expect(out).toContain("[this](#here)");
        expect(out).toContain("[x](https://x.test)");
        expect(out).toContain(
            "[ref]: https://fragiola.com/dockable/examples/add-tabs/",
        );
    });

    test("lowers every component of the vocabulary", () => {
        const out = lower(
            [
                '<Example id="add-tabs" />',
                "",
                '<InstallCommand item="select" />',
                "",
                '<Callout type="warn" title="Careful">',
                "    Read [this](/docs/a).",
                "</Callout>",
                "",
                '<Tabs items={["pnpm", "npm"]}>',
                '    <Tab value="pnpm">',
                "        ```sh",
                "        pnpm add x",
                "        ```",
                "    </Tab>",
                '    <Tab value="npm">npm install x</Tab>',
                "</Tabs>",
                "",
                "<Steps>",
                "    <Step>First.</Step>",
                "    <Step>Second.</Step>",
                "</Steps>",
                "",
                "<Cards>",
                '    <Card title="Tabs" href="/docs/guides/tabs" description="Add and close tabs." />',
                "</Cards>",
                "",
                '<Framework name="vue">',
                "    Vue only.",
                "</Framework>",
                "",
                "{/* a comment */}",
            ].join("\n"),
        );
        expect(out).toContain(
            "[Example: add-tabs](https://fragiola.com/dockable/examples/add-tabs/)",
        );
        expect(out).toContain(
            "```bash\nnpx shadcn@latest add @fragiola/select\n```",
        );
        expect(out).toContain(
            "> **Careful** (warn)\n>\n> Read [this](https://fragiola.com/dockable/docs/a/).",
        );
        expect(out).toContain("**pnpm**\n\n```sh\npnpm add x\n```");
        expect(out).toContain("**npm**\n\nnpm install x");
        expect(out).toContain("1. First.\n1. Second.");
        expect(out).toContain(
            "- [Tabs](https://fragiola.com/dockable/docs/guides/tabs/): Add and close tabs.",
        );
        expect(out).toContain("**For vue:**\n\nVue only.");
        expect(out).not.toContain("comment");
        expect(out).not.toMatch(/^[ \t]+$/m);
    });
});

describe("lowering, edge cases", () => {
    const lower = (body: string) =>
        pageMarkdown(
            `---\ntitle: T\n---\n\n${body}\n`,
            "dockable",
            AGENT_SITE,
            "@fragiola",
        );

    test("a component inside a list item stays in it", () => {
        const out = lower(
            '- one\n\n  <Callout type="info">\n    inside\n  </Callout>\n- two',
        );
        expect(out).toContain("- one\n\n  > **Info**\n  >\n  > inside\n- two");
        const step = lower(
            '1. Install:\n\n   <InstallCommand item="select" />\n2. Use it.',
        );
        expect(step).toContain(
            "1. Install:\n\n   ```bash\n   npx shadcn@latest add @fragiola/select\n   ```\n2. Use it.",
        );
    });

    test("a component inside a blockquote keeps the quote marks", () => {
        const out = lower('> Note:\n>\n> <Example id="add-tabs" />');
        expect(out).toContain(
            "> [Example: add-tabs](https://fragiola.com/dockable/examples/add-tabs/)",
        );
    });

    test("code is kept verbatim, blank lines and spaces included", () => {
        const fence = "```py\nx = 1\n\n\n\ny = 2\n    \n```";
        expect(lower(fence)).toContain(fence);
        const inside = lower(
            `<Framework name="react">\n    ${fence.replace(/\n/g, "\n    ")}\n</Framework>`,
        );
        expect(inside).toContain(fence);
    });

    test("a link title with quotes stays valid, and definitions keep theirs", () => {
        const out = lower('[a](/docs/x \'say "hi"\')\n\n[d]: /docs/y "Title"');
        expect(out).toContain(
            '[a](https://fragiola.com/dockable/docs/x/ "say \\"hi\\"")',
        );
        expect(out).toContain(
            '[d]: https://fragiola.com/dockable/docs/y/ "Title"',
        );
    });
});

describe("helpers", () => {
    test("groups registry items by type and target", () => {
        expect(componentGroup({ name: "t", type: "registry:theme" })).toBe(
            "theme",
        );
        expect(
            componentGroup({
                name: "p",
                type: "registry:file",
                files: [{ path: "x", target: "~/styles/palettes/a.css" }],
            }),
        ).toBe("palette");
        expect(
            componentGroup({
                name: "cn",
                type: "registry:lib",
                files: [{ path: "x", target: "@lib/cn.ts" }],
            }),
        ).toBe("lib");
        expect(
            componentGroup({
                name: "menu",
                type: "registry:lib",
                files: [{ path: "x", target: "@components/families/menu.ts" }],
            }),
        ).toBe("family");
        expect(
            componentGroup({
                name: "field",
                type: "registry:ui",
                files: [
                    { path: "a", target: "@components/families/field.ts" },
                    { path: "b", target: "@ui/field.tsx" },
                ],
            }),
        ).toBe("component");
        expect(
            componentGroup({
                name: "text",
                type: "registry:ui",
                files: [
                    { path: "x", target: "~/components/atoms/text/index.tsx" },
                ],
            }),
        ).toBe("atom");
    });

    test("finds a library's packages, or falls back to the convention", () => {
        expect(libraryPackages("grid", ["react"], new Map())).toEqual([
            { name: "@fragiola/grid", role: "core" },
            {
                name: "@fragiola/grid-react",
                role: "adapter",
                framework: "react",
            },
        ]);
        const manifests = new Map([
            [
                "react",
                {
                    files: {},
                    examples: [
                        {
                            packages: [
                                "@fragiola/grid-react",
                                "lucide-react",
                                "@fragiola/grid",
                                "@fragiola/other",
                            ],
                        },
                    ],
                } as unknown as Manifest,
            ],
        ]);
        expect(
            libraryPackages("grid", ["react"], manifests).map(
                (pkg) => pkg.name,
            ),
        ).toEqual(["@fragiola/grid", "@fragiola/grid-react"]);
    });
});
