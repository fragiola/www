import {
    appendFileSync,
    cpSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
    type ExportRead,
    formatProblem,
    validateExport,
    validateSite,
} from "../lib/contract/validate.ts";

// The contract checks (§8) on the fixtures, and on copies of them broken one way at a time: each
// problem must name its file and, where there is one, its line.

const FIXTURES = join(import.meta.dirname, "..", "fixtures");
const SLUGS = ["ui", "dockable"];

let dir: string;
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "www-contract-"));
    for (const slug of SLUGS) {
        cpSync(join(FIXTURES, slug), join(dir, slug), { recursive: true });
    }
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const path = (file: string) => join(dir, file);

/** Appends lines to a file of the copy; returns the line number of the first one. */
function append(file: string, text: string): number {
    const before = readFileSync(path(file), "utf-8");
    const line = before.split("\n").length + (before.endsWith("\n") ? 0 : 1);
    appendFileSync(path(file), `${before.endsWith("\n") ? "" : "\n"}${text}\n`);
    return line;
}

function editJson<T>(file: string, edit: (value: T) => void) {
    const value = JSON.parse(readFileSync(path(file), "utf-8")) as T;
    edit(value);
    writeFileSync(path(file), `${JSON.stringify(value, null, 4)}\n`);
}

function readAll(): ExportRead[] {
    return SLUGS.map((slug) => validateExport(join(dir, slug), slug));
}

/** Every problem of the copy, formatted `<slug>/<file>:<line>:<column>: <message>`. */
function problems(): string[] {
    const reads = readAll();
    return [
        ...reads.flatMap((read) =>
            read.problems.map((p) => formatProblem(read.slug, p)),
        ),
        ...validateSite(reads).map((p) => formatProblem(p.slug, p)),
    ];
}

test("the fixtures follow the contract", () => {
    expect(problems()).toEqual([]);
});

describe("links (§3.3)", () => {
    const page = "dockable/docs/getting-started/installation.mdx";

    test("a link to a page that does not exist", () => {
        const line = append(page, "See [the API](/docs/api/root).");
        expect(problems()).toEqual([
            `${page}:${line}:5: broken link (markdown) "/docs/api/root": /docs/api/root: no such page`,
        ]);
    });

    test("a link to a heading that does not exist", () => {
        const line = append(
            page,
            "Read [step one](/docs/getting-started/first-layout#nope).",
        );
        expect(problems()).toEqual([
            `${page}:${line}:6: broken link (markdown) "/docs/getting-started/first-layout#nope": no heading #nope on /docs/getting-started/first-layout`,
        ]);
    });

    test("a link to a heading of the same page", () => {
        append(page, "Back to [the requirements](#requirements).");
        expect(problems()).toEqual([]);
        const line = append(page, "Back to [nowhere](#nowhere).");
        expect(problems()).toEqual([
            `${page}:${line}:9: broken link (markdown) "#nowhere": no heading #nowhere on /docs/getting-started/installation`,
        ]);
    });

    test("a link to an example that does not exist", () => {
        const line = append(page, "Try [it](/examples/nope).");
        expect(problems()).toEqual([
            `${page}:${line}:5: broken link (markdown) "/examples/nope": /examples/nope: no example "nope"`,
        ]);
    });

    test("relative links, links with the base and file links are refused", () => {
        const first = append(
            page,
            [
                "[a](../guides/popouts.mdx)",
                "[b](/dockable/docs/guides/popouts)",
                "[c](/docs/guides/popouts.mdx)",
            ].join("\n"),
        );
        const found = problems();
        expect(found).toHaveLength(3);
        expect(found[0]).toMatch(
            new RegExp(
                `^${page}:${first}:1: .*"../guides/popouts.mdx" is relative`,
            ),
        );
        expect(found[1]).toContain(`${page}:${first + 1}:1:`);
        expect(found[2]).toContain(`${page}:${first + 2}:1:`);
    });

    test("a Card and a Hero action link like any other", () => {
        const card = append(
            page,
            '<Cards>\n    <Card title="x" href="/docs/nope" />\n</Cards>',
        );
        const hero = append(
            "dockable/docs/index.mdx",
            '<Hero title="x" actions={[\n    { label: "y", href: "/docs/also-nope" },\n]} />',
        );
        expect(problems()).toEqual([
            `${page}:${card + 1}:21: broken link (<Card href>) "/docs/nope": /docs/nope: no such page`,
            `dockable/docs/index.mdx:${hero + 1}:5: broken link (<Hero actions>) "/docs/also-nope": /docs/also-nope: no such page`,
        ]);
    });

    test("an example's docs link", () => {
        editJson<{ examples: { id: string; docs?: string }[] }>(
            "ui/embed/react/manifest.json",
            (manifest) => {
                const [first] = manifest.examples;
                if (first) first.docs = "/docs/atoms/nope";
            },
        );
        expect(problems()).toEqual([
            'ui/embed/react/manifest.json: example "clickable": broken docs link "/docs/atoms/nope": /docs/atoms/nope: no such page',
        ]);
    });
});

describe("vocabulary (§3.4)", () => {
    const page = "ui/docs/atoms/clickable.mdx";

    test("a component outside the vocabulary", () => {
        const line = append(page, '<Badge tone="red">new</Badge>');
        expect(problems()).toEqual([
            `${page}:${line}:1: <Badge> is not in the vocabulary (§3.4): Example, Callout, Tabs, Tab, Steps, Step, Cards, Card, InstallCommand, Framework, Hero, Section, Features, Feature, Pills`,
        ]);
    });

    test("an HTML element is not in the vocabulary either", () => {
        const line = append(page, "<div>raw</div>");
        expect(problems()[0]).toMatch(
            new RegExp(`^${page}:${line}:1: <div> is not in the vocabulary`),
        );
    });

    test("import, export and expressions", () => {
        const line = append(
            page,
            'import { X } from "x";\n\n{1 + 1}\n\n{/* a comment is fine */}',
        );
        expect(problems()).toEqual([
            `${page}:${line}:1: import/export is not allowed: pages use the vocabulary only (§3.4)`,
            `${page}:${line + 2}:1: the expression {1 + 1} is not allowed: only {/* comments */}`,
        ]);
    });

    test("<Example> with an unknown id, theme, variant or framework", () => {
        const line = append(
            page,
            [
                '<Example id="nope" />',
                '<Example id="clickable" theme="sepia" />',
                '<Example id="clickable" variant="huge" />',
                '<Example id="clickable" framework="vue" />',
                '<Example id="clickable" height="tall" />',
            ].join("\n"),
        );
        expect(problems()).toEqual([
            `${page}:${line}:1: <Example id="nope">: no such example in the manifests`,
            `${page}:${line + 1}:25: <Example theme="sepia">: not in examples.json`,
            `${page}:${line + 2}:25: <Example variant="huge">: inline, bleed, card or showcase`,
            `${page}:${line + 3}:25: <Example framework="vue">: not a framework of project.json`,
            `${page}:${line + 4}:25: <Example height> takes a positive number: height={480}`,
        ]);
    });

    test("<Example framework> must have the example", () => {
        const page = "dockable/docs/guides/vue.mdx";
        const line = append(page, '<Example id="popout" framework="vue" />');
        expect(problems()).toEqual([
            `${page}:${line}:1: <Example id="popout" framework="vue">: embed/vue/manifest.json has no "popout"`,
        ]);
    });

    test("<InstallCommand> needs an item of the project's registry", () => {
        const line = append(page, '<InstallCommand item="nope" />');
        const other = append(
            "dockable/docs/guides/popouts.mdx",
            '<InstallCommand item="cn" />',
        );
        expect(problems()).toEqual([
            `${page}:${line}:1: <InstallCommand item="nope">: not in r/index.json`,
            `dockable/docs/guides/popouts.mdx:${other}:1: <InstallCommand item="cn">: the project exports no registry (§7)`,
        ]);
    });

    test("props: unknown, missing, not literal; Callout types; Hero off the landing", () => {
        const line = append(
            page,
            [
                '<Callout type="tip">x</Callout>',
                '<Callout kind="info">x</Callout>',
                "<Tabs items={items}>",
                '    <Tab value="a">a</Tab>',
                "</Tabs>",
                '<Hero title="x" />',
            ].join("\n"),
        );
        expect(problems()).toEqual([
            `${page}:${line}:10: <Callout type="tip">: info, warn or danger`,
            `${page}:${line + 1}:10: <Callout> takes no "kind" prop`,
            `${page}:${line + 1}:1: <Callout> needs "type"`,
            `${page}:${line + 2}:7: <Tabs items={items}>: a prop takes a literal value`,
            `${page}:${line + 2}:7: <Tabs items> takes a list of strings: items={["a", "b"]}`,
            `${page}:${line + 5}:1: <Hero> belongs on the landing only (§3.4)`,
        ]);
    });

    test("code blocks take a language and an optional title", () => {
        const line = append(
            page,
            '```\nno language\n```\n\n```tsx showLineNumbers\nx\n```\n\n```tsx title="ok.tsx"\nx\n```',
        );
        expect(problems()).toEqual([
            `${page}:${line}: a code block needs a language (§3.4)`,
            `${page}:${line + 4}: a code block takes only title="…" after its language (got "showLineNumbers")`,
        ]);
    });

    test("MDX that does not parse", () => {
        const line = append(page, '<Callout type="info">\n\nnever closed');
        expect(problems()[0]).toMatch(
            new RegExp(`^${page}:${line}(:\\d+)?: MDX does not parse:`),
        );
    });
});

describe("landing vocabulary (§3.4, §3.5, v1.1)", () => {
    const landing = "dockable/docs/index.mdx";

    test("the fixtures' landings use every piece", () => {
        const source = readFileSync(path("ui/docs/index.mdx"), "utf-8");
        for (const piece of [
            "eyebrow=",
            'background="grid"',
            'variant: "primary"',
            'icon: "arrow"',
            "<Section",
            "<Features columns={3} numbered>",
            "<Feature ",
        ]) {
            expect(source).toContain(piece);
        }
        const dockable = readFileSync(path(landing), "utf-8");
        for (const piece of [
            "{examples}",
            'variant="showcase"',
            "label=",
            "<Features columns={4}>",
            "<Pills strike",
        ]) {
            expect(dockable).toContain(piece);
        }
        expect(problems()).toEqual([]);
    });

    test("Hero: background, and each action's keys, variant, icon and label tokens", () => {
        const line = append(
            landing,
            [
                '<Hero title="x" background="dots" actions={[',
                '    { label: "a", href: "/", variant: "loud" },',
                '    { label: "b", href: "/", icon: "star", target: "_blank" },',
                '    { label: "{pages} pages", href: "/" },',
                "]} />",
            ].join("\n"),
        );
        expect(problems()).toEqual([
            `${landing}:${line}:17: <Hero background="dots">: none or grid`,
            `${landing}:${line}:35: <Hero actions>[0]: variant "loud" (primary, secondary, ghost)`,
            `${landing}:${line}:35: <Hero actions>[1] takes no "target"`,
            `${landing}:${line}:35: <Hero actions>[1]: icon "star" (arrow, external)`,
            `${landing}:${line}:35: <Hero actions>[2]: "{pages}" is not a label token (only {examples})`,
        ]);
    });

    test("{examples} needs examples", () => {
        rmSync(path("dockable/embed"), { recursive: true });
        editJson<{ frameworks: string[] }>("dockable/project.json", () => {});
        expect(problems().filter((p) => p.includes("{examples}"))).toEqual([
            expect.stringMatching(
                /^dockable\/docs\/index\.mdx:\d+:\d+: <Hero actions>\[1\]: \{examples\}, but the project has no examples$/,
            ),
        ]);
    });

    test("Features, Feature, Pills and Section: props, nesting, the landing only", () => {
        const line = append(
            landing,
            [
                '<Features columns={5} numbered="yes">',
                '    <Feature title="a">a</Feature>',
                "</Features>",
                '<Feature title="stray">b</Feature>',
                '<Pills items="CSS" strike={1} />',
                '<Section eyebrow="no title">x</Section>',
            ].join("\n"),
        );
        const page = "ui/docs/atoms/clickable.mdx";
        const other = append(page, '<Pills items={["a"]} />');
        expect(problems()).toEqual([
            `${page}:${other}:1: <Pills> belongs on the landing only (§3.4)`,
            `${landing}:${line}:23: <Features numbered> is a flag: write numbered (or numbered={false})`,
            `${landing}:${line}:11: <Features columns> is {2}, {3} or {4}`,
            `${landing}:${line + 3}:1: <Feature> goes inside <Features>`,
            `${landing}:${line + 4}:20: <Pills strike> is a flag: write strike (or strike={false})`,
            `${landing}:${line + 4}:8: <Pills items> takes a list of strings: items={["CSS", "Icons"]}`,
            `${landing}:${line + 5}:1: <Section> needs "title"`,
        ]);
    });

    test("<Example label> goes with the showcase", () => {
        const line = append(
            landing,
            '<Example id="hello-layout" label="Themes:" />',
        );
        expect(problems()).toEqual([
            `${landing}:${line}:28: <Example label> goes with variant="showcase"`,
        ]);
    });

    test("project.json repository, and the sidebar's collapsible sections", () => {
        editJson<Record<string, unknown>>("ui/project.json", (project) => {
            project.repository = "git@github.com:fragiola/ui.git";
        });
        editJson<{
            sections: { collapsible?: unknown; defaultOpen?: unknown }[];
        }>("dockable/docs/config.json", (config) => {
            const [first, second] = config.sections;
            if (first) first.collapsible = "yes";
            if (second) second.defaultOpen = true;
        });
        expect(problems()).toEqual([
            'ui/project.json:13: repository must be an https:// URL (got "git@github.com:fragiola/ui.git")',
            expect.stringMatching(
                /^dockable\/docs\/config\.json:\d+: section "Getting started": collapsible is true or false \(§3\.1\)$/,
            ),
            expect.stringMatching(
                /^dockable\/docs\/config\.json:\d+: section "Guides": defaultOpen needs collapsible: true/,
            ),
        ]);
    });
});

describe("frontmatter and config ↔ files (§3.1, §3.2)", () => {
    test("title and description are required; only the landing takes a layout", () => {
        const page = "ui/docs/atoms/clickable.mdx";
        const source = readFileSync(path(page), "utf-8");
        writeFileSync(
            path(page),
            source.replace(/^description: .*$/m, "layout: landing"),
        );
        expect(problems()).toEqual([
            `${page}:1: frontmatter: description is required (§3.2)`,
            `${page}:1: frontmatter: only the landing (index.mdx) takes a layout`,
        ]);
    });

    test("a page not in config.json, and a config entry without a page", () => {
        writeFileSync(
            path("ui/docs/atoms/extra.mdx"),
            "---\ntitle: Extra\ndescription: Not listed.\n---\n\nHello.\n",
        );
        editJson<{ sections: { pages: { label: string; path: string }[] }[] }>(
            "ui/docs/config.json",
            (config) => {
                config.sections[0]?.pages.push({ label: "Gone", path: "gone" });
            },
        );
        const found = problems();
        expect(found).toContain(
            "ui/docs/atoms/extra.mdx: is not listed in docs/config.json (§3.1)",
        );
        expect(found.find((p) => p.includes('"gone"'))).toMatch(
            /^ui\/docs\/config\.json:\d+: "gone": docs\/gone\.mdx does not exist$/,
        );
    });

    test("a section for a framework the project does not have", () => {
        editJson<{ sections: { framework?: string }[] }>(
            "ui/docs/config.json",
            (config) => {
                if (config.sections[0]) config.sections[0].framework = "vue";
            },
        );
        const line = readFileSync(path("ui/docs/config.json"), "utf-8")
            .split("\n")
            .findIndex((text) => text.includes('"framework": "vue"'));
        expect(problems()).toEqual([
            `ui/docs/config.json:${line + 1}: section "Getting Started": framework "vue" is not in project.json`,
        ]);
    });
});

describe("project, manifests and examples.json (§2, §4, §5)", () => {
    test("another contract version is rejected outright", () => {
        editJson<{ contract: number }>("dockable/project.json", (project) => {
            project.contract = 0;
        });
        expect(problems()).toEqual([
            "dockable/project.json:2: contract 0: www implements contract 1 (v1.1)",
        ]);
    });

    test("a manifest's level, file and namespaced registry item", () => {
        editJson<{
            examples: {
                id: string;
                level: string;
                files: string[];
                registry: string[];
            }[];
        }>("dockable/embed/react/manifest.json", (manifest) => {
            const [first] = manifest.examples;
            if (!first) return;
            first.level = "expert";
            first.files.push("nope.tsx");
            first.registry.push("@fragiola/input");
        });
        const found = problems();
        expect(found).toEqual(
            expect.arrayContaining([
                expect.stringMatching(
                    /^dockable\/embed\/react\/manifest\.json:\d+: example "hello-layout": level "expert" is not in examples\.json$/,
                ),
                expect.stringMatching(
                    /example "hello-layout": file "nope\.tsx" is not in files$/,
                ),
                expect.stringMatching(
                    /example "hello-layout": registry item "@fragiola\/input" is written without the namespace/,
                ),
            ]),
        );
    });

    test("an example's registry item must exist in some project's r/", () => {
        editJson<{ examples: { registry: string[] }[] }>(
            "dockable/embed/react/manifest.json",
            (manifest) => {
                manifest.examples[0]?.registry.push("no-such-item");
            },
        );
        expect(problems()).toEqual([
            'dockable/embed/react/manifest.json: example "hello-layout": registry item "no-such-item" is in no project\'s r/',
        ]);
    });

    test("examples.json needs a light and a dark theme", () => {
        editJson<{ themes: { scheme: string }[] }>(
            "ui/examples.json",
            (config) => {
                config.themes = config.themes.filter(
                    (t) => t.scheme !== "dark",
                );
            },
        );
        expect(problems()).toEqual([
            "ui/examples.json: no dark theme: a project with no themes of its own declares one light and one dark (§4)",
        ]);
    });

    test("an embed app built for another base", () => {
        const index = path("ui/embed/react/index.html");
        writeFileSync(
            index,
            readFileSync(index, "utf-8").replaceAll(
                "/ui/embed/react/",
                "/embed/",
            ),
        );
        expect(problems()[0]).toMatch(
            /^ui\/embed\/react\/index\.html:\d+: "\/embed\/app\.css" is outside \/ui\/embed\/react\/: the embed app must be built with base/,
        );
    });
});

describe("registry (§7)", () => {
    test("a bare registryDependencies entry", () => {
        editJson<{ registryDependencies: string[] }>(
            "ui/r/clickable.json",
            (item) => {
                item.registryDependencies = ["cn"];
            },
        );
        expect(problems()).toEqual([
            expect.stringMatching(
                /^ui\/r\/clickable\.json:\d+: registryDependencies "cn" is bare: write "@fragiola\/cn" or a full URL/,
            ),
        ]);
    });

    test("two projects exporting the same item fail the build", () => {
        cpSync(path("ui/r"), path("dockable/r"), { recursive: true });
        editJson<Record<string, unknown>>(
            "dockable/project.json",
            (project) => {
                project.registry = { namespace: "@fragiola" };
            },
        );
        const found = problems();
        expect(found.length).toBeGreaterThan(0);
        expect(found).toContain(
            'dockable/r/cn.json: registry item "cn" is exported by both "ui" and "dockable": /r is shared by every project (§7)',
        );
    });
});
