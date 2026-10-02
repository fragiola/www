import { expect, type Page, test } from "@playwright/test";
import { collectErrors, DOCKABLE, expectReady, PROJECTS, UI } from "./helpers";

// The site header (components/site-header.tsx): the same on every page — the wordmark, the
// Projects menu (Fragiola UI's navigation-menu), the project's own context under /<slug>/**,
// search, the theme and GitHub — collapsing into a menu on small screens.

// `current`: the one link of the project's context marked as the current section
const PAGES = [
    { path: "", slug: undefined, current: undefined },
    { path: "ui/", slug: "ui", current: "project" },
    { path: "ui/docs/atoms/clickable/", slug: "ui", current: "Docs" },
    { path: "dockable/", slug: "dockable", current: "project" },
    {
        path: "dockable/docs/getting-started/installation/",
        slug: "dockable",
        current: "Docs",
    },
    {
        path: "dockable/examples/hello-layout/",
        slug: "dockable",
        current: "Examples",
    },
] as const;

const header = (page: Page) => page.getByTestId("site-header");
const site = (page: Page) =>
    header(page).getByRole("navigation", { name: "Site" });
// the Projects menu's list, in its popup (a landing may list the projects too)
const menu = (page: Page) =>
    page
        .locator('[data-slot="navigation-menu-popup"]')
        .getByRole("list", { name: "Projects" });

for (const { path, slug, current } of PAGES) {
    test(`the header on /${path}`, async ({ page }) => {
        const errors = collectErrors(page);
        await page.goto(path);
        await expect(
            header(page).getByRole("link", { name: "Fragiola", exact: true }),
        ).toHaveAttribute("href", "/");
        await expect(
            site(page).getByRole("button", { name: "Projects" }),
        ).toBeVisible();
        await expect(
            header(page)
                .getByRole("button", { name: /search/i })
                .first(),
        ).toBeVisible();
        await expect(header(page).locator("[data-theme-toggle]")).toBeVisible();
        const project = slug === "ui" ? UI : slug ? DOCKABLE : undefined;
        await expect(
            header(page).getByRole("link", { name: "GitHub" }),
        ).toHaveAttribute(
            "href",
            project?.project.repository ?? "https://github.com/fragiola",
        );
        if (project) {
            await expect(
                site(page).getByRole("link", {
                    name: project.project.title,
                    exact: true,
                }),
            ).toHaveAttribute("href", `/${project.project.slug}/`);
            await expect(
                site(page).getByRole("link", { name: "Docs", exact: true }),
            ).toBeVisible();
            // the first example: /<slug>/examples/ only redirects to it
            await expect(
                site(page).getByRole("link", { name: "Examples", exact: true }),
            ).toHaveAttribute(
                "href",
                `/${project.project.slug}/examples/${project.ordered[0]?.id}/`,
            );
            // the current section is marked, and only it
            for (const [section, name] of [
                ["project", project.project.title],
                ["Docs", "Docs"],
                ["Examples", "Examples"],
            ] as const) {
                const link = site(page).getByRole("link", {
                    name,
                    exact: true,
                });
                if (section === current) {
                    await expect(link).toHaveAttribute("aria-current", "page");
                } else {
                    await expect(link).not.toHaveAttribute(
                        "aria-current",
                        /.*/,
                    );
                }
            }
        } else {
            await expect(
                site(page).getByRole("link", { name: "Docs", exact: true }),
            ).toHaveCount(0);
        }
        expect(errors).toEqual([]);
    });
}

test("the Projects menu lists every project and marks the current one", async ({
    page,
}) => {
    await page.goto("dockable/docs/getting-started/installation/");
    await site(page).getByRole("button", { name: "Projects" }).click();
    const list = menu(page);
    await expect(list).toBeVisible();
    const links = list.getByRole("link");
    await expect(links).toHaveCount(PROJECTS.length);
    for (const { project } of PROJECTS) {
        const link = list.getByRole("link", {
            name: new RegExp(project.title),
        });
        await expect(link).toHaveAttribute("href", `/${project.slug}/`);
        await expect(link).toContainText(project.description);
    }
    await expect(
        list.getByRole("link", { name: new RegExp(DOCKABLE.project.title) }),
    ).toHaveAttribute("data-current", "");
    await expect(
        list.getByRole("link", { name: new RegExp(UI.project.title) }),
    ).not.toHaveAttribute("data-current", /.*/);
});

test("the Projects menu works from the keyboard", async ({ page }) => {
    await page.goto("");
    const trigger = site(page).getByRole("button", { name: "Projects" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const list = menu(page);
    await expect(list).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await expect(trigger).toBeFocused();
    // a visible focus ring, in the ring role
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveCSS("outline-style", "solid");
    // Space opens it too, and the arrows move into it
    await page.keyboard.press("Space");
    await expect(list).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await page.keyboard.press("ArrowDown");
    await expect(list).toBeVisible();
    await page.keyboard.press("Escape");
});

test("small screens: the header collapses into a menu", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto("dockable/examples/hello-layout/");
    await expect(site(page)).toBeHidden();
    await header(page).getByRole("button", { name: "Menu" }).click();
    const nav = site(page);
    await expect(nav).toBeVisible();
    await expect(
        nav.getByRole("link", { name: "Examples", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
        nav.getByRole("link", { name: "Docs", exact: true }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: "GitHub" })).toHaveAttribute(
        "href",
        DOCKABLE.project.repository ?? "",
    );
    await nav.getByRole("link", { name: new RegExp(UI.project.title) }).click();
    await expect(page).toHaveURL(/\/ui\/$/);
    await expect(site(page)).toBeHidden();
    const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(375);
});

test("small screens: the docs keep the page's full width; Escape or a press outside closes the menu", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto("ui/docs/atoms/clickable/");
    const title = page.getByRole("heading", { level: 1 });
    const box = await title.boundingBox();
    // the article spans the viewport less its gutters, not a squeezed column
    const article = await page.locator("#nd-page").boundingBox();
    expect(article?.width ?? 0).toBeGreaterThan(330);
    expect(box?.x ?? 0).toBeLessThan(40);

    const button = header(page).getByRole("button", { name: "Menu" });
    await button.click();
    await expect(site(page)).toBeVisible();
    // focus went into the menu
    await expect(site(page).getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(site(page)).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");

    // a press on the page, then one inside an example's iframe
    await button.click();
    await expect(site(page)).toBeVisible();
    // a point of the page outside the header (its menu included), on nothing that acts: taller,
    // so that the page shows below the open menu and the example's frame
    await page.setViewportSize({ width: 375, height: 1400 });
    const below = await page.evaluate(() => {
        for (let y = 2; y < window.innerHeight; y += 4) {
            const target = document.elementFromPoint(24, y);
            if (
                target &&
                !target.closest(
                    '[data-testid="site-header"], a, button, iframe, input, summary',
                )
            )
                return { x: 24, y };
        }
        return null;
    });
    if (!below) throw new Error("no point of the page that acts on nothing");
    await page.mouse.click(below.x, below.y);
    await expect(site(page)).toBeHidden();
    await expect(page).toHaveURL(/\/ui\/docs\/atoms\/clickable\/$/);
    await page.setViewportSize({ width: 375, height: 740 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const example = await expectReady(page.locator("[data-example]").first());
    await button.click();
    await expect(site(page)).toBeVisible();
    // a point of the page's first example, below the open menu
    const frame = await example.locator("iframe").boundingBox();
    const menu = await site(page).boundingBox();
    if (!frame || !menu) throw new Error("no example, or no menu");
    const y = Math.max(frame.y + 10, menu.y + menu.height + 10);
    expect(y).toBeLessThan(Math.min(frame.y + frame.height, 740));
    const x = frame.x + frame.width / 2;
    expect(
        await page.evaluate(
            ([px, py]) => document.elementFromPoint(px ?? 0, py ?? 0)?.tagName,
            [x, y],
        ),
    ).toBe("IFRAME");
    await page.mouse.click(x, y);
    await expect(site(page)).toBeHidden();
});

test("small screens: the gallery's list and the site menu never open together", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto("dockable/examples/hello-layout/");
    const list = page.getByRole("navigation", { name: "Examples" });
    const menu = header(page).getByRole("button", { name: "Menu" });
    await menu.click();
    await expect(site(page)).toBeVisible();
    await header(page).getByRole("button", { name: "Examples list" }).click();
    await expect(list).toBeVisible();
    await expect(site(page)).toBeHidden();
    // the list is the Sidebar's Drawer, modal: the page behind it, the menu with it, is out of
    // reach until it closes
    await expect(menu).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await menu.click();
    await expect(site(page)).toBeVisible();
    await expect(list).toBeHidden();
});

test("closing search gives focus back to the button that opened it", async ({
    page,
}) => {
    await page.goto("dockable/docs/getting-started/installation/");
    const button = header(page).locator("[data-search-full]");
    await button.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(button).toBeFocused();
});

test("small screens: a heading opened by its hash clears the bars above it", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto(
        "dockable/docs/getting-started/installation/#what-to-import-from-where",
    );
    const heading = page.locator("#what-to-import-from-where");
    await expect(heading).toBeInViewport();
    // the lowest sticky bar: the table of contents' popover under the docs' own bar
    const bars = await page.evaluate(() =>
        Math.max(
            ...[...document.querySelectorAll("header, [class*='toc-popover']")]
                .filter((el) => getComputedStyle(el).position === "sticky")
                .map((el) => el.getBoundingClientRect().bottom),
        ),
    );
    const box = await heading.boundingBox();
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(bars);
});
