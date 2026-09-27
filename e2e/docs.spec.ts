import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { collectErrors, expectReady } from "./helpers";

// The pages (§3), ported from dockable's docs e2e/docs.spec.ts: the static search, the pages
// rendering without errors, the <Example> card, no broken internal link in the export; plus the
// v1 vocabulary and the base-free links rewritten under /<slug>.

const OUT = join(import.meta.dirname, "..", "out");

async function search(page: Page, query: string) {
    await page.goto("dockable/docs/getting-started/installation/");
    await page
        .getByRole("button", { name: /search/i })
        .first()
        .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Search").fill(query);
    return dialog;
}

for (const [query, project] of [
    ["popoutURL", "dockable"],
    ["palette-danger", "ui"],
] as const) {
    test(`search finds "${query}" across projects`, async ({ page }) => {
        const errors = collectErrors(page);
        const dialog = await search(page, query);
        await expect(
            dialog
                .getByRole("button")
                .filter({ hasText: new RegExp(query, "i") })
                .first(),
        ).toBeVisible();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(new RegExp(`/${project}/docs/.+/`));
        await expect(page.getByRole("dialog")).toBeHidden();
        await expect(page.locator("body")).toContainText(
            new RegExp(query, "i"),
        );
        expect(errors).toEqual([]);
    });
}

test("the static search index covers every project and the landings", async ({
    request,
}) => {
    const response = await request.get("api/search");
    expect(response.ok()).toBe(true);
    const index = await response.text();
    for (const term of [
        "popoutURL",
        "palette-danger",
        '"/dockable/"',
        '"/ui/"',
    ]) {
        expect(index).toContain(term);
    }
});

test("pages render without errors", async ({ page }) => {
    const errors = collectErrors(page);
    for (const path of [
        "ui/docs/getting-started/installation/",
        "ui/docs/atoms/clickable/",
        "ui/docs/menus/dropdown-menu/",
        "dockable/docs/getting-started/installation/",
        "dockable/docs/getting-started/first-layout/",
        "dockable/docs/guides/popouts/",
        "dockable/docs/guides/vue/",
    ]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    expect(errors).toEqual([]);
});

test("/<slug>/docs opens the first page", async ({ page }) => {
    await page.goto("ui/docs/");
    await expect(page).toHaveURL(/\/ui\/docs\/getting-started\/installation\//);
});

test("base-free links are served under the project", async ({ page }) => {
    await page.goto("dockable/docs/getting-started/first-layout/");
    const body = page.locator("#nd-page");
    await expect(
        body.getByRole("link", { name: "hello-layout", exact: true }),
    ).toHaveAttribute("href", "/dockable/examples/hello-layout/");
    await expect(
        body.getByRole("link", { name: "the installation notes" }),
    ).toHaveAttribute(
        "href",
        "/dockable/docs/getting-started/installation/#server-rendering",
    );
    await expect(
        body.getByRole("link", { name: "what you have", exact: true }),
    ).toHaveAttribute("href", "#what-you-have");
    // a link inside the site navigates client-side
    await page.evaluate(() => {
        (window as unknown as { marker: boolean }).marker = true;
    });
    await body.getByRole("link", { name: "the installation notes" }).click();
    await expect(page).toHaveURL(
        /\/dockable\/docs\/getting-started\/installation\/#server-rendering$/,
    );
    expect(
        await page.evaluate(
            () => (window as unknown as { marker?: boolean }).marker,
        ),
    ).toBe(true);
});

test("an Example card links the gallery", async ({ page }) => {
    await page.goto("dockable/docs/getting-started/first-layout/");
    const card = page.locator('a[data-example-link="popout"]');
    await expect(card).toContainText("Open the live example");
    await expect(card).toHaveAttribute("href", "/dockable/examples/popout/");
    await card.click();
    await expect(page).toHaveURL(/\/dockable\/examples\/popout\//);
    await expectReady(page.getByTestId("stage"));
});

test("the vocabulary: Callout title, Steps, Tabs, code block titles, Cards", async ({
    page,
}) => {
    await page.goto("dockable/docs/getting-started/installation/");
    const body = page.locator("#nd-page");
    await expect(
        body.getByText("Not on npm yet", { exact: true }),
    ).toBeVisible();
    await expect(body.locator(".fd-steps .fd-step")).toHaveCount(3);
    await expect(
        body.getByRole("tab", { name: "npm", exact: true }),
    ).toBeVisible();
    await page.goto("ui/docs/getting-started/installation/");
    await expect(
        page.locator("figure").getByText("components.json"),
    ).toBeVisible();
    await page.goto("ui/");
    const cards = page.getByTestId("landing").locator("a", {
        hasText: "Installation",
    });
    await expect(cards.first()).toHaveAttribute(
        "href",
        "/ui/docs/getting-started/installation/#add-the-registry",
    );
});

test("the sidebar follows the framework, with sections for one framework only", async ({
    page,
}) => {
    await page.goto("dockable/docs/getting-started/installation/");
    const sidebar = page.locator("#nd-sidebar");
    await expect(sidebar.getByRole("link", { name: "Popouts" })).toBeVisible();
    await expect(
        sidebar.getByRole("link", { name: "Dockable for Vue" }),
    ).toHaveCount(0);
    await expect(
        sidebar.getByRole("link", { name: "Found a problem?" }),
    ).toHaveAttribute("href", "https://github.com/fragiola/dockable/issues");
    await page.getByTestId("framework-select").first().selectOption("vue");
    await expect(
        sidebar.getByRole("link", { name: "Dockable for Vue" }),
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Popouts" })).toHaveCount(0);
    // <Framework name="vue"> shows its children, <Example framework="vue"> its embed
    await sidebar.getByRole("link", { name: "Dockable for Vue" }).click();
    await expect(page.getByText("You are reading the Vue guide")).toBeVisible();
    await expectReady(page.locator('[data-example="hello-layout"]'));
    // a project with one framework has no select
    await page.goto("ui/docs/atoms/clickable/");
    await expect(page.getByTestId("framework-select")).toHaveCount(0);
});

test("an inline example missing in the selected framework says so", async ({
    page,
}) => {
    await page.goto("dockable/docs/guides/popouts/");
    await expectReady(page.locator('[data-example="popout"]'));
    await page.getByTestId("framework-select").first().selectOption("vue");
    await expect(
        page.locator(
            '[data-example="popout"][data-testid="missing-framework"]',
        ),
    ).toContainText("not available for Vue yet");
});

test("the export has no broken internal link", () => {
    const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((name) => {
            const path = join(dir, name);
            return statSync(path).isDirectory() ? walk(path) : [path];
        });
    const pages = walk(OUT).filter(
        (file) => file.endsWith(".html") && !file.includes("/embed/"),
    );
    expect(pages.length).toBeGreaterThan(20);
    const broken: string[] = [];
    for (const file of pages) {
        const html = readFileSync(file, "utf-8");
        for (const match of html.matchAll(/href="(\/[^"]*)"/g)) {
            const [target = "", hash] = (match[1] ?? "").split("#");
            const path = target.split("?")[0] ?? "";
            if (path.startsWith("//") || path.startsWith("/_next/")) continue;
            const served = path.endsWith("/")
                ? join(OUT, path, "index.html")
                : join(OUT, path);
            if (!existsSync(served)) {
                broken.push(`${relative(OUT, file)} → ${path}`);
            } else if (
                hash &&
                served.endsWith(".html") &&
                !readFileSync(served, "utf-8").includes(`id="${hash}"`)
            ) {
                broken.push(`${relative(OUT, file)} → ${path}#${hash}`);
            }
        }
    }
    expect(broken).toEqual([]);
});
