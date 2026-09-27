import { expect, test } from "@playwright/test";
import {
    collectErrors,
    DOCKABLE,
    embed,
    expectReady,
    mark,
    marked,
    UI,
} from "./helpers";

// The site around the projects: the organization's landing from the project.json files, each
// project's landing (§3.5), client-side navigation between projects, and the registry at /r
// (§7).

test("the landing lists every project from its project.json", async ({
    page,
}) => {
    const errors = collectErrors(page);
    await page.goto("");
    const projects = page.getByRole("list", { name: "Projects" });
    for (const { project } of [UI, DOCKABLE]) {
        const item = projects.locator(`[data-project="${project.slug}"]`);
        await expect(
            item.getByRole("link", { name: project.title }),
        ).toHaveAttribute("href", `/${project.slug}/`);
        await expect(item).toContainText(project.description);
    }
    await expect(projects.locator('[data-project="dockable"]')).toContainText(
        "React · Vue",
    );
    expect(errors).toEqual([]);
});

test("moving between projects never reloads the page", async ({ page }) => {
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
    // the header's project links: from ui's docs to dockable's landing, then its gallery
    await page
        .getByRole("link", { name: "Dockable", exact: true })
        .first()
        .click();
    await expect(page).toHaveURL(/\/dockable\/$/);
    await page.getByRole("link", { name: "Browse the 13 examples" }).click();
    await expect(page).toHaveURL(/\/dockable\/examples\/hello-layout\/$/);
    await expectReady(page.getByTestId("stage"));
    await page.getByRole("link", { name: "Docs", exact: true }).click();
    await expect(page).toHaveURL(
        /\/dockable\/docs\/getting-started\/installation\/$/,
    );
    expect(await marked(page)).toBe(true);
});

test("a project's landing: the hero, its actions, a live showcase", async ({
    page,
}) => {
    const errors = collectErrors(page);
    await page.goto("dockable/");
    const hero = page.getByTestId("hero");
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText(
        "Dockable panels, without a single line of CSS from us.",
    );
    await expect(
        hero.getByRole("link", { name: "Read the docs" }),
    ).toHaveAttribute("href", "/dockable/docs/getting-started/installation/");
    await expect(
        hero.getByRole("link", { name: "Browse the 13 examples" }),
    ).toHaveAttribute("href", "/dockable/examples/");
    await expect(hero.getByRole("link", { name: "GitHub" })).toHaveAttribute(
        "href",
        "https://github.com/fragiola/dockable",
    );
    const showcase = page.locator('[data-variant="showcase"]');
    await expectReady(showcase);
    // no toolbar, no code panel: the theme switcher and a link to the gallery
    await expect(showcase.getByTestId("toggle-code")).toHaveCount(0);
    await expect(embed(showcase).getByRole("heading")).toHaveText(
        "Hello layout",
    );
    await expect(page).toHaveTitle("Dockable · Fragiola");
    expect(errors).toEqual([]);
});

test("InstallCommand renders the namespaced shadcn command", async ({
    page,
}) => {
    await page.goto("ui/docs/atoms/clickable/");
    await expect(page.getByTestId("install-command")).toContainText(
        "npx shadcn@latest add @fragiola/clickable",
    );
});

test("the registry is served at /r, every project's items in one index", async ({
    request,
}) => {
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

test("an unknown page is a 404 page", async ({ page }) => {
    const response = await page.goto("dockable/docs/nope/");
    expect(response?.status()).toBe(404);
});
