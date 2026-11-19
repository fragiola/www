import { expect, type Page, test } from "@playwright/test";
import {
    collectErrors,
    DOCKABLE,
    mark,
    marked,
    recordMessages,
    UI,
} from "./helpers";

// The Create page (contract v1.6, §5.5): /<slug>/create/ for a project whose project.json
// declares `create` (ui's fixture, a stand-in create.html), its app in one frame over the whole
// viewport with nothing of the site around it and nothing scrolling the page; ready → host →
// theme, the theme following the site's without a reload; linked from the docs' sidebar, the
// header and the landing's /create action. A project without it (dockable) has none of that.

const CREATE = UI.project.create;
const frameOf = (page: Page) =>
    page.getByTestId("create-frame").locator("iframe");
const app = (page: Page) => frameOf(page).contentFrame();

/** The site's theme stored as "system": the OS scheme decides, and can change while open. */
async function followSystem(page: Page) {
    await page.addInitScript(() => {
        if (window !== window.top) return;
        try {
            localStorage.setItem("@fragiola:theme", "system");
        } catch {}
    });
}

test("the fixture declares a Create page", () => {
    expect(CREATE).toBeDefined();
    expect(DOCKABLE.project.create).toBeUndefined();
});

test("/ui/create/ is the app over the whole viewport, and nothing scrolls the page", async ({
    page,
}) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("ui/create/");
    const frame = page.getByTestId("create-frame");
    await expect(frame).toHaveAttribute("data-ready", "");
    await expect(frameOf(page)).toHaveCSS("opacity", "1");
    await expect(frameOf(page)).toHaveAttribute(
        "allow",
        "clipboard-read; clipboard-write; fullscreen",
    );
    await expect(frameOf(page)).toHaveAttribute(
        "src",
        /^\/ui\/embed\/react\/create\.html\?theme=/,
    );
    await expect(app(page).getByTestId("create-app")).toBeVisible();
    // 100% × 100% of the viewport, and no site chrome around it
    expect(await frameOf(page).boundingBox()).toEqual({
        x: 0,
        y: 0,
        width: 1280,
        height: 720,
    });
    await expect(page.getByTestId("site-header")).toHaveCount(0);
    // the document does not scroll; the app's own area does
    const scrolling = await page.evaluate(() => {
        const root = document.scrollingElement as HTMLElement;
        window.scrollTo(0, 500);
        return {
            overflow: root.scrollHeight - root.clientHeight,
            y: window.scrollY,
        };
    });
    expect(scrolling).toEqual({ overflow: 0, y: 0 });
    const main = app(page).getByTestId("create-main");
    await main.evaluate((element) => element.scrollTo(0, 500));
    expect(await main.evaluate((element) => element.scrollTop)).toBe(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // the same at a phone's size
    await page.setViewportSize({ width: 390, height: 700 });
    expect(await frameOf(page).boundingBox()).toEqual({
        x: 0,
        y: 0,
        width: 390,
        height: 700,
    });
    expect(
        await page.evaluate(() => {
            const root = document.scrollingElement as HTMLElement;
            return root.scrollHeight - root.clientHeight;
        }),
    ).toBe(0);
    expect(errors).toEqual([]);
});

// @serve: a "clean URLs" server drops the query of create.html?theme=…; the message still brings it
test("ready, then host (no promotion) and theme; never resize", {
    tag: "@serve",
}, async ({ page }) => {
    await recordMessages(page);
    await page.goto("ui/create/");
    await expect(page.getByTestId("create-frame")).toHaveAttribute(
        "data-ready",
        "",
    );
    const html = app(page).locator("html");
    await expect(html).toHaveAttribute("data-host", "false");
    await expect(html).toHaveAttribute("data-theme-messages", "1");
    // the site opens in dark: the first dark theme, before the first paint and by message
    await expect(html).toHaveAttribute("data-example-theme", "dark");
    const inFrame = page.frame({ url: /\/ui\/embed\/react\/create/ });
    expect(
        await inFrame?.evaluate(
            () => (window as unknown as { messages: unknown[] }).messages,
        ),
    ).toEqual([
        { type: "fragiola:example:host", overlay: false },
        { type: "fragiola:example:theme", theme: "dark" },
    ]);
    expect(
        await page.evaluate(
            () => (window as unknown as { messages: unknown[] }).messages,
        ),
    ).toEqual([{ type: "fragiola:example:ready", id: "create" }]);
    await expect(frameOf(page)).toHaveCSS("color-scheme", "dark");
});

test("the theme follows the site's without a reload", async ({ page }) => {
    await followSystem(page);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("ui/create/");
    const html = app(page).locator("html");
    await expect(html).toHaveAttribute("data-example-theme", "light");
    await expect(frameOf(page)).toHaveAttribute(
        "src",
        /create\.html\?theme=light$/,
    );
    await mark(page);
    await frameOf(page).evaluate((iframe) => {
        const target = (iframe as HTMLIFrameElement).contentWindow as
            | (Window & { marker?: boolean })
            | null;
        if (target) target.marker = true;
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html).toHaveAttribute("data-example-theme", "dark");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(frameOf(page)).toHaveCSS("color-scheme", "dark");
    // neither the page nor the frame reloaded
    expect(await marked(page)).toBe(true);
    expect(
        await frameOf(page).evaluate(
            (iframe) =>
                (
                    (iframe as HTMLIFrameElement).contentWindow as
                        | (Window & { marker?: boolean })
                        | null
                )?.marker,
        ),
    ).toBe(true);
});

test("the app's link back to the docs opens in the top window", async ({
    page,
}) => {
    await page.goto("ui/create/");
    await app(page).getByTestId("create-docs-link").click();
    await expect(page).toHaveURL(
        /\/ui\/docs\/getting-started\/installation\/$/,
    );
});

test("title, description and canonical URL from lib/seo.ts; in the sitemap", async ({
    page,
    request,
}) => {
    await page.goto("ui/create/");
    await expect(page).toHaveTitle(`${CREATE?.title} · ${UI.project.title}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://fragiola.com/ui/create/",
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        CREATE?.description ?? "",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    const sitemap = await (await request.get("sitemap.xml")).text();
    expect(sitemap).toContain("<loc>https://fragiola.com/ui/create/</loc>");
    expect(sitemap).not.toContain("/dockable/create/");
});

test("the docs' sidebar, the header and the landing link to it", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("ui/docs/getting-started/installation/");
    await expect(
        page
            .getByTestId("docs-sidebar-top")
            .getByRole("link", { name: "Create", exact: true }),
    ).toHaveAttribute("href", "/ui/create/");

    await page.goto("ui/");
    const site = page
        .getByTestId("site-header")
        .getByRole("navigation", { name: "Site" });
    await expect(
        site.getByRole("link", { name: "Create", exact: true }),
    ).toHaveAttribute("href", "/ui/create/");
    // the landing's Hero action, written `/create`
    const action = page.getByRole("link", { name: "Create a theme" });
    await expect(action).toHaveAttribute("href", "/ui/create/");
    await action.click();
    await expect(page).toHaveURL(/\/ui\/create\/$/);
    await expect(page.getByTestId("create-frame")).toHaveAttribute(
        "data-ready",
        "",
    );
});

test("the header's menu has Create on a small screen too", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("ui/");
    await page
        .getByTestId("site-header")
        .getByRole("button", { name: /menu/i })
        .click();
    await expect(
        page
            .getByRole("navigation", { name: "Site" })
            .getByRole("link", { name: "Create", exact: true }),
    ).toHaveAttribute("href", "/ui/create/");
});

test("a project without create has no route and no link", {
    tag: "@serve",
}, async ({ page }) => {
    const response = await page.goto("dockable/create/");
    expect(response?.status()).toBe(404);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("dockable/docs/getting-started/installation/");
    await expect(
        page
            .getByTestId("docs-sidebar-top")
            .getByRole("link", { name: "Create", exact: true }),
    ).toHaveCount(0);
    await page.goto("dockable/");
    await expect(
        page.getByTestId("site-header").getByRole("link", { name: "Create" }),
    ).toHaveCount(0);
});
