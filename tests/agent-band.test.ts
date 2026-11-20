import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createProcessor } from "@mdx-js/mdx";
import type { Root, RootContent } from "mdast";
import type {} from "mdast-util-mdx";
import { describe, expect, test } from "vitest";
import { AGENT_BAND_TAG, remarkAgentBand } from "../lib/agent-band.ts";

// The agent band (CONTRACT.md §3.5, v1.7): once on every landing, right after its top-level
// showcase <Example>, else right after its <Hero>; never on a docs page.

const FIXTURES = join(import.meta.dirname, "../fixtures");

function tree(body: string): Root {
    return createProcessor().parse(body) as Root;
}

function withBand(body: string): string[] {
    const root = tree(body);
    remarkAgentBand()(root);
    return root.children.map(name);
}

function name(node: RootContent): string {
    return node.type === "mdxJsxFlowElement" ? (node.name ?? "") : node.type;
}

function landing(slug: string): string {
    return readFileSync(
        join(FIXTURES, slug, "docs/index.mdx"),
        "utf-8",
    ).replace(/^---\n[\s\S]*?\n---\n/, "");
}

describe("where the band goes", () => {
    test("after the showcase, wherever it is among the top-level nodes", () => {
        const order = withBand(
            '<Hero title="x" />\n\n<Example id="a" variant="bleed" />\n\n<Section title="s">\n</Section>\n\n<Example id="b" variant="showcase" />\n\nText.\n',
        );
        expect(order).toEqual([
            "Hero",
            "Example",
            "Section",
            "Example",
            AGENT_BAND_TAG,
            "paragraph",
        ]);
    });

    test("after the Hero when there is no top-level showcase", () => {
        const order = withBand(
            '<Hero title="x" />\n\n<Section title="s">\n<Example id="a" variant="showcase" />\n</Section>\n',
        );
        expect(order).toEqual(["Hero", AGENT_BAND_TAG, "Section"]);
    });

    test("never on a docs page (no <Hero>)", () => {
        expect(withBand('<Example id="a" variant="showcase" />\n')).toEqual([
            "Example",
        ]);
    });

    test.each([
        ["dockable", "Example"],
        ["data-grid", "Example"],
        ["ui", "Hero"],
        ["tree", "Hero"],
    ])("the %s fixture: once, after its %s", (slug, before) => {
        const order = withBand(landing(slug));
        expect(order.filter((node) => node === AGENT_BAND_TAG)).toHaveLength(1);
        expect(order[order.indexOf(AGENT_BAND_TAG) - 1]).toBe(before);
    });
});
