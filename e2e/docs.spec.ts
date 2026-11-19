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

// from dockable's docs, a term of ui's: the search crosses projects (the index itself holds
// every project's terms, below)
test('search finds "palette-danger" across projects', async ({ page }) => {
    const errors = collectErrors(page);
    const dialog = await search(page, "palette-danger");
    await expect(
        dialog
            .getByRole("button")
            .filter({ hasText: /palette-danger/i })
            .first(),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/ui\/docs\/.+\//);
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("body")).toContainText(/palette-danger/i);
    expect(errors).toEqual([]);
});

test("the static search index covers every project and the landings", {
    tag: "@serve",
}, async ({ request }) => {
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
        "data-grid/docs/getting-started/first-grid/",
    ]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    expect(errors).toEqual([]);
});

test("/<slug>/docs opens the first page", { tag: "@serve" }, async ({
    page,
}) => {
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
    // client-side, from the docs' layout into the gallery's
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

test("the sidebar follows the framework, with sections for one framework only; an inline example missing in it says so", async ({
    page,
}) => {
    await page.goto("dockable/docs/guides/popouts/");
    await expectReady(page.locator('[data-example="popout"]'));
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
    // an inline example missing in the selected framework says so
    await expect(
        page.locator(
            '[data-example="popout"][data-testid="missing-framework"]',
        ),
    ).toContainText("not available for Vue yet");
    // <Framework name="vue"> shows its children, <Example framework="vue"> its embed
    await sidebar.getByRole("link", { name: "Dockable for Vue" }).click();
    await expect(page.getByText("You are reading the Vue guide")).toBeVisible();
    await expectReady(page.locator('[data-example="hello-layout"]'));
    // a project with one framework has no select
    await page.goto("ui/docs/atoms/clickable/");
    await expect(page.getByTestId("framework-select")).toHaveCount(0);
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

// The docs sidebar (components/docs-sidebar.tsx): inset rows, the current page a filled pill, the
// icons a project names (§3.1, v1.4), the "Documentation" label level with the collapse toggle.

test("the sidebar draws the icons a project names, and none for a project that names none", async ({
    page,
}) => {
    await page.goto("ui/docs/atoms/clickable/");
    const sidebar = page.locator("#nd-sidebar");
    for (const icon of ["rocket", "download", "atom", "menu"]) {
        await expect(sidebar.locator(`svg.lucide-${icon}`)).toHaveCount(1);
    }
    // the current page: aria-current, a filled pill, no indicator line
    const current = sidebar.getByRole("link", { name: "Clickable" });
    await expect(current).toHaveAttribute("aria-current", "page");
    const pill = await current.evaluate((link) => {
        const style = getComputedStyle(link);
        const line = getComputedStyle(link, "::before");
        return {
            background: style.backgroundColor,
            line: line.content,
        };
    });
    expect(pill.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(pill.line).toBe("none");

    // dockable names no icon: its rows draw none, an external link only its trailing mark
    await page.goto("dockable/docs/getting-started/installation/");
    const rows = page.locator("#nd-sidebar a");
    await expect(rows.first()).toBeVisible();
    await expect(rows.locator("svg:not(.lucide-external-link)")).toHaveCount(0);
    await expect(
        page
            .locator("#nd-sidebar")
            .getByRole("link", { name: "Found a problem?" })
            .locator("svg.lucide-external-link"),
    ).toHaveCount(1);
});

test("the sidebar's label and its collapse toggle share a row, the toggle at its end", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("ui/docs/getting-started/installation/");
    const sidebar = page.locator("#nd-sidebar");
    const label = sidebar.locator("[data-sidebar-title]");
    const toggle = sidebar.getByRole("button", { name: /collapse sidebar/i });
    const [l, t, s] = await Promise.all([
        label.evaluate((node) => node.getBoundingClientRect().toJSON()),
        toggle.evaluate((node) => node.getBoundingClientRect().toJSON()),
        sidebar.evaluate((node) => node.getBoundingClientRect().toJSON()),
    ]);
    const centre = (r: { top: number; height: number }) => r.top + r.height / 2;
    expect(Math.abs(centre(l) - centre(t))).toBeLessThanOrEqual(1);
    // the toggle ends the row, well away from the label
    expect(t.left - (l.left + l.width)).toBeGreaterThan(24);
    expect(s.right - (t.left + t.width)).toBeLessThan(24);

    await toggle.click();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
});

// A docs page's look (components/docs-page-header.tsx, .docs-* in app/globals.css): the section
// as an eyebrow with its icon, the entrance that never hides anything, tables that scroll inside
// their frame on a phone.

test("the page header: the section as an eyebrow, with its icon when the section names one", async ({
    page,
}) => {
    await page.goto("ui/docs/getting-started/installation/");
    const eyebrow = page.locator("#nd-page [data-docs-eyebrow]");
    await expect(eyebrow).toHaveText("Getting Started");
    await expect(eyebrow.locator("svg.lucide-rocket")).toHaveCount(1);
    // no breadcrumb besides it
    await expect(page.locator("#nd-page")).not.toContainText(
        "Getting StartedGetting Started",
    );

    await page.goto("dockable/docs/getting-started/installation/");
    await expect(page.locator("#nd-page [data-docs-eyebrow]")).toHaveText(
        "Getting started",
    );
    await expect(page.locator("#nd-page [data-docs-eyebrow] svg")).toHaveCount(
        0,
    );
});

test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("the page does not animate in", async ({ page }) => {
        await page.goto("dockable/docs/getting-started/installation/");
        for (const selector of ["[data-docs-header]", ".docs-body"]) {
            const animation = await page
                .locator(selector)
                .evaluate((node) => getComputedStyle(node).animationName);
            expect(animation).toBe("none");
        }
    });
});

test("after the entrance, nothing of the page is left transformed or hidden", async ({
    page,
}) => {
    await page.goto("dockable/docs/getting-started/installation/");
    const body = page.locator(".docs-body");
    await expect
        .poll(() =>
            body.evaluate((node) => {
                const style = getComputedStyle(node);
                return `${style.opacity} ${style.transform}`;
            }),
        )
        .toBe("1 none");
});

test("small screens: a wide table scrolls inside its frame, the page does not", async ({
    page,
}) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("dockable/docs/getting-started/installation/");
    const table = page.locator(".docs-body table").first();
    const { scroll, client } = await table.evaluate((node) => ({
        scroll: node.scrollWidth,
        client: node.clientWidth,
    }));
    expect(scroll).toBeGreaterThanOrEqual(client);
    const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(0);
});

// The inset layout (from md, .site-docs in app/globals.css): the header, the sidebar and the
// gutters are one frame, the page sits on a raised, rounded panel; phones keep a flat page.

async function box(page: Page, selector: string) {
    return page
        .locator(selector)
        .first()
        .evaluate((node) => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                background: style.backgroundColor,
                radius: Number.parseFloat(style.borderTopLeftRadius),
            };
        });
}

test("inset: the header and the sidebar are the frame, the page a rounded panel inset into it", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("dockable/docs/getting-started/installation/");
    const frame = await box(page, ".site-docs");
    const header = await box(page, '[data-testid="site-header"]');
    const sidebar = await box(page, "#nd-sidebar");
    const panel = await box(page, ".docs-inset-panel");
    expect(header.background).toBe(frame.background);
    // the sidebar has no surface of its own: the frame shows through it
    expect(sidebar.background).toBe("rgba(0, 0, 0, 0)");
    expect(
        await page
            .locator("#nd-sidebar")
            .evaluate((node) => getComputedStyle(node).borderInlineEndWidth),
    ).toBe("0px");
    expect(panel.background).not.toBe(frame.background);
    expect(panel.radius).toBeGreaterThan(0);
    // after the sidebar, below the header, short of the viewport's end
    expect(panel.left).toBeGreaterThanOrEqual(sidebar.right - 1);
    const headerBottom = await page
        .locator('[data-testid="site-header"]')
        .evaluate((node) => node.getBoundingClientRect().bottom);
    expect(panel.top).toBeGreaterThanOrEqual(headerBottom - 1);
    expect(1280 - panel.right).toBeGreaterThan(4);

    // collapsed: still inset from the frame
    await page
        .locator("#nd-sidebar")
        .getByRole("button", { name: /collapse sidebar/i })
        .click();
    await expect(page.locator("#nd-sidebar")).toHaveAttribute(
        "data-collapsed",
        "true",
    );
    await expect
        .poll(async () => (await box(page, ".docs-inset-panel")).left)
        .toBeGreaterThan(4);
    expect(1280 - (await box(page, ".docs-inset-panel")).right).toBeGreaterThan(
        4,
    );
});

test("inset: the sidebar's rows are square-ish, not pills", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("ui/docs/atoms/clickable/");
    const current = page
        .locator("#nd-sidebar")
        .getByRole("link", { name: "Clickable" });
    const radius = await current.evaluate((node) =>
        Number.parseFloat(getComputedStyle(node).borderTopLeftRadius),
    );
    expect(radius).toBeGreaterThan(0);
    expect(radius).toBeLessThanOrEqual(8);
});

test("small screens: no frame and no panel, the page is one surface", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("dockable/docs/getting-started/installation/");
    await expect(page.locator(".docs-inset-panel")).toBeHidden();
    const [frame, body] = await Promise.all([
        box(page, ".site-docs"),
        box(page, "body"),
    ]);
    // the docs paint nothing over the page's own surface
    expect(frame.background).toBe("rgba(0, 0, 0, 0)");
    expect(body.background).not.toBe("rgba(0, 0, 0, 0)");
});
