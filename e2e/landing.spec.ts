import { expect, test } from "@playwright/test";
import {
    collectErrors,
    embed,
    expectReady,
    recordMessages,
    setSiteTheme,
} from "./helpers";

// Contract v1.1: the landing vocabulary (§3.4) and the project's footer (§3.5), the sidebar's
// collapsible sections (§3.1), the docs pages' breadcrumb and page footer (embeds addressed by
// their directory, §5.1: embeds.spec.ts). The fixtures' landings use every piece: ui's the grid
// hero, the numbered features and sections with an eyebrow; dockable's the {examples} token, the
// showcase, four features across and the struck-out pills.

test("the hero: eyebrow, grid background, actions by variant and icon", async ({
    page,
}) => {
    const errors = collectErrors(page);
    await page.goto("ui/");
    const hero = page.getByTestId("hero");
    await expect(hero.getByTestId("eyebrow")).toHaveText(
        "Base UI · Tailwind v4 · copy & paste",
    );
    await expect(hero.getByTestId("eyebrow")).toHaveCSS(
        "text-transform",
        "uppercase",
    );
    await expect(hero).toHaveAttribute("data-background", "grid");
    await expect(hero.getByTestId("hero-grid")).toBeAttached();
    // the primary action: Fragiola UI's solid button in palette-blue, with its arrow
    const primary = hero.getByRole("link", { name: "Read the documentation" });
    await expect(primary).toHaveAttribute("data-variant", "primary");
    await expect(primary).toHaveClass(/\bpalette-blue\b/);
    await expect(primary.locator("svg")).toHaveCount(1);
    const background = await primary.evaluate(
        (link) => getComputedStyle(link).backgroundColor,
    );
    expect(background).not.toBe("rgba(0, 0, 0, 0)");
    await expect(hero.getByRole("link", { name: "Examples" })).toHaveAttribute(
        "data-variant",
        "secondary",
    );
    // dockable's: no background, {examples} counted, an external ghost action
    await page.goto("dockable/");
    const other = page.getByTestId("hero");
    await expect(other.getByRole("heading", { level: 1 })).toHaveText(
        "Dockable panels, without a single line of CSS from us.",
    );
    await expect(other).toHaveAttribute("data-background", "none");
    await expect(other.getByTestId("hero-grid")).toHaveCount(0);
    await expect(
        other.getByRole("link", { name: "Read the docs" }),
    ).toHaveAttribute("href", "/dockable/docs/getting-started/installation/");
    const browse = other.getByRole("link", { name: "Browse the 13 examples" });
    await expect(browse).toHaveAttribute("data-variant", "secondary");
    await expect(browse).toHaveAttribute("href", "/dockable/examples/");
    const github = other.getByRole("link", { name: "GitHub" });
    await expect(github).toHaveAttribute(
        "href",
        "https://github.com/fragiola/dockable",
    );
    await expect(github).toHaveAttribute("data-variant", "ghost");
    await expect(github).toHaveAttribute("target", "_blank");
    await expect(github).toHaveAttribute("rel", "noreferrer noopener");
    expect(errors).toEqual([]);
});

test("sections with an eyebrow, numbered features, the entrance on scroll", async ({
    page,
}) => {
    await page.goto("ui/");
    const sections = page.getByTestId("landing-section");
    await expect(sections).toHaveCount(3);
    const why = sections.first();
    await expect(why.getByTestId("eyebrow")).toHaveText("Why it exists");
    await expect(why.getByRole("heading", { level: 2 })).toHaveText(
        "Three problems, three decisions",
    );
    const features = why.getByTestId("features");
    await expect(features).toHaveAttribute("data-columns", "3");
    // 01, 02, 03 from a CSS counter: drawn (the computed content is the counter itself)
    const numbers = await features
        .locator("[data-feature-number]")
        .evaluateAll((spans) =>
            spans.map((span) => ({
                content: getComputedStyle(span, "::before").content,
                width: span.getBoundingClientRect().width,
            })),
        );
    expect(numbers).toHaveLength(3);
    for (const number of numbers) {
        expect(number.content).toBe(
            "counter(landing-feature, decimal-leading-zero)",
        );
        expect(number.width).toBeGreaterThan(0);
    }
    // three across
    const tops = await features
        .locator("li")
        .evaluateAll((items) =>
            items.map((item) => Math.round(item.getBoundingClientRect().top)),
        );
    expect(new Set(tops).size).toBe(1);
    // the entrance is a scroll-driven animation
    await expect(why.locator(".landing-reveal").first()).toHaveCSS(
        "animation-name",
        "landing-reveal",
    );
});

test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the entrance does not run", async ({ page }) => {
        await page.goto("ui/");
        const reveal = page.locator(".landing-reveal").first();
        await expect(reveal).toHaveCSS("animation-name", "none");
        await expect(reveal).toHaveCSS("opacity", "1");
    });
});

test("four features across, struck-out pills", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("dockable/");
    const features = page.getByTestId("features");
    await expect(features).toHaveAttribute("data-columns", "4");
    await expect(features.locator("li")).toHaveCount(4);
    const tops = await features
        .locator("li")
        .evaluateAll((items) =>
            items.map((item) => Math.round(item.getBoundingClientRect().top)),
        );
    expect(new Set(tops).size).toBe(1);
    // not numbered
    await expect(
        features.locator("[data-feature-number]").first(),
    ).toBeHidden();
    const pills = page.getByTestId("pills");
    await expect(pills).toHaveAttribute("data-strike", "");
    await expect(pills.locator("li s")).toHaveText([
        "CSS",
        "Icons",
        "Text",
        "Rendered menus",
    ]);
    await expect(pills.locator("s").first()).toHaveCSS(
        "text-decoration-line",
        "line-through",
    );
});

test("the showcase: a live demo, the theme switcher over it, kept whatever the site's theme, and See the code", async ({
    page,
}) => {
    const errors = collectErrors(page);
    await recordMessages(page);
    await setSiteTheme(page, "light");
    await page.goto("dockable/");
    const showcase = page.locator('[data-variant="showcase"]');
    await expect(showcase).toContainText("Same markup, four themes:");
    await expectReady(showcase);
    // no toolbar, no code panel: the theme switcher and a link to the gallery
    await expect(showcase.getByTestId("toggle-code")).toHaveCount(0);
    await expect(embed(showcase).getByRole("heading")).toHaveText(
        "Hello layout",
    );
    const options = showcase.locator("[data-theme-option]");
    await expect(options).toHaveCount(4);
    // swatches, and the page's theme as the initial one
    await expect(
        options.first().locator("span[aria-hidden] > span"),
    ).not.toHaveCount(0);
    await expect(
        showcase.locator('[data-theme-option="terminal"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(embed(showcase).locator("html")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
    // a theme set by the page is kept whatever the site's theme
    await page.locator("[data-theme-toggle]:visible").first().click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(embed(showcase).locator("html")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
    // another theme reaches the embed without a reload, and the link follows it
    await showcase.locator('[data-theme-option="paper"]').click();
    await expect(embed(showcase).locator("html")).toHaveAttribute(
        "data-example-theme",
        "paper",
    );
    // messages arrive in order: the only theme the embed was sent is the switcher's, none for
    // the site's dark
    const sent = await embed(showcase)
        .locator("html")
        .evaluate(() =>
            (
                window as unknown as { messages: { type: string }[] }
            ).messages.filter((m) => m.type === "fragiola:example:theme"),
        );
    expect(sent).toEqual([{ type: "fragiola:example:theme", theme: "paper" }]);
    expect(errors).toEqual([]);
    const code = showcase.getByTestId("see-the-code");
    await expect(code).toHaveText("See the code →");
    await expect(code).toHaveAttribute(
        "href",
        "/dockable/examples/hello-layout/?theme=paper&code=1",
    );
    await code.click();
    await expect(page).toHaveURL(/\/dockable\/examples\/hello-layout\/\?/);
    await expect(
        page.getByRole("complementary", { name: "Example code" }),
    ).toBeVisible();
    await expect(page.locator('[data-theme-option="paper"]')).toHaveAttribute(
        "aria-pressed",
        "true",
    );
});

test("the project's footer, on the landing and on every docs page", async ({
    page,
}) => {
    for (const path of ["dockable/", "dockable/docs/guides/popouts/"]) {
        await page.goto(path);
        const footer = page.getByTestId("project-footer");
        await expect(footer).toBeVisible();
        await expect(
            footer.getByRole("link", { name: "Dockable", exact: true }),
        ).toHaveAttribute("href", "/dockable/");
        await expect(footer).toContainText(
            "A headless layout manager for dockable panels",
        );
        // the first sidebar section
        const first = footer.getByRole("navigation", {
            name: "Getting started",
        });
        await expect(first.getByRole("link")).toHaveText([
            "Installation",
            "Your first layout",
        ]);
        await expect(
            first.getByRole("link", { name: "Installation" }),
        ).toHaveAttribute(
            "href",
            "/dockable/docs/getting-started/installation/",
        );
        await expect(
            footer.getByRole("link", { name: "GitHub" }),
        ).toHaveAttribute("href", "https://github.com/fragiola/dockable");
    }
    // below the page, not above it
    const footerTop = await page
        .getByTestId("project-footer")
        .evaluate((footer) => footer.getBoundingClientRect().top);
    const titleTop = await page
        .getByRole("heading", { level: 1 })
        .evaluate((title) => title.getBoundingClientRect().top);
    expect(footerTop).toBeGreaterThan(titleTop);
});

test("collapsible sidebar sections: closed, open by default, open on their own pages", async ({
    page,
}) => {
    await page.goto("ui/docs/getting-started/installation/");
    const sidebar = page.locator("#nd-sidebar");
    // Atoms: collapsible, defaultOpen; Menus: collapsible, closed
    await expect(
        sidebar.getByRole("link", { name: "Clickable" }),
    ).toBeVisible();
    await expect(
        sidebar.getByRole("link", { name: "Dropdown Menu" }),
    ).toBeHidden();
    await sidebar.getByRole("button", { name: "Menus" }).click();
    await expect(
        sidebar.getByRole("link", { name: "Dropdown Menu" }),
    ).toBeVisible();
    // a section that does not fold has no button
    await expect(
        sidebar.getByRole("button", { name: "Getting Started" }),
    ).toHaveCount(0);
    // the current page's section always opens
    await page.goto("ui/docs/menus/dropdown-menu/");
    await expect(
        sidebar.getByRole("link", { name: "Dropdown Menu" }),
    ).toBeVisible();
});

test("a docs page: the section above the title, the next page's description below", async ({
    page,
}) => {
    await page.goto("dockable/docs/getting-started/installation/");
    const article = page.locator("#nd-page");
    const title = article.getByRole("heading", { level: 1 });
    const crumb = article.getByText("Getting started", { exact: true });
    await expect(crumb).toBeVisible();
    const [crumbTop, titleTop] = await Promise.all([
        crumb.evaluate((node) => node.getBoundingClientRect().top),
        title.evaluate((node) => node.getBoundingClientRect().top),
    ]);
    expect(crumbTop).toBeLessThan(titleTop);
    const next = article.getByRole("link", {
        name: /^Your first layout From a JSON/,
    });
    await expect(next).toContainText(
        "From a JSON model to a resizable, draggable layout",
    );
    await next.click();
    await expect(page).toHaveURL(
        /\/dockable\/docs\/getting-started\/first-layout\/$/,
    );
});
