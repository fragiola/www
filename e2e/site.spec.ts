import { expect, test } from "@playwright/test";
import {
    collectErrors,
    expectReady,
    mark,
    marked,
    PROJECTS,
    UI,
} from "./helpers";

// The site around the projects: the organization's landing from the project.json files, each
// project's landing (§3.5), client-side navigation between projects, and the registry at /r
// (§7).

/** Projects that are not in projects.json (not published): no page may name them. */
const UNPUBLISHED = ["Scheduler"];

test("moving between projects never reloads the page", {
    tag: "@serve",
}, async ({ page }) => {
    await page.goto("");
    await mark(page);
    await page
        .locator('[data-project="ui"]')
        .getByRole("link", { name: "Fragiola UI" })
        .click();
    await expect(page).toHaveURL(/\/ui\/$/);
    await expect(page.getByTestId("hero")).toBeVisible();
    await page.getByRole("link", { name: "Read the documentation" }).click();
    await expect(page).toHaveURL(
        /\/ui\/docs\/getting-started\/installation\/$/,
    );
    // the header's Projects menu: from ui's docs to dockable's landing, then its gallery
    await page
        .getByTestId("site-header")
        .getByRole("button", { name: "Projects" })
        .click();
    const menu = page.locator('[data-slot="navigation-menu-popup"]');
    await menu.getByRole("link", { name: /^Dockable/ }).click();
    await expect(page).toHaveURL(/\/dockable\/$/);
    // the menu closes with the navigation
    await expect(menu.getByRole("list", { name: "Projects" })).toBeHidden();
    await page.getByRole("link", { name: "Browse the 13 examples" }).click();
    await expect(page).toHaveURL(/\/dockable\/examples\/hello-layout\/$/);
    await expectReady(page.getByTestId("stage"));
    await page.getByRole("link", { name: "Docs", exact: true }).click();
    await expect(page).toHaveURL(
        /\/dockable\/docs\/getting-started\/installation\/$/,
    );
    expect(await marked(page)).toBe(true);
});

test("InstallCommand renders the namespaced shadcn command", async ({
    page,
}) => {
    await page.goto("ui/docs/atoms/clickable/");
    await expect(page.getByTestId("install-command")).toContainText(
        "npx shadcn@latest add @fragiola/clickable",
    );
});

test("the registry is served at /r, every project's items in one index", {
    tag: "@serve",
}, async ({ request }) => {
    const index = await request.get("r/index.json");
    expect(index.ok()).toBe(true);
    const { items } = (await index.json()) as {
        items: { name: string; registryDependencies?: string[] }[];
    };
    expect(items.map((item) => item.name)).toEqual(
        expect.arrayContaining(["theme", "cn", "clickable", "dropdown-menu"]),
    );
    for (const item of items) {
        for (const dependency of item.registryDependencies ?? []) {
            expect(dependency).toMatch(/^(@fragiola\/|https?:)/);
        }
    }
    const item = await request.get("r/clickable.json");
    expect(item.ok()).toBe(true);
    expect(
        ((await item.json()) as { files: unknown[] }).files.length,
    ).toBeGreaterThan(0);
});

test("the organization's landing: what Fragiola is first, the idea, your stack, Fragiola UI, the projects", async ({
    page,
}) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("");
    const hero = page.getByTestId("hero");
    await expect(hero.getByRole("heading", { level: 1 })).toBeInViewport();
    const lead = hero.locator("p").filter({ hasText: /ecosystem/ });
    await expect(lead).toContainText("headless components");
    await expect(lead).toContainText("optional");
    const explore = hero.getByRole("link", { name: "Explore the projects" });
    await expect(explore).toBeInViewport();
    await expect(explore).toHaveAttribute("href", "#projects");
    await expect(
        hero.getByRole("link", { name: `Meet ${UI.project.title}` }),
    ).toHaveAttribute("href", `/${UI.project.slug}/`);
    await explore.click();
    await expect(page.locator("#projects")).toBeInViewport();
    await expect(page).toHaveTitle(/^Fragiola/);

    // every project, from its project.json
    const projects = page.getByRole("list", { name: "Projects" });
    for (const { project } of PROJECTS) {
        const item = projects.locator(`[data-project="${project.slug}"]`);
        await expect(
            item.getByRole("link", { name: project.title }),
        ).toHaveAttribute("href", `/${project.slug}/`);
        await expect(item).toContainText(project.description);
    }
    await expect(projects.locator('[data-project="dockable"]')).toContainText(
        "React · Vue",
    );

    // the idea, your stack, Fragiola UI, the projects
    const titles = page
        .getByTestId("landing-section")
        .getByRole("heading", { level: 2 });
    await expect(titles).toHaveText([
        "The behaviour from us, the look from wherever you like",
        "Paint it with what you already use",
        UI.project.title,
        "What Fragiola ships today",
    ]);
    const spotlight = page.getByTestId("landing-section").filter({
        has: page.getByRole("heading", {
            level: 2,
            name: UI.project.title,
            exact: true,
        }),
    });
    await expect(spotlight).toContainText(UI.project.description);
    await expect(
        spotlight.getByRole("link", { name: `Explore ${UI.project.title}` }),
    ).toHaveAttribute("href", `/${UI.project.slug}/`);
    await expect(
        spotlight.getByRole("link", { name: "Read the docs" }),
    ).toHaveAttribute("href", /^\/ui\/docs\/.+\/$/);
    // only what exists: no project that is not published is named, anywhere
    const published = PROJECTS.map(({ project }) => project.title).join(" ");
    for (const name of UNPUBLISHED) expect(published).not.toContain(name);
    const unpublished = new RegExp(UNPUBLISHED.join("|"));
    await expect(page.locator("body")).not.toContainText(unpublished);
    expect(await page.title()).not.toMatch(unpublished);
    expect(
        await page.locator('meta[name="description"]').getAttribute("content"),
    ).not.toMatch(unpublished);
    // the footer lists every project and the organization
    const footer = page.getByTestId("site-footer");
    for (const { project } of PROJECTS) {
        await expect(
            footer.getByRole("link", { name: project.title }),
        ).toHaveAttribute("href", `/${project.slug}/`);
    }
    await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute(
        "href",
        "https://github.com/fragiola",
    );
    expect(errors).toEqual([]);
});

for (const width of [375, 768, 1440]) {
    test(`no page scrolls sideways at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        for (const path of [
            "",
            "ui/",
            "dockable/",
            "ui/docs/atoms/clickable/",
            "dockable/examples/hello-layout/",
        ]) {
            await page.goto(path);
            const scrollWidth = await page.evaluate(
                () => document.documentElement.scrollWidth,
            );
            expect(scrollWidth, path).toBeLessThanOrEqual(width);
        }
    });
}
