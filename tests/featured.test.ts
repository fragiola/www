import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { landingExample, scanPage } from "../lib/contract/mdx.ts";

// The organization's landing ("See it live") features each project's landing example: its
// showcase `<Example>`, else its first one, read by lib/contract/mdx.ts. Nothing is listed by hand,
// so changing a landing changes the slide. The palette section shows Fragiola UI's palettes,
// else nothing.

const ROOT = join(import.meta.dirname, "..");
const FRONTMATTER =
    '---\ntitle: "A landing"\ndescription: "A landing page."\nlayout: "landing"\n---\n\n';

const featured = (body: string) =>
    landingExample(scanPage(`${FRONTMATTER}${body}`));

describe("a landing's featured example", () => {
    test("the showcase first, wherever it is", () => {
        expect(
            featured(
                '<Example id="first" variant="bleed" />\n\n<Section title="S">\n    <Example id="demo" variant="showcase" theme="paper" height={560} />\n</Section>\n',
            ),
        ).toEqual({
            id: "demo",
            variant: "showcase",
            theme: "paper",
            height: 560,
        });
    });

    test("else the first <Example> in document order", () => {
        expect(
            featured(
                '<Section title="S">\n    <Example id="nested" variant="bleed" framework="vue" />\n</Section>\n\n<Example id="later" variant="card" />\n',
            ),
        ).toEqual({ id: "nested", variant: "bleed", framework: "vue" });
        expect(featured('<Example id="plain" />\n')).toEqual({
            id: "plain",
            variant: "inline",
        });
    });

    test("none when the landing has no <Example>", () => {
        expect(featured("# Nothing live here\n")).toBeUndefined();
    });
});

describe("the carousel's slides, from the fixtures", () => {
    // a copy, so a landing can change under the build-time reads (lib/projects.ts)
    const sources = mkdtempSync(join(tmpdir(), "www-featured-"));
    cpSync(join(ROOT, "fixtures"), sources, { recursive: true });
    process.env.FRAGIOLA_SOURCES = sources;
    const landing = (slug: string) => join(sources, slug, "docs", "index.mdx");

    test("one per project with a landing <Example>, in projects.json order", async () => {
        const { featuredExamples } = await import("../lib/projects.ts");
        const slides = featuredExamples();
        expect(slides.map((slide) => [slide.project.slug, slide.id])).toEqual([
            ["ui", "clickable"],
            ["dockable", "hello-layout"],
            // its landing has a bleed example first, then the showcase
            ["data-grid", "large-dataset"],
            ["grid-layout", "hello-grid"],
            ["dnd", "hello-dnd"],
            ["tree", "file-explorer"],
            ["splitter", "basic-horizontal"],
        ]);
        const dockable = slides[1];
        expect(dockable?.theme).toBe("terminal");
        expect(dockable?.landing).toBe("/dockable/");
        expect(dockable?.gallery).toBe("/dockable/examples/hello-layout/");
        expect(Object.keys(dockable?.variants ?? {})).toContain("react");
    });

    test("a changed landing changes its slide, and one with no <Example> has none", async () => {
        const { featuredExamples } = await import("../lib/projects.ts");
        const grid = landing("data-grid");
        writeFileSync(
            grid,
            readFileSync(grid, "utf-8").replace(
                /<Example id="large-dataset"[^\n]*\n/,
                "",
            ),
        );
        const dnd = landing("dnd");
        writeFileSync(
            dnd,
            readFileSync(dnd, "utf-8").replace(/<Example [^\n]*\n/g, ""),
        );
        const slides = featuredExamples();
        expect(
            slides.find((slide) => slide.project.slug === "data-grid")?.id,
        ).toBe("hello-grid");
        expect(slides.map((slide) => slide.project.slug)).not.toContain("dnd");
    });

    test("the palette section: palettes, else none", async () => {
        const { paletteExample } = await import("../lib/projects.ts");
        const manifest = join(sources, "ui", "embed", "react", "manifest.json");
        const original = readFileSync(manifest, "utf-8");
        const rename = (from: string, to: string) =>
            writeFileSync(
                manifest,
                readFileSync(manifest, "utf-8").replace(
                    `"id": "${from}"`,
                    `"id": "${to}"`,
                ),
            );
        // the fixture's ui exports palettes
        const palettes = paletteExample();
        expect(palettes?.project.slug).toBe("ui");
        expect(palettes?.id).toBe("palettes");
        expect(palettes?.gallery).toBe("/ui/examples/palettes/");
        expect(palettes?.variants.react?.height).toBe(360);
        expect(Object.keys(palettes?.variants ?? {})).toEqual(["react"]);
        // no palettes example: no section
        rename("palettes", "something-else");
        expect(paletteExample()).toBeUndefined();
        writeFileSync(manifest, original);
    });
});
