import { expect, type Page, test } from "@playwright/test";
import { collectErrors, embed, expectReady, PROJECTS } from "./helpers";

// "See it live" on the organization's landing (components/landing/live-preview.tsx): a tabbed
// carousel of every project's landing example (its showcase, else its first <Example>: the
// fixtures' data-grid landing has a bleed example first, then the showcase), one example iframe
// at a time, created on activation after hydration.

// projects.json order; the example each fixture landing features
const SLIDES: [string, string][] = [
    ["ui", "clickable"],
    ["dockable", "hello-layout"],
    ["data-grid", "large-dataset"],
    ["grid-layout", "hello-grid"],
    ["dnd", "hello-dnd"],
    ["tree", "file-explorer"],
    ["splitter", "basic-horizontal"],
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
    for (const [index, [slug]] of SLIDES.entries()) {
        const project = PROJECTS.find((p) => p.project.slug === slug)?.project;
        await expect(tabs.nth(index)).toContainText(project?.title ?? slug);
        await expect(tabs.nth(index)).toContainText(project?.description ?? "");
    }
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    const slide = live.getByRole("tabpanel");
    await expect(slide).toHaveCount(1);
    await expect(slide).toHaveAttribute("aria-roledescription", "slide");
    await expect(slide).toHaveAttribute("aria-label", /^1 of 7: Fragiola UI$/);
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
    }
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

    // previous / next
    await live.getByRole("button", { name: "Next project" }).click();
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await live.getByRole("button", { name: "Previous project" }).click();
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    // the tab list scrolls sideways: the chosen tab is brought into view
    await expect(tabs.last()).toBeInViewport({ ratio: 1 });

    // from the selected tab, Tab goes on to the buttons, the slide's links, then the embed
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

test("Fragiola UI's slide explains the palette demo: one class, no variants", async ({
    page,
}) => {
    const live = await openCarousel(page);
    const note = live.getByTestId("palettes-note");
    await expect(note).toBeVisible();
    await expect(note).toContainText("One class, and the colour changes");
    await expect(note).toContainText("No component has a colour variant");
    await expect(note.locator("code")).toContainText('className="palette-');
    await live.getByRole("tab", { name: /Dockable/ }).click();
    await expect(live.getByTestId("palettes-note")).toHaveCount(0);
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
