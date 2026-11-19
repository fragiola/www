import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { collectErrors, DOCKABLE, expectReady, PROJECTS, UI } from "./helpers";

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
// icons a project names (§3.1, v1.4), the wordmark level with the collapse toggle.

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
    // the page rows (Fumadocs' items, data-active), not the chrome above and below them
    const rows = page.locator("#nd-sidebar a[data-active]");
    await expect(rows.first()).toBeVisible();
    await expect(rows.locator("svg:not(.lucide-external-link)")).toHaveCount(0);
    await expect(
        page
            .locator("#nd-sidebar")
            .getByRole("link", { name: "Found a problem?" })
            .locator("svg.lucide-external-link"),
    ).toHaveCount(1);
});

test("the sidebar's wordmark and its collapse toggle share a row, the toggle at its end", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("ui/docs/getting-started/installation/");
    const sidebar = page.locator("#nd-sidebar");
    const label = sidebar.getByRole("link", { name: "Fragiola", exact: true });
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

test("inset: the sidebar is the frame, the page a rounded panel inset into it", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("dockable/docs/getting-started/installation/");
    const frame = await box(page, ".site-docs");
    const sidebar = await box(page, "#nd-sidebar");
    const panel = await box(page, ".docs-inset-panel");
    // the sidebar has no surface of its own: the frame shows through it
    expect(sidebar.background).toBe("rgba(0, 0, 0, 0)");
    expect(
        await page
            .locator("#nd-sidebar")
            .evaluate((node) => getComputedStyle(node).borderInlineEndWidth),
    ).toBe("0px");
    expect(panel.background).not.toBe(frame.background);
    expect(panel.radius).toBeGreaterThan(0);
    // after the sidebar, short of the viewport's top and end
    expect(panel.left).toBeGreaterThanOrEqual(sidebar.right - 1);
    expect(panel.top).toBeGreaterThan(4);
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

// The docs' chrome (rule 9, components/docs-chrome.tsx): no site header; the sidebar at the
// viewport's left edge, its top the same for every project (the project switcher, search, Docs |
// Examples), its footer the GitHub links; the theme in the panel's top-right corner.

test("the docs have no site header; the sidebar sits on the left edge at any width", async ({
    page,
}) => {
    for (const width of [1280, 1920, 2560]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("dockable/docs/getting-started/installation/");
        await expect(page.getByTestId("site-header")).toHaveCount(0);
        const sidebar = await page
            .locator("#nd-sidebar")
            .evaluate((node) => node.getBoundingClientRect().toJSON());
        expect(sidebar.left).toBeLessThanOrEqual(1);
        // the panel takes the rest of the width
        const panel = await box(page, ".docs-inset-panel");
        expect(width - panel.right).toBeLessThan(24);
    }
    // the landings and the gallery keep it
    await page.goto("dockable/");
    await expect(page.getByTestId("site-header")).toBeVisible();
});

test("the project switcher lists every project, marks the current one and goes to its docs", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("dockable/docs/getting-started/installation/");
    const trigger = page.getByTestId("project-switcher");
    await expect(trigger).toContainText(DOCKABLE.project.title);
    await trigger.click();
    const menu = page.getByTestId("project-switcher-menu");
    for (const { project } of PROJECTS) {
        await expect(
            menu.getByRole("menuitem", {
                name: new RegExp(`^${project.title}`),
            }),
        ).toContainText(project.description.slice(0, 20));
    }
    await expect(
        menu.getByRole("menuitem", {
            name: new RegExp(`^${DOCKABLE.project.title}`),
        }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
        menu.getByRole("menuitem", { name: "All projects" }),
    ).toHaveAttribute("href", "/");
    // from the keyboard: Escape closes it and gives focus back to the trigger
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await menu
        .getByRole("menuitem", { name: new RegExp(`^${UI.project.title}`) })
        .click();
    await expect(page).toHaveURL(/\/ui\/docs\/getting-started\//);
    await expect(page.getByTestId("project-switcher")).toContainText(
        UI.project.title,
    );
});

test("the sidebar's top: search, Docs | Examples; its footer: the project's GitHub and Fragiola's", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("dockable/docs/getting-started/installation/");
    const top = page.getByTestId("docs-sidebar-top");
    // search opens from the field, and focus goes back to it
    const field = top.locator("[data-search-full]");
    await field.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(field).toBeFocused();
    // and from the keyboard
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(
        top.getByRole("link", { name: "Docs", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
        top.getByRole("link", { name: "Examples", exact: true }),
    ).toHaveAttribute("href", `/dockable/examples/${DOCKABLE.ordered[0]?.id}/`);

    const footer = page.getByTestId("docs-sidebar-footer");
    await expect(
        footer.getByRole("link", { name: "Dockable on GitHub" }),
    ).toHaveAttribute("href", DOCKABLE.project.repository ?? "");
    await expect(
        footer.getByRole("link", { name: "Fragiola on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/fragiola");
});

test("the theme toggle sits in the panel's top-right corner and switches the theme", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("dockable/docs/getting-started/installation/");
    const corner = page.getByTestId("docs-corner");
    const toggle = corner.locator("[data-theme-toggle]");
    await expect(toggle).toBeVisible();
    const [c, panel] = await Promise.all([
        corner.evaluate((node) => node.getBoundingClientRect().toJSON()),
        box(page, ".docs-inset-panel"),
    ]);
    expect(c.right).toBeLessThanOrEqual(panel.right);
    expect(panel.right - c.right).toBeLessThan(32);
    expect(c.top - panel.top).toBeLessThan(32);
    // it covers nothing of the table of contents
    const toc = await page
        .getByText("On this page", { exact: true })
        .first()
        .evaluate((node) => node.getBoundingClientRect().toJSON());
    expect(c.bottom).toBeLessThanOrEqual(toc.top);

    const dark = () =>
        page.evaluate(() =>
            document.documentElement.classList.contains("dark"),
        );
    const before = await dark();
    await toggle.click();
    await expect.poll(dark).toBe(!before);
});

test("small screens: the bar carries the wordmark, search and the theme; the drawer the switcher and the GitHub links", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("dockable/docs/getting-started/installation/");
    await expect(page.getByTestId("site-header")).toHaveCount(0);
    const bar = page.locator("header").first();
    await expect(
        bar.getByRole("link", { name: "Fragiola", exact: true }),
    ).toBeVisible();
    await expect(
        bar.getByRole("button", { name: "Open search" }),
    ).toBeVisible();
    await expect(bar.locator("[data-theme-toggle]")).toBeVisible();
    await expect(page.getByTestId("docs-corner")).toBeHidden();
    // the article spans the viewport less its gutters, not a squeezed column
    const article = await page.locator("#nd-page").boundingBox();
    expect(article?.width ?? 0).toBeGreaterThan(340);

    await page
        .locator('button[aria-controls="nd-sidebar-mobile"]')
        .first()
        .click();
    const drawer = page.locator("#nd-sidebar-mobile");
    await expect(drawer.getByTestId("project-switcher")).toBeVisible();
    await expect(
        drawer.getByRole("link", { name: "Fragiola on GitHub" }),
    ).toBeVisible();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
        ),
    ).toBeLessThanOrEqual(0);
});
