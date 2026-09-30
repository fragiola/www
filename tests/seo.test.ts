import { describe, expect, test } from "vitest";
import type { Project } from "../lib/projects.ts";
import {
    exampleDescription,
    metaDescription,
    withProject,
} from "../lib/seo.ts";

// The strings lib/seo.ts builds for search results (CONTRACT.md §3.6): titles of at most 60
// characters, meta descriptions of 50–160 as plain text, whatever a manifest holds.

const length = (text: string) => [...text].length;

describe("titles", () => {
    test("· project, then · Fragiola while it fits in 60", () => {
        expect(withProject("Popouts", "Dockable")).toBe(
            "Popouts · Dockable · Fragiola",
        );
        expect(withProject("Tabs", "Fragiola UI")).toBe("Tabs · Fragiola UI");
        const long = "A".repeat(45);
        expect(withProject(long, "Dockable")).toBe(`${long} · Dockable`);
        const longer = "A".repeat(52);
        expect(withProject(longer, "Dockable examples")).toBe(longer);
    });

    test("a head longer than 60 on its own is cut", () => {
        const title = withProject(
            "An example title ".repeat(5).trim(),
            "Dockable",
        );
        expect(length(title)).toBe(60);
        expect(title.endsWith("…")).toBe(true);
    });
});

describe("meta descriptions", () => {
    test("plain text: code marks dropped", () => {
        expect(
            metaDescription(
                "One surface, three exports: `Button`, `Link` and `ExternalLink`.",
            ),
        ).toBe("One surface, three exports: Button, Link and ExternalLink.");
    });

    test("a text that fits is kept whole, exactly 160 included", () => {
        const text = `${"x".repeat(159)}.`;
        expect(metaDescription(text)).toBe(text);
    });

    test("a longer text is cut at its last sentence that fits, even one ending at 160", () => {
        const first = `First sentence ${"a".repeat(36)}.`;
        const second = ` Second ${"b".repeat(160 - length(first) - 9)}.`;
        const text = `${first}${second} Third sentence.`;
        expect(length(first + second)).toBe(160);
        expect(metaDescription(text)).toBe(first + second);
    });

    test("else at a word, with an ellipsis", () => {
        const text = `${"word ".repeat(40)}end`;
        const meta = metaDescription(text);
        expect(length(meta)).toBeLessThanOrEqual(160);
        expect(meta).toMatch(/word…$/);
    });

    test("never under 50: a hard cut when the word cut would be too short", () => {
        const meta = metaDescription(
            `Short intro sentence. ${"x".repeat(200)}`,
        );
        expect(length(meta)).toBe(160);
        expect(meta.endsWith("…")).toBe(true);
    });

    test("an example's short description says what the page is", () => {
        const project = { title: "Dockable" } as Project;
        expect(exampleDescription("Tabs.", project)).toBe(
            "Tabs. A live Dockable example in the Fragiola gallery, with its source code.",
        );
        // whatever the manifest holds, at least 50 characters
        expect(
            length(exampleDescription("", { title: "UI" } as Project)),
        ).toBeGreaterThanOrEqual(50);
        const long = "A layout with every tab you could ever want in it.";
        expect(exampleDescription(long, project)).toBe(long);
    });
});
