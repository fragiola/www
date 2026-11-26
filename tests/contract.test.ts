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
import { SIDEBAR_ICONS } from "../lib/contract/icons.ts";
import {
    type ExportRead,
    formatProblem,
    validateDocsSpace,
    validateExport,
    validateSite,
} from "../lib/contract/validate.ts";
import { AI_SPACE, DOCS_SPACES } from "../lib/site-paths.ts";

// The contract checks (§8) on the fixtures, and on copies of them broken one way at a time: each
// problem must name its file and, where there is one, its line.

const FIXTURES = join(import.meta.dirname, "..", "fixtures");
/** Every project of projects.json: each has a fixture. */
const SLUGS = (
    JSON.parse(
        readFileSync(join(import.meta.dirname, "..", "projects.json"), "utf-8"),
    ) as { slug: string }[]
).map((project) => project.slug);

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
            `dockable/docs/index.mdx:${hero}:1: a second <Hero>: the landing has exactly one, its only h1 (§3.4)`,
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
            `${landing}:${line}:1: a second <Hero>: the landing has exactly one, its only h1 (§3.4)`,
        ]);
    });

    test("{examples} needs examples", () => {
        rmSync(path("dockable/embed"), { recursive: true });
        editJson<{ frameworks: string[] }>("dockable/project.json", () => {});
        expect(problems().filter((p) => p.includes("{examples}"))).toEqual([
            expect.stringMatching(
                /^dockable\/docs\/index\.mdx:\d+:\d+: <Hero actions>\[0\]: \{examples\}, but the project has no examples$/,
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

describe("search and sharing (§2, §3.2, §3.4, §5.1, v1.2)", () => {
    const setField = (file: string, key: string, value: string) => {
        const source = readFileSync(path(file), "utf-8");
        const next = source.replace(
            new RegExp(`^${key}: .*$`, "m"),
            `${key}: ${value}`,
        );
        expect(next).not.toBe(source);
        writeFileSync(path(file), next);
    };

    test("project.json: description length and keywords", () => {
        editJson<Record<string, unknown>>(
            "dockable/project.json",
            (project) => {
                project.description = "Too short.";
                project.keywords = [
                    "Tabs",
                    "tabs",
                    " splitter",
                    "a".repeat(41),
                ];
            },
        );
        editJson<Record<string, unknown>>("ui/project.json", (project) => {
            project.keywords = [];
        });
        expect(problems()).toEqual([
            "ui/project.json:14: keywords must list 1–8 topics (§2)",
            "dockable/project.json:5: description is 10 characters: 50–160 (§2)",
            'dockable/project.json:18: keywords: "Tabs" is not lowercase (§2)',
            'dockable/project.json:18: keywords: " splitter" is not a topic: a non-empty string, no surrounding spaces (§2)',
            `dockable/project.json:18: keywords: "${"a".repeat(41)}" is 41 characters: at most 40 (§2)`,
        ]);
        editJson<Record<string, unknown>>("ui/project.json", (project) => {
            project.keywords = ["theming", "theming"];
        });
        expect(problems()).toContain(
            'ui/project.json:14: keywords: "theming" is listed twice (§2)',
        );
    });

    test("project.json: adapters (v1.5)", () => {
        // ui names none: its adapters are its frameworks
        expect(problems()).toEqual([]);
        editJson<Record<string, unknown>>(
            "dockable/project.json",
            (project) => {
                project.adapters = ["vanilla", "React", "vanilla", 3];
            },
        );
        editJson<Record<string, unknown>>("ui/project.json", (project) => {
            project.adapters = [];
        });
        const notAnId = (value: string) =>
            `dockable/project.json:11: adapters: ${value} is not an id: lowercase letters, digits and dashes, like "vanilla" or "react" (§2)`;
        expect(problems()).toEqual([
            "ui/project.json:38: adapters must list 1–12 adapters (§2)",
            notAnId('"React"'),
            'dockable/project.json:11: adapters: "vanilla" is listed twice (§2)',
            notAnId("3"),
            'dockable/project.json:11: adapters: "react" is in frameworks but not in adapters (§2)',
            'dockable/project.json:11: adapters: "vue" is in frameworks but not in adapters (§2)',
        ]);
        editJson<Record<string, unknown>>("ui/project.json", (project) => {
            project.adapters = ["vanilla", "svelte"];
        });
        expect(problems()).toContain(
            'ui/project.json:38: adapters: "react" is in frameworks but not in adapters (§2)',
        );
    });

    test("frontmatter: title at most 60, description 50–160, counted in characters", () => {
        const page = "dockable/docs/guides/popouts.mdx";
        setField(page, "title", "P".repeat(61));
        setField(page, "description", "Short.");
        // 160 characters, some outside the Basic Multilingual Plane: code points, not UTF-16
        setField(
            "dockable/docs/guides/vue.mdx",
            "description",
            `${"😀".repeat(10)}${"x".repeat(150)}`,
        );
        expect(problems()).toEqual([
            `${page}:2:1: frontmatter: title is 61 characters: at most 60 (§3.2)`,
            `${page}:3:1: frontmatter: description is 6 characters: 50–160 (§3.2)`,
        ]);
    });

    test("the landing's title contains the project's and says more than its name", () => {
        setField("dockable/docs/index.mdx", "title", "Dockable");
        setField(
            "ui/docs/index.mdx",
            "title",
            '"Components on Base UI and Tailwind, for React"',
        );
        expect(problems()).toEqual([
            'ui/docs/index.mdx:2:1: frontmatter: the landing\'s title "Components on Base UI and Tailwind, for React" is its <title>: it contains the project\'s title "Fragiola UI" (§3.2)',
            'dockable/docs/index.mdx:2:1: frontmatter: the landing\'s title is its <title>: say what Dockable is, not only its name ("Dockable — …") (§3.2)',
        ]);
    });

    test("no Markdown # heading, no skipped level", () => {
        const page = "dockable/docs/guides/popouts.mdx";
        const line = append(page, "# A second title\n\n#### Too deep");
        expect(problems()).toEqual([
            `${page}:${line}:1: a Markdown # heading: the page's h1 is its frontmatter title (§3.4)`,
            `${page}:${line + 2}:1: a #### heading after an h1: headings do not skip a level (§3.4)`,
        ]);
    });

    test("a page starts at ##; on the landing, a Section's title is the h2 its headings follow", () => {
        const page = "dockable/docs/guides/vue.mdx";
        const source = readFileSync(path(page), "utf-8");
        writeFileSync(path(page), source.replace("## Install", "### Install"));
        const landing = "ui/docs/index.mdx";
        const line = append(
            landing,
            [
                '<Section title="Fine">',
                "    ### Under the section's h2",
                "    #### And one more",
                "</Section>",
                "",
                "### Outside any section, after an h4",
                "",
                "<Features>",
                '    <Feature title="An h2 outside a section" />',
                "</Features>",
                "",
                "#### After that h2",
                "",
                "# Not on a landing either",
            ].join("\n"),
        );
        expect(problems()).toEqual([
            `${landing}:${line + 11}:1: a #### heading after an h2: headings do not skip a level (§3.4)`,
            `${landing}:${line + 13}:1: a Markdown # heading: the page's h1 is its <Hero>'s title (§3.4)`,
            expect.stringMatching(
                /^dockable\/docs\/guides\/vue\.mdx:\d+:1: a ### heading after an h1: headings do not skip a level \(§3\.4\)$/,
            ),
        ]);
    });

    test("a <Card>'s title is an h3: under a page's h1 it skips a level", () => {
        const page = "dockable/docs/guides/vue.mdx";
        const source = readFileSync(path(page), "utf-8");
        const body = source.indexOf("<Framework");
        writeFileSync(
            path(page),
            `${source.slice(0, body)}<Cards>\n    <Card title="Popouts" href="/docs/guides/popouts" />\n</Cards>\n\n#### After the card\n\n${source.slice(body)}`,
        );
        const line = source.slice(0, body).split("\n").length;
        expect(problems()).toEqual([
            `${page}:${line + 1}:5: a <Card> (an h3) after an h1: headings do not skip a level (§3.4)`,
        ]);
    });

    test("a description is counted as plain text, without its code marks", () => {
        const page = "dockable/docs/guides/popouts.mdx";
        // 52 characters as written, 48 once `code` marks are dropped
        const description =
            "Popouts with `popoutURL` and `onPopout` in a window.";
        expect([...description]).toHaveLength(52);
        setField(page, "description", description);
        expect(problems()).toEqual([
            `${page}:3:1: frontmatter: description is 48 characters: 50–160 (§3.2)`,
        ]);
    });

    test("the landing has exactly one <Hero>", () => {
        const landing = "dockable/docs/index.mdx";
        const source = readFileSync(path(landing), "utf-8");
        writeFileSync(
            path(landing),
            source.replace(/<Hero[\s\S]*?\n\/>\n/, ""),
        );
        expect(problems()).toEqual([
            `${landing}:1: the landing has no <Hero>: its title is the landing's h1 (§3.4)`,
        ]);
    });

    test("an image needs alt text", () => {
        const page = "ui/docs/atoms/clickable.mdx";
        const line = append(
            page,
            "![](/button.png)\n\n![ ][shot]\n\n[shot]: https://example.com/shot.png\n\n![A button](/ok.png)",
        );
        expect(problems()).toEqual([
            `${page}:${line}:1: an image needs alt text: ![what it shows](…) (§3.4)`,
            `${page}:${line + 2}:1: an image needs alt text: ![what it shows](…) (§3.4)`,
        ]);
    });

    test("every embed HTML file is noindex", () => {
        const index = "dockable/embed/vue/index.html";
        const popout = "dockable/embed/react/popout/index.html";
        for (const file of [index, popout]) {
            const html = readFileSync(path(file), "utf-8");
            writeFileSync(
                path(file),
                html.replace(/ *<meta name="robots"[^>]*>\n/, ""),
            );
        }
        // any attribute order and quoting passes
        const ui = "ui/embed/react/index.html";
        writeFileSync(
            path(ui),
            readFileSync(path(ui), "utf-8").replace(
                /<meta name="robots"[^>]*>/,
                "<meta content='noindex, nofollow' name=robots>",
            ),
        );
        expect(problems()).toEqual([
            `${popout}:4: needs <meta name="robots" content="noindex">: an example is not a page for search engines (§5.1)`,
            `${index}:4: needs <meta name="robots" content="noindex">: an example is not a page for search engines (§5.1)`,
        ]);
    });

    test("a noindex meta in a comment says nothing; an unquoted one counts", () => {
        const index = "ui/embed/react/index.html";
        const html = readFileSync(path(index), "utf-8");
        writeFileSync(
            path(index),
            html.replace(/(<meta name="robots"[^>]*>)/, "<!-- $1 -->"),
        );
        const popout = "ui/embed/react/popout/index.html";
        writeFileSync(
            path(popout),
            readFileSync(path(popout), "utf-8").replace(
                /<meta name="robots"[^>]*>/,
                "<meta name=robots content=noindex>",
            ),
        );
        expect(problems()).toEqual([
            `${index}:4: needs <meta name="robots" content="noindex">: an example is not a page for search engines (§5.1)`,
        ]);
    });
});

describe("the Create page (v1.6, §2, §3.3, §5.5)", () => {
    const createHtml = "ui/embed/react/create.html";
    /** ui without `create`, its file and its link: a v1.5 export */
    function withoutCreate() {
        editJson<Record<string, unknown>>("ui/project.json", (project) => {
            delete project.create;
        });
        rmSync(path(createHtml));
        const landing = "ui/docs/index.mdx";
        writeFileSync(
            path(landing),
            readFileSync(path(landing), "utf-8").replace(
                /^ *\{ label: "Create a theme".*\n/m,
                "",
            ),
        );
    }

    test("a v1.5 export, with no create, stays valid", () => {
        withoutCreate();
        expect(problems()).toEqual([]);
    });

    test("create: the shape, the lengths and the framework", () => {
        const at = (message: string) =>
            `ui/project.json:22: create: ${message} (§2)`;
        editJson<Record<string, unknown>>("ui/project.json", (project) => {
            project.create = "Create";
        });
        expect(problems()).toEqual([
            at('"Create" is not { "title", "description", "framework" }'),
        ]);
        editJson<Record<string, unknown>>("ui/project.json", (project) => {
            project.create = {
                title: "C".repeat(61),
                description: "Too short.",
                framework: "vue",
                href: "/create",
            };
        });
        expect(problems()).toEqual([
            at('"href" is not a field: title, description and framework'),
            at("title is 61 characters: at most 60"),
            at("description is 10 characters: 50–160"),
            at('framework "vue" is not in frameworks'),
        ]);
        editJson<Record<string, unknown>>("ui/project.json", (project) => {
            project.create = {};
        });
        expect(problems()).toEqual([
            at("title is required"),
            at("description is required"),
            at("framework is required"),
        ]);
    });

    test("create.html exists and is noindex", () => {
        rmSync(path(createHtml));
        expect(problems()).toEqual([
            `${createHtml}: is missing: project.json declares create, and the Create page is this file (§5.5)`,
        ]);
        cpSync(join(FIXTURES, "ui/embed/react/create.html"), path(createHtml));
        writeFileSync(
            path(createHtml),
            readFileSync(path(createHtml), "utf-8").replace(
                / *<meta name="robots"[^>]*>\n/,
                "",
            ),
        );
        const head = readFileSync(path(createHtml), "utf-8")
            .split("\n")
            .findIndex((line) => line.includes("<head>"));
        expect(problems()).toEqual([
            `${createHtml}:${head + 1}: needs <meta name="robots" content="noindex">: the Create page's app is not a page for search engines, /<slug>/create/ is (§5.5)`,
        ]);
    });

    test("create.html loads what it needs from the embed's base; its links out are site URLs", () => {
        writeFileSync(
            path(createHtml),
            readFileSync(path(createHtml), "utf-8").replace(
                "</body>",
                '<script src="/assets/create.js"></script></body>',
            ),
        );
        expect(problems()).toEqual([
            expect.stringMatching(
                /^ui\/embed\/react\/create\.html:\d+: "\/assets\/create\.js" is outside \/ui\/embed\/react\/: the embed app must be built with base \/ui\/embed\/react\/ \(§5\)$/,
            ),
        ]);
    });

    test("a /create link only when create is declared, and with no anchor", () => {
        const page = "dockable/docs/getting-started/installation.mdx";
        const line = append(page, "\n[Create](/create)\n");
        expect(problems()).toEqual([
            `${page}:${line + 1}:1: broken link (markdown) "/create": /create: the project declares no Create page (project.json create, §2)`,
        ]);
        rmSync(path(page));
        cpSync(join(FIXTURES, page), path(page));
        const uiPage = "ui/docs/getting-started/installation.mdx";
        const uiLine = append(uiPage, "\n[Create](/create#colours)\n");
        expect(problems()).toEqual([
            `${uiPage}:${uiLine + 1}:1: broken link (markdown) "/create#colours": /create takes no anchor: the Create page is the project's app (§3.3)`,
        ]);
    });

    test("without create, the landing's /create action is a broken link", () => {
        editJson<Record<string, unknown>>("ui/project.json", (project) => {
            delete project.create;
        });
        const landing = readFileSync(path("ui/docs/index.mdx"), "utf-8");
        const line = landing
            .split("\n")
            .findIndex((text) => text.includes('href: "/create"'));
        expect(problems()).toEqual([
            `ui/docs/index.mdx:${line + 1}:9: broken link (<Hero actions>) "/create": /create: the project declares no Create page (project.json create, §2)`,
        ]);
    });
});

describe("the AI agents docs link (v1.7, §3.3)", () => {
    test("/ai, with or without an anchor, in Markdown, a <Card> and a Hero action", () => {
        const page = "dockable/docs/getting-started/installation.mdx";
        append(
            page,
            '\n[Your agent](/ai)\n\n[Set it up](/ai#set-it-up-in-your-client)\n\n<Cards>\n    <Card title="Build with your agent" href="/ai" />\n</Cards>\n',
        );
        // a fixture landing already has an /ai Hero action
        expect(
            readFileSync(path("dockable/docs/index.mdx"), "utf-8"),
        ).toContain('href: "/ai"');
        expect(problems()).toEqual([]);
    });

    test("anything below /ai is a broken link, with what to write instead", () => {
        const page = "dockable/docs/getting-started/installation.mdx";
        const line = append(page, "\n[MCP](/ai/docs/mcp)\n");
        expect(problems()).toEqual([
            `${page}:${line + 1}:1: broken link (markdown) "/ai/docs/mcp": "/ai/docs/mcp": the AI agents docs are linked as /ai (optionally /ai#anchor), nothing below it (§3.3)`,
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

describe("sidebar icons (§3.1, v1.4)", () => {
    type Config = {
        sections: {
            icon?: unknown;
            pages: { label: string; icon?: unknown; href?: string }[];
        }[];
    };

    test("the contract lists exactly the names of lib/contract/icons.ts", () => {
        const contract = readFileSync(
            join(import.meta.dirname, "..", "CONTRACT.md"),
            "utf-8",
        );
        const list = contract.split("<!-- sidebar-icons:")[1]?.split("\n")[1];
        expect(
            list?.match(/`[a-z0-9-]+`/g)?.map((n) => n.slice(1, -1)),
        ).toEqual([...SIDEBAR_ICONS]);
    });

    test("icons on sections, pages and external links are valid", () => {
        editJson<Config>("dockable/docs/config.json", (config) => {
            const section = config.sections[0];
            if (!section) throw new Error("no section");
            section.icon = "layers";
            section.pages.push({
                label: "Source",
                href: "https://github.com/fragiola/dockable",
                external: true,
                icon: "git-branch",
            } as Config["sections"][number]["pages"][number]);
        });
        expect(problems()).toEqual([]);
    });

    test("an unknown icon, and an icon that is not a string", () => {
        editJson<Config>("ui/docs/config.json", (config) => {
            const [first, second] = config.sections;
            if (!first || !second) throw new Error("no sections");
            first.icon = "unicorn";
            const page = second.pages[0];
            if (page) page.icon = 3;
        });
        const lines = readFileSync(path("ui/docs/config.json"), "utf-8").split(
            "\n",
        );
        const lineOf = (text: string) =>
            lines.findIndex((line) => line.includes(text)) + 1;
        expect(problems()).toEqual([
            `ui/docs/config.json:${lineOf('"icon": "unicorn"')}: section "Getting Started": icon "unicorn" is not one of the sidebar icons (§3.1)`,
            `ui/docs/config.json:${lineOf('"path": "atoms/clickable"')}: "Clickable": icon 3 is not one of the sidebar icons (§3.1)`,
        ]);
    });
});

describe("project, manifests and examples.json (§2, §4, §5)", () => {
    test("another contract version is rejected outright", () => {
        editJson<{ contract: number }>("dockable/project.json", (project) => {
            project.contract = 0;
        });
        expect(problems()).toEqual([
            "dockable/project.json:2: contract 0: www implements contract 1 (v1.8)",
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

describe("bases (v1.8, §2, §5.6, §7)", () => {
    // ui's fixture declares two bases: Fragiola Primitives (the default, at r/ and
    // embed/react/) and Base UI (r/base/, embed/react/base/)
    type Bases = { name: unknown; title?: unknown; default?: unknown }[];
    const editBases = (edit: (bases: Bases) => void) =>
        editJson<{ bases: Bases }>("ui/project.json", (project) =>
            edit(project.bases),
        );

    test("the fixtures' two bases are valid", () => {
        expect(problems()).toEqual([]);
    });

    test("bases: shape, names, titles and exactly one default", () => {
        editBases((bases) => {
            bases.push(
                { name: "Base", title: "Bad" },
                { name: "base", title: "Again" },
                { name: "assets", title: "Reserved" },
                { name: "radix", default: true },
            );
        });
        const found = problems();
        expect(found).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/bases: "Base" is not a base name/),
                expect.stringMatching(/bases: "base" is listed twice/),
                expect.stringMatching(/bases: "assets" is not a base name/),
                expect.stringMatching(/bases: "radix" needs a title/),
                expect.stringMatching(
                    /bases: exactly one base is the default \(got 2\)/,
                ),
            ]),
        );
    });

    test("a project on one base declares none", () => {
        editBases((bases) => {
            bases.splice(1);
        });
        expect(problems()).toContainEqual(
            expect.stringMatching(/bases must list 2–8 bases/),
        );
    });

    test("a missing base registry or embed app fails, naming the base", () => {
        rmSync(path("ui/r/base"), { recursive: true });
        rmSync(path("ui/embed/react/base"), { recursive: true });
        const found = problems();
        expect(found).toContainEqual(
            expect.stringMatching(/^ui\/r\/base\/index\.json: /),
        );
        expect(found).toContain(
            'ui/embed/react/base/index.html: is missing: project.json declares the base "base" (§5.6)',
        );
    });

    test("a base with other items or examples than the default's", () => {
        rmSync(path("ui/r/base/cn.json"));
        editJson<{ items: { name: string }[] }>(
            "ui/r/base/index.json",
            (index) => {
                index.items = index.items.filter((item) => item.name !== "cn");
            },
        );
        editJson<{ examples: { id: string }[] }>(
            "ui/embed/react/base/manifest.json",
            (manifest) => {
                manifest.examples = manifest.examples.slice(1);
            },
        );
        const found = problems();
        expect(found).toContainEqual(
            expect.stringMatching(
                /^ui\/r\/base\/index\.json: the base "base" has other items than r\/index\.json \(missing: cn\)/,
            ),
        );
        expect(found).toContainEqual(
            expect.stringMatching(
                /^ui\/embed\/react\/base\/manifest\.json: the base "base" has other examples than the default base's \(missing: /,
            ),
        );
    });

    test("a base embed app built for another base path", () => {
        const file = path("ui/embed/react/base/index.html");
        writeFileSync(
            file,
            readFileSync(file, "utf-8").replaceAll(
                "/ui/embed/react/base/",
                "/ui/embed/react/",
            ),
        );
        expect(problems()).toContainEqual(
            expect.stringMatching(
                /^ui\/embed\/react\/base\/index\.html:\d+: .* is outside \/ui\/embed\/react\/base\//,
            ),
        );
    });

    test("two projects exporting the same item on the same base fail the build", () => {
        cpSync(path("ui/r"), path("dockable/r"), { recursive: true });
        editJson<Record<string, unknown>>(
            "dockable/project.json",
            (project) => {
                project.registry = { namespace: "@fragiola" };
                project.bases = [
                    {
                        name: "primitives",
                        title: "Fragiola Primitives",
                        default: true,
                    },
                    { name: "base", title: "Base UI" },
                ];
            },
        );
        cpSync(path("ui/embed/react/base"), path("dockable/embed/react/base"), {
            recursive: true,
        });
        expect(problems()).toContain(
            'dockable/r/base/cn.json: registry item "cn" of the base "base" is exported by both "ui" and "dockable": /r/base/ is shared by every project (§7)',
        );
    });
});

test.each(["agents", "llms.txt", "ai", "mcp", "skills", "r", "brand"])(
    "the slug %s is reserved by the site",
    (slug) => {
        const read: ExportRead = {
            slug,
            dir,
            manifests: new Map(),
            registry: new Map(),
            baseRegistries: new Map(),
            problems: [],
        };
        expect(
            validateSite([read]).map((problem) => problem.message),
        ).toContain(`slug "${slug}" is reserved by the site`);
    },
);

describe("the docs spaces www writes itself (content/<slug>/)", () => {
    const space = (slug: string) => {
        const copy = join(dir, `space-${slug}`);
        cpSync(join(import.meta.dirname, "..", "content", slug), copy, {
            recursive: true,
        });
        return copy;
    };

    test.each(DOCS_SPACES.map((s) => [s.slug, s] as const))(
        "content/%s follows the contract's docs rules, with no landing",
        (slug, info) => {
            expect(validateDocsSpace(space(slug), info)).toEqual([]);
        },
    );

    test("a broken link or a component outside the vocabulary fails it", () => {
        const copy = space("ai");
        appendFileSync(
            join(copy, "docs", "skills.mdx"),
            "\n[nowhere](/docs/missing)\n\n<Marquee />\n",
        );
        const messages = validateDocsSpace(copy, AI_SPACE).map(
            (problem) => problem.message,
        );
        expect(messages.some((m) => m.includes('"/docs/missing"'))).toBe(true);
        expect(messages.some((m) => m.includes("Marquee"))).toBe(true);
    });
});
