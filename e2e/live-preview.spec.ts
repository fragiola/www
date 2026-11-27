import { expect, type Page, test } from "@playwright/test";
import { collectErrors, embed, expectReady, PROJECTS } from "./helpers";

// "See it live" on the organization's landing (components/landing/live-preview.tsx): a tabbed
// carousel of every project's landing example (its showcase, else its first <Example>: the
// fixtures' data-grid landing has a bleed example first, then the showcase), picked from small
// name-only chips, one example iframe at a time, created on activation after hydration; and
// "One class, one palette" (components/landing/palette-section.tsx), Fragiola UI's palettes alone,
// full width, which shares the page's one example iframe with it (live-slot.ts).

// projects.json order; the example each fixture landing features
const SLIDES: [string, string][] = [
    ["ui", "clickable"],
    ["dockable", "hello-layout"],
    ["data-grid", "large-dataset"],
    ["grid-layout", "hello-grid"],
    ["dnd", "hello-dnd"],
    ["tree", "file-explorer"],
    ["splitter", "basic-horizontal"],
    ["flow", "workflow-builder"],
    ["primitives", "dialog"],
    ["calendar", "team-planner"],
];

const carousel = (page: Page) => page.getByTestId("live-preview");
const frames = (page: Page) => page.locator("iframe");

async function openCarousel(page: Page) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("");
    const live = carousel(page);
    await live.scrollIntoViewIfNeeded();
    return live;
}

test("right after the hero: a tab per project, in projects.json order, the first slide live", async ({
    page,
}) => {
    const errors = collectErrors(page);
    const live = await openCarousel(page);
    const titles = page
        .getByTestId("landing-section")
        .getByRole("heading", { level: 2 });
    await expect(titles.first()).toHaveText("See it live");

    await expect(live).toHaveAttribute("aria-roledescription", "carousel");
    const tabs = live
        .getByRole("tablist", { name: "Projects" })
        .getByRole("tab");
    await expect(tabs).toHaveCount(SLIDES.length);
    // name-only chips: no description, no previous/next
    await expect(tabs).toHaveText(
        SLIDES.map(
            ([slug]) =>
                PROJECTS.find((p) => p.project.slug === slug)?.project.title ??
                slug,
        ),
    );
    for (const tab of await tabs.all()) {
        expect((await tab.boundingBox())?.height).toBeLessThanOrEqual(36);
    }
    await expect(live.getByRole("button", { name: /project$/ })).toHaveCount(0);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    const slide = live.getByRole("tabpanel");
    await expect(slide).toHaveCount(1);
    await expect(slide).toHaveAttribute("aria-roledescription", "slide");
    await expect(slide).toHaveAttribute("aria-label", /^1 of 10: Fragiola UI$/);
    const frame = await expectReady(slide);
    await expect(frame).toHaveAttribute("data-example-id", "clickable");
    await expect(frames(page)).toHaveCount(1);
    expect(errors).toEqual([]);
});

test("no example iframe in the static HTML: the frame comes after hydration", async ({
    request,
}) => {
    const html = await (await request.get("")).text();
    expect(html).toContain('data-testid="live-preview"');
    expect(html).not.toMatch(/<iframe/);
});

test("switching slides replaces the one iframe, at the same height, each derived from its landing", async ({
    page,
}) => {
    // about 3s a slide, one per project: ten pass the default 30s
    test.setTimeout(90_000);
    const live = await openCarousel(page);
    const tabs = live.getByRole("tab");
    const stage = live.getByTestId("live-stage");
    await expectReady(live);
    const height = (await stage.boundingBox())?.height;
    expect(height).toBeGreaterThan(0);

    for (const [index, [slug, id]] of SLIDES.entries()) {
        await tabs.nth(index).click();
        await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
        const slide = live.getByRole("tabpanel");
        await expect(slide).toHaveAttribute("data-slide", slug);
        // the stage is there at its height before the embed says ready
        expect((await stage.boundingBox())?.height).toBe(height);
        const frame = await expectReady(slide);
        await expect(frame).toHaveAttribute("data-example-id", id);
        await expect(frames(page)).toHaveCount(1);
        expect((await stage.boundingBox())?.height).toBe(height);
        await expect(slide.getByTestId("live-landing")).toHaveAttribute(
            "href",
            `/${slug}/`,
        );
        await expect(slide.getByTestId("live-gallery")).toHaveAttribute(
            "href",
            `/${slug}/examples/${id}/`,
        );
        // the active project's description and links, above the preview
        const project = PROJECTS.find((p) => p.project.slug === slug)?.project;
        await expect(slide.getByTestId("live-description")).toHaveText(
            project?.description ?? "",
        );
        const caption = await slide.getByTestId("live-caption").boundingBox();
        const top = (await stage.boundingBox())?.y ?? 0;
        expect(caption && caption.y + caption.height <= top).toBe(true);
    }
});

test("wider than the prose column; the chips wrap on a phone, no sideways scroll", async ({
    page,
}) => {
    const live = await openCarousel(page);
    const prose = await page
        .getByTestId("landing-section")
        .filter({ hasText: "The behaviour from us" })
        .locator("p")
        .first()
        .boundingBox();
    const box = await live.boundingBox();
    expect(box?.width).toBeGreaterThan(61 * 16);
    expect(box?.width).toBeGreaterThan(prose?.width ?? 0);

    await page.setViewportSize({ width: 375, height: 800 });
    const tabs = live.getByRole("tab");
    const tops = await tabs.evaluateAll((items) =>
        items.map((item) => Math.round(item.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBeGreaterThan(1);
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true);
});

test("the landing's theme on the slide: dockable's showcase is terminal", async ({
    page,
}) => {
    const live = await openCarousel(page);
    await live.getByRole("tab", { name: /Dockable/ }).click();
    await expectReady(live);
    await expect(embed(live).locator("html")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
});

test("keyboard: Tab reaches the picker, arrows, Home and End move, the embed is reachable", async ({
    page,
}) => {
    const live = await openCarousel(page);
    const tabs = live.getByRole("tab");
    await expectReady(live);
    // one tab stop for the tab list: the selected tab
    await expect(tabs.first()).toHaveAttribute("tabindex", "0");
    await expect(tabs.nth(1)).toHaveAttribute("tabindex", "-1");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");

    // every chip is in view: nothing to scroll to
    for (const tab of await tabs.all()) {
        await expect(tab).toBeInViewport({ ratio: 1 });
    }

    // from the selected tab, Tab goes on to the slide's links, then the embed
    await tabs.last().focus();
    await expectReady(live);
    const iframe = live.locator("iframe");
    let reached = false;
    for (let step = 0; step < 8 && !reached; step++) {
        await page.keyboard.press("Tab");
        reached = await iframe.evaluate(
            (element) => document.activeElement === element,
        );
    }
    expect(reached).toBe(true);
});

test("RTL mirrors the arrows", async ({ page }) => {
    const live = await openCarousel(page);
    await page.evaluate(() =>
        document.documentElement.setAttribute("dir", "rtl"),
    );
    const tabs = live.getByRole("tab");
    await tabs.first().focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
});

test("one class, one palette: ui's palettes alone after the preview, sharing its one iframe", async ({
    page,
}) => {
    const errors = collectErrors(page);
    const live = await openCarousel(page);
    await expectReady(live);
    const section = page.getByTestId("palette-section");
    await expect(section).toHaveAttribute("data-example", "palettes");
    // the demo alone: no aside beside it, the stage as wide as the section, at the meta's height
    await expect(page.getByTestId("palettes-note")).toHaveCount(0);
    await expect(section.locator("aside")).toHaveCount(0);
    const stage = section.getByTestId("palette-stage");
    const [sectionBox, stageBox] = await Promise.all([
        section.boundingBox(),
        stage.boundingBox(),
    ]);
    expect(stageBox?.width).toBeCloseTo(sectionBox?.width ?? 0, 0);
    expect(stageBox?.height).toBeCloseTo(360, 0);

    // scrolled to: the palette runs, the preview pauses; never two frames
    await section.scrollIntoViewIfNeeded();
    await page.evaluate(() =>
        document
            .querySelector('[data-testid="palette-section"]')
            ?.scrollIntoView({ block: "center" }),
    );
    const frame = await expectReady(section);
    await expect(frame).toHaveAttribute("data-example-id", "palettes");
    await expect(frames(page)).toHaveCount(1);
    await expect(live.getByTestId("live-paused")).toBeVisible();

    // a chip takes the frame back at once
    await live.getByRole("tab").nth(1).click();
    await expectReady(live);
    await expect(frames(page)).toHaveCount(1);
    await expect(section.getByTestId("live-paused")).toBeVisible();
    // and "Run it here" gives it to the palette again, without a scroll (which would too)
    await section
        .getByRole("button", { name: "Run it here" })
        .dispatchEvent("click");
    await expectReady(section);
    await expect(frames(page)).toHaveCount(1);
    expect(errors).toEqual([]);
});

test("the framework is the site's choice", async ({ page }) => {
    await page.addInitScript(() => {
        if (window === window.top) {
            localStorage.setItem("@fragiola:framework", "vue");
        }
    });
    const live = await openCarousel(page);
    // tree's fixture has the three frameworks: the slide runs in Vue
    await live.getByRole("tab", { name: /Tree/ }).click();
    const frame = await expectReady(live);
    await expect(frame).toHaveAttribute("data-framework", "vue");
});
