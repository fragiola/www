import { expect, test } from "@playwright/test";
import { PROJECTS } from "./helpers";

// The agent index (lib/agents.ts) as a static server serves it: what `fragiola mcp` and other AI
// agents read. Its shape is checked by tests/agents.test.ts; here, that the files are served.

test("the agent index, the Markdown pages and llms.txt are served", {
    tag: "@serve",
}, async ({ request }) => {
    const response = await request.get("agents/index.json");
    expect(response.ok()).toBe(true);
    const index = (await response.json()) as {
        version: number;
        overview: string;
        projects: {
            slug: string;
            kind: string;
            pages: { markdown: string }[];
        }[];
    };
    expect(index.version).toBe(1);
    expect(index.projects.map((project) => project.slug)).toEqual(
        PROJECTS.map(({ project }) => project.slug),
    );
    expect(index.projects.find((project) => project.slug === "ui")?.kind).toBe(
        "registry",
    );

    const overview = await request.get(index.overview.slice(1));
    expect(overview.ok()).toBe(true);
    expect(await overview.text()).toContain("Two kinds of components");

    for (const project of index.projects) {
        const first = project.pages[0];
        if (!first) continue;
        const page = await request.get(first.markdown.slice(1));
        expect(page.ok(), first.markdown).toBe(true);
        expect((await page.text()).startsWith("# ")).toBe(true);
    }

    const llms = await request.get("llms.txt");
    expect(llms.ok()).toBe(true);
    expect(await llms.text()).toContain(
        "[Agent index](https://fragiola.com/agents/index.json)",
    );
});
