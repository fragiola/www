import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { FrameworkLogo } from "@/components/framework-logo";
import { frameworkName } from "@/lib/frameworks";

// The landing's adapters row (CONTRACT.md §2, v1.5) takes any adapter a project lists: a known
// framework draws its brand mark, any other a neutral box, and its name is capitalised.

const draw = (name: string) =>
    renderToStaticMarkup(createElement(FrameworkLogo, { name }));

test("a known framework draws its mark in its brand colour", () => {
    for (const name of [
        "vanilla",
        "react",
        "vue",
        "angular",
        "svelte",
        "preact",
        "solid",
    ]) {
        const svg = draw(name);
        expect(svg).toContain(`data-logo="${name}"`);
        expect(svg).toMatch(/fill="#[0-9A-F]{6}"/);
        expect(svg).toContain('aria-hidden="true"');
    }
});

test("an unknown adapter draws the fallback and keeps a readable name", () => {
    expect(draw("qwik")).toContain('data-logo="fallback"');
    expect(frameworkName("qwik")).toBe("Qwik");
    expect(frameworkName("vanilla")).toBe("Vanilla JS");
});
