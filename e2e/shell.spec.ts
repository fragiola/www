import { expect, test } from "@playwright/test";
import {
    collectErrors,
    DOCKABLE,
    embed,
    expectReady,
    frameMarked,
    mark,
    marked,
    markFrame,
    openExample,
    setSiteTheme,
    UI,
} from "./helpers";

// The gallery (§4), ported from dockable's docs e2e/shell.spec.ts: navigation, theme and code
// state in the URL, the code panel's files and copy buttons, reset, fullscreen, the small-screen
// drawers, the persistent list. Plus what the generic gallery adds: the framework switcher, an
// example missing in a framework, the theme remembered per project and following the site, and
// the list on Fragiola UI's Sidebar (collapsible on desktop, remembered, a Drawer when narrow).

const first = DOCKABLE.ordered[0];
const last = DOCKABLE.ordered.at(-1);
if (!first || !last) throw new Error("no examples in the dockable fixture");

test("/<slug>/examples opens the first example", async ({ page }) => {
    await page.goto("dockable/examples/");
    await expect(page).toHaveURL(new RegExp(`/dockable/examples/${first.id}/`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        first.title,
    );
});

test("lists every example under its level, in order", async ({ page }) => {
    await openExample(page, "dockable", first.id);
    const list = page.getByRole("navigation", { name: "Examples" });
    for (const level of DOCKABLE.examples.levels) {
        const section = list.getByRole("region", {
            name: new RegExp(level.title, "i"),
        });
        const titles = DOCKABLE.ordered
            .filter((example) => example.level === level.id)
            .map((example) => example.title);
        await expect(section.getByRole("link")).toHaveText(titles);
    }
    await expect(
        list.getByRole("link", { name: first.title, exact: true }),
    ).toHaveAttribute("aria-current", "page");
});

test("the filter narrows the list, over titles, descriptions and features", async ({
    page,
}) => {
    await openExample(page, "dockable", first.id);
    const list = page.getByRole("navigation", { name: "Examples" });
    const filter = list.getByRole("searchbox");
    await filter.fill("zzzz-no-match");
    await expect(list.getByText("No example matches.")).toBeVisible();
    await filter.fill("maximizeToggle");
    await expect(list.getByRole("link")).toHaveText(["Maximize"]);
    await filter.fill("native window");
    await expect(list.getByRole("link")).toHaveText(["Pop out"]);
});

test("the header shows the level, the description, the features and the guide", async ({
    page,
}) => {
    await openExample(page, "dockable", first.id);
    const main = page.getByRole("main");
    await expect(main.getByText("Basic", { exact: true })).toBeVisible();
    await expect(main.getByText(first.description)).toBeVisible();
    await expect(
        main.getByRole("list", { name: "Features" }).getByRole("listitem"),
    ).toHaveText(first.features);
    await expect(
        main.getByRole("link", { name: "Read the guide" }),
    ).toHaveAttribute("href", "/dockable/docs/getting-started/first-layout/");
});

test("the theme switcher changes the example's theme and the URL, without a reload", async ({
    page,
}) => {
    // the site opens in dark: start from its light scheme
    await setSiteTheme(page, "light");
    const stage = await openExample(page, "dockable", first.id);
    await expect(stage).toHaveAttribute("data-example-theme", "light");
    await mark(page);
    await markFrame(stage);
    const swatches = page.locator('[data-theme-option="terminal"] span span');
    await expect(swatches).toHaveCount(2);
    await page.locator('[data-theme-option="terminal"]').click();
    await expect(stage).toHaveAttribute("data-example-theme", "terminal");
    // the embed follows through the theme message: same window, new theme
    await expect(embed(stage).locator("html")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
    await expect(embed(stage).locator("html")).toHaveClass(/\bdark\b/);
    expect(await frameMarked(stage)).toBe(true);
    await expect(page).toHaveURL(/theme=terminal/);
    expect(await marked(page)).toBe(true);
    await page.reload();
    await expect(page.getByTestId("stage")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
    await expect(
        embed(page.getByTestId("stage")).locator("html"),
    ).toHaveAttribute("data-example-theme", "terminal");
});

test("the chosen theme is remembered per project", async ({ page }) => {
    // the site opens in dark: start from its light scheme
    await setSiteTheme(page, "light");
    await openExample(page, "dockable", first.id, { theme: "paper" });
    await page.goto(`dockable/examples/${last.id}/`);
    await expect(page.getByTestId("stage")).toHaveAttribute(
        "data-example-theme",
        "paper",
    );
    // another project has its own themes, and its own memory
    await page.goto("ui/examples/clickable/");
    await expect(page.getByTestId("stage")).toHaveAttribute(
        "data-example-theme",
        "light",
    );
});

test("without a chosen theme, the example follows the site's scheme", async ({
    page,
}) => {
    // the site opens in dark: its light scheme shows the example following it
    await setSiteTheme(page, "light");
    const stage = await openExample(page, "dockable", first.id);
    // the first light theme of examples.json, passed explicitly to the embed
    await expect(stage).toHaveAttribute("data-example-theme", "light");
    await expect(embed(stage).locator("html")).toHaveAttribute(
        "data-example-theme",
        "light",
    );
    await expect(stage.locator("iframe")).toHaveAttribute(
        "src",
        /[?&]theme=light(&|$)/,
    );
    await expect(page).not.toHaveURL(/theme=/);
});

test("the code panel shows every file and the theme's CSS, and copies one or all", async ({
    page,
    context,
}) => {
    // the site opens in dark: start from its light scheme
    await setSiteTheme(page, "light");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openExample(page, "dockable", first.id);
    await page.getByTestId("toggle-code").click();
    await expect(page).toHaveURL(/code=1/);
    const panel = page.getByRole("complementary", { name: "Example code" });
    const tabs = panel.getByRole("tablist", { name: "Files" }).getByRole("tab");
    // the example's files, entry first, plus the current theme's CSS
    await expect(tabs).toHaveText([...first.files, "_themes/light.css"]);

    await panel.getByTestId("copy-file").click();
    await expect(panel.getByTestId("copy-file")).toHaveAttribute(
        "data-copied",
        "",
    );
    const one = await page.evaluate(() => navigator.clipboard.readText());
    expect(one).toContain("export default function");

    await panel.getByTestId("copy-all").click();
    const all = await page.evaluate(() => navigator.clipboard.readText());
    for (const file of first.files) expect(all).toContain(`// ${file}\n`);

    await tabs.nth(1).click();
    await expect(panel.getByTestId("code-file")).toHaveAttribute(
        "data-path",
        first.files[1] ?? "",
    );
    // the files are shown verbatim, `#/` imports included (§6)
    await tabs.first().click();
    await expect(panel.getByTestId("code-file")).toContainText(
        'from "../_kit/layout"',
    );

    // the theme's CSS follows the theme
    await page.locator('[data-theme-option="paper"]').click();
    await expect(tabs.last()).toHaveText("_themes/paper.css");

    await page.reload();
    await expect(
        page
            .getByRole("complementary", { name: "Example code" })
            .getByRole("tablist"),
    ).toBeVisible();
});

test("the setup command lists the packages and the namespaced registry items", async ({
    page,
}) => {
    await openExample(page, "dockable", "add-tabs", { code: true });
    const setup = page
        .getByRole("complementary", { name: "Example code" })
        .getByTestId("setup");
    await expect(setup).toHaveText(
        [
            "npm install @fragiola/dockable @fragiola/dockable-react lucide-react",
            "npx shadcn@latest add @fragiola/cn @fragiola/input",
        ].join("\n"),
    );
    await expect(setup).not.toContainText("fields");
});

test("reset reloads the example", async ({ page }) => {
    const stage = await openExample(page, "dockable", first.id);
    const counter = embed(stage).getByTestId("counter");
    await counter.click();
    await counter.click();
    await expect(counter).toHaveText("Count: 2");
    await markFrame(stage);
    await page.getByTestId("reset").click();
    await expect(
        embed(page.getByTestId("stage")).getByTestId("counter"),
    ).toHaveText("Count: 0");
    expect(await frameMarked(page.getByTestId("stage"))).toBeUndefined();
});

test("small screens get drawers for the list and the code", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await openExample(page, "dockable", first.id);
    const list = page.getByRole("navigation", { name: "Examples" });
    await expect(list).toBeHidden();
    await page.getByRole("button", { name: "Examples list" }).click();
    await expect(list).toBeVisible();
    await list.getByRole("link", { name: last.title, exact: true }).click();
    await expect(list).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        last.title,
    );
    await page.getByTestId("toggle-code").click();
    const panel = page.getByRole("complementary", { name: "Example code" });
    await expect(panel).toBeVisible();
    // the panel overlays the stage
    const box = await panel.boundingBox();
    expect(box?.width).toBeGreaterThan(360);
    const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(375);
    await panel.getByRole("button", { name: "Close code" }).click();
    await expect(panel).toBeHidden();
});

test("on desktop the list collapses from the header or Ctrl+B, and stays as the reader left it", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openExample(page, "dockable", first.id);
    const list = page.getByRole("navigation", { name: "Examples" });
    const trigger = page
        .getByTestId("site-header")
        .getByRole("button", { name: "Examples list" });
    const stage = page.getByTestId("stage");
    const width = async () => (await stage.boundingBox())?.width ?? 0;
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const open = await width();

    // the Sidebar's column slides away, out of reach, and the stage takes its room
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(list).toBeHidden();
    await expect.poll(width).toBeGreaterThan(open + 200);

    // remembered across a reload and another example
    await page.reload();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(list).toBeHidden();
    await page.goto(`dockable/examples/${last.id}/`);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Ctrl+B brings it back, except while typing in a field
    await page.keyboard.press("Control+b");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(list).toBeVisible();
    await expect(
        list.getByRole("link", { name: last.title, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await list.getByRole("searchbox").focus();
    await page.keyboard.press("Control+b");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
        await page.evaluate(() =>
            localStorage.getItem("@fragiola:examples-sidebar"),
        ),
    ).toBe("true");
});

test("a collapsed list is painted collapsed by the static page, before any script of the site", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() =>
        localStorage.setItem("@fragiola:examples-sidebar", "false"),
    );
    // no hydration: what shows is the static HTML and its inline scripts
    await page.route("**/_next/static/chunks/**/*.js", (route) =>
        route.abort(),
    );
    await page.goto(`dockable/examples/${first.id}/`);
    await expect(page.locator("html")).toHaveAttribute(
        "data-examples-list",
        "collapsed",
    );
    const column = page.locator('[data-slot="sidebar"][data-state]');
    expect((await column.boundingBox())?.width).toBe(0);
    await expect(
        page.getByRole("navigation", { name: "Examples" }),
    ).toBeHidden();
});

test("a collapsed list stays collapsed on a client-side navigation into the gallery", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() =>
        localStorage.setItem("@fragiola:examples-sidebar", "false"),
    );
    await page.goto("dockable/");
    await mark(page);
    // the widest the column is painted, every frame from here on
    await page.evaluate(() => {
        const w = window as unknown as { widest: number };
        w.widest = 0;
        const frame = () => {
            for (const column of document.querySelectorAll(
                '[data-slot="sidebar"][data-state]',
            )) {
                w.widest = Math.max(
                    w.widest,
                    column.getBoundingClientRect().width,
                );
            }
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    });
    await page
        .getByTestId("site-header")
        .getByRole("link", { name: "Examples", exact: true })
        .click();
    await expectReady(page.getByTestId("stage"));
    expect(await marked(page)).toBe(true);
    await expect(
        page.getByRole("button", { name: "Examples list" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
        await page.evaluate(
            () => (window as unknown as { widest: number }).widest,
        ),
    ).toBe(0);
});

test("small screens: the Drawer keeps the filter and the scroll between openings", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 400 });
    await openExample(page, "dockable", first.id);
    const trigger = page.getByRole("button", { name: "Examples list" });
    const list = page.getByRole("navigation", { name: "Examples" });
    await trigger.click();
    const scroller = list.locator('[data-slot="sidebar-content"]');
    await scroller.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    const scrolled = await scroller.evaluate((element) => element.scrollTop);
    expect(scrolled).toBeGreaterThan(0);
    await list.getByRole("link", { name: last.title, exact: true }).click();
    await expect(list).toBeHidden();
    await trigger.click();
    await expect(list).toBeVisible();
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(
        scrolled,
    );
    await list.getByRole("searchbox").fill("maximizeToggle");
    await list.getByRole("link", { name: "Maximize" }).click();
    await expect(list).toBeHidden();
    await trigger.click();
    await expect(list.getByRole("searchbox")).toHaveValue("maximizeToggle");
    await expect(list.getByRole("link")).toHaveText(["Maximize"]);
});

test("on desktop the code panel is resized by its handle, by pointer or keyboard, and keeps its width", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openExample(page, "dockable", first.id, { code: true });
    const panel = page.getByRole("complementary", { name: "Example code" });
    const handle = page.getByRole("separator", { name: "Resize the code" });
    const stage = page.getByTestId("stage");
    const width = async () => (await panel.boundingBox())?.width ?? 0;
    await expect(panel).toBeVisible();
    await expect(handle).toBeVisible();
    const before = await width();

    // dragged 200px towards the stage: the code is 200px wider, the stage narrower
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const stageBefore = (await stage.boundingBox())?.width ?? 0;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 100, y, { steps: 5 });
    await page.mouse.move(x - 200, y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(width).toBeGreaterThan(before + 190);
    expect((await stage.boundingBox())?.width ?? 0).toBeLessThan(
        stageBefore - 190,
    );

    // the keyboard moves it too
    const dragged = await width();
    await handle.focus();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(width).toBeGreaterThan(dragged);
    const resized = await width();
    expect(
        Number(
            await page.evaluate(() =>
                localStorage.getItem("@fragiola:code-panel-width"),
            ),
        ),
    ).toBeGreaterThan(0);

    // kept: on another example, closed and reopened, after a reload
    const near = (value: number) => Math.abs(value - resized) < 3;
    await page
        .getByRole("navigation", { name: "Examples" })
        .getByRole("link", { name: last.title, exact: true })
        .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        last.title,
    );
    await expect.poll(async () => near(await width())).toBe(true);
    await page.getByTestId("toggle-code").click();
    await expect(panel).toBeHidden();
    await expect(handle).toBeHidden();
    await page.getByTestId("toggle-code").click();
    await expect.poll(async () => near(await width())).toBe(true);
    await page.reload();
    await expect.poll(async () => near(await width())).toBe(true);

    // bounded: the stage keeps 30% of the row, the code 25%
    const row = (await page.locator("#example-panels").boundingBox())?.width;
    if (!row) throw new Error("no row");
    const drag = async (dx: number) => {
        const at = await handle.boundingBox();
        if (!at) throw new Error("no handle");
        const hx = at.x + at.width / 2;
        const hy = at.y + at.height / 2;
        await page.mouse.move(hx, hy);
        await page.mouse.down();
        await page.mouse.move(hx + dx, hy, { steps: 10 });
        await page.mouse.up();
    };
    await drag(-2000);
    await expect
        .poll(async () => (await stage.boundingBox())?.width ?? 0)
        .toBeGreaterThan(row * 0.3 - 30);
    await drag(2000);
    await expect.poll(width).toBeGreaterThan(row * 0.25 - 3);
    expect(await width()).toBeLessThan(row * 0.25 + 3);
});

test("a resized code panel keeps its share when the row changes, even with no storage", async ({
    page,
}) => {
    await page.addInitScript(() => {
        Storage.prototype.setItem = () => {
            throw new Error("storage is blocked");
        };
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openExample(page, "dockable", first.id, { code: true });
    const panel = page.getByRole("complementary", { name: "Example code" });
    const row = page.locator("#example-panels");
    const share = async () =>
        ((await panel.boundingBox())?.width ?? 0) /
        ((await row.boundingBox())?.width ?? 1);
    const handle = page.getByRole("separator", { name: "Resize the code" });
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle");
    await page.mouse.move(box.x, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const resized = await share();

    // the list collapses (the row widens), then the view renders again (another theme)
    await page.keyboard.press("Control+b");
    await expect(
        page.getByRole("navigation", { name: "Examples" }),
    ).toBeHidden();
    await page.getByRole("button", { name: "Paper" }).click();
    await expect(page.getByTestId("stage")).toHaveAttribute(
        "data-example-theme",
        "paper",
    );
    await expect
        .poll(async () => Math.abs((await share()) - resized))
        .toBeLessThan(0.01);
});

test("on a wide screen the code opens at 46rem, on every example", async ({
    page,
}) => {
    await page.setViewportSize({ width: 2560, height: 1000 });
    await openExample(page, "dockable", first.id, { code: true });
    const panel = page.getByRole("complementary", { name: "Example code" });
    const near736 = async () =>
        Math.abs(((await panel.boundingBox())?.width ?? 0) - 736) < 2;
    await expect.poll(near736).toBe(true);
    await page
        .getByRole("navigation", { name: "Examples" })
        .getByRole("link", { name: last.title, exact: true })
        .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        last.title,
    );
    await expect.poll(near736).toBe(true);
});

test("on a tall screen the code fills the panel, past Fumadocs' 600px", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 1400 });
    await openExample(page, "dockable", first.id, { code: true });
    const panel = page.getByRole("complementary", { name: "Example code" });
    const file = panel.getByRole("tabpanel");
    const viewport = panel.getByTestId("code-file").getByRole("region");
    await expect(viewport).toBeVisible();
    const outer = await file.boundingBox();
    const inner = await viewport.boundingBox();
    expect(outer?.height ?? 0).toBeGreaterThan(600);
    expect(Math.abs((inner?.height ?? 0) - (outer?.height ?? 0))).toBeLessThan(
        2,
    );
});

test("small screens: the code is an overlay, with no handle", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await openExample(page, "dockable", first.id, { code: true });
    const panel = page.getByRole("complementary", { name: "Example code" });
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())?.width).toBeGreaterThan(360);
    await expect(page.getByRole("separator")).toHaveCount(0);
});

test("fullscreen lays the stage over the page with the code open", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openExample(page, "dockable", first.id, { code: true });
    await page.getByRole("button", { name: "Fullscreen" }).click();
    const box = await page.getByTestId("stage").boundingBox();
    expect(box?.width).toBeGreaterThan(1440 - 40);
    expect(box?.height).toBeGreaterThan(900 - 40);
    await page.keyboard.press("Escape");
    await expect(
        page.getByRole("complementary", { name: "Example code" }),
    ).toBeVisible();
});

test("fullscreen lays the stage over the page, and Escape restores it", async ({
    page,
}) => {
    await openExample(page, "dockable", first.id);
    const fullscreen = page.getByRole("button", { name: "Fullscreen" });
    await fullscreen.click();
    await expect(fullscreen).toHaveAttribute("aria-pressed", "true");
    const stage = page.getByTestId("stage");
    const viewport = page.viewportSize();
    const box = await stage.boundingBox();
    expect(box?.width).toBeGreaterThan((viewport?.width ?? 0) - 40);
    expect(box?.height).toBeGreaterThan((viewport?.height ?? 0) - 40);
    await page.keyboard.press("Escape");
    await expect(
        page.getByRole("button", { name: "Fullscreen" }),
    ).toHaveAttribute("aria-pressed", "false");
    const after = await page.getByTestId("stage").boundingBox();
    expect(after?.width).toBeLessThan((viewport?.width ?? 0) - 200);
});

test("the list keeps its scroll, the filter and the theme while moving between examples", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    await openExample(page, "dockable", first.id, { theme: "paper" });
    const list = page.getByRole("navigation", { name: "Examples" });
    const scroller = list.locator('[data-slot="sidebar-content"]');
    await mark(page);

    await scroller.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    const scrolled = await scroller.evaluate((element) => element.scrollTop);
    expect(scrolled).toBeGreaterThan(0);
    const link = list.getByRole("link", { name: last.title, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/dockable/examples/${last.id}/`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        last.title,
    );
    await expect(link).toHaveAttribute("aria-current", "page");
    expect(await scroller.evaluate((element) => element.scrollTop)).toBe(
        scrolled,
    );
    // a client-side navigation (no reload), the theme kept
    expect(await marked(page)).toBe(true);
    await expect(page.getByTestId("stage")).toHaveAttribute(
        "data-example-theme",
        "paper",
    );
    await expect(page).toHaveURL(/theme=paper/);

    // the filter survives a navigation too
    await list.getByRole("searchbox").fill("splitter");
    await list
        .getByRole("link", { name: "Wide splitter", exact: true })
        .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Wide splitter",
    );
    await expect(list.getByRole("searchbox")).toHaveValue("splitter");
    expect(await marked(page)).toBe(true);
});

test("the framework switcher shows another framework's embed, site-wide", async ({
    page,
}) => {
    const errors = collectErrors(page);
    await openExample(page, "dockable", first.id);
    await expect(
        embed(page.getByTestId("stage")).getByTestId("framework"),
    ).toHaveText(`react · ${first.id}`);
    await page.locator('[data-framework-option="vue"]').click();
    await expect(page).toHaveURL(/framework=vue/);
    const stage = page.getByTestId("stage");
    await expect(stage.getByTestId("example-frame")).toHaveAttribute(
        "data-framework",
        "vue",
    );
    await expect(embed(stage).getByTestId("framework")).toHaveText(
        `vue · ${first.id}`,
    );
    // the choice is the site's: the docs follow it
    await page.goto("dockable/docs/getting-started/installation/");
    await expect(page.getByTestId("framework-select").first()).toHaveValue(
        "vue",
    );
    await expect(
        page.getByRole("link", { name: "Dockable for Vue" }).first(),
    ).toBeVisible();
    // a project without Vue shows its default, and keeps the choice for the next one
    await page.goto("ui/examples/clickable/");
    await expect(
        page.getByTestId("stage").getByTestId("example-frame"),
    ).toHaveAttribute("data-framework", "react");
    await expect(page).not.toHaveURL(/framework=/);
    expect(errors).toEqual([]);
});

test("an example missing in the selected framework says so instead of disappearing", async ({
    page,
}) => {
    await page.goto("dockable/examples/popout/?framework=vue");
    const list = page.getByRole("navigation", { name: "Examples" });
    const item = list.getByRole("link", { name: /^Pop out/ });
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute("data-missing", "");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pop out");
    const missing = page.getByTestId("missing-framework");
    await expect(missing).toContainText(
        "“Pop out” is not available for Vue yet.",
    );
    await missing.getByRole("button", { name: "Show it in React" }).click();
    await expect(page).not.toHaveURL(/framework=/);
    await expect(
        page.getByTestId("stage").getByTestId("example-frame"),
    ).toHaveAttribute("data-ready", "");
});

test("a project with one framework has no framework switcher", async ({
    page,
}) => {
    await openExample(page, "ui", UI.ordered[0]?.id ?? "");
    await expect(page.locator("[data-framework-option]")).toHaveCount(0);
    await expect(page.locator("[data-theme-option]")).toHaveCount(
        UI.examples.themes.length,
    );
});
