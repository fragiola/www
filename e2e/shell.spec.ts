import { expect, test } from "@playwright/test";
import {
    collectErrors,
    DOCKABLE,
    embed,
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
// example missing in a framework, the theme remembered per project and following the site.

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
    await setSiteTheme(page, "dark");
    const stage = await openExample(page, "dockable", first.id);
    // the first dark theme of examples.json, passed explicitly to the embed
    await expect(stage).toHaveAttribute("data-example-theme", "dark");
    await expect(embed(stage).locator("html")).toHaveAttribute(
        "data-example-theme",
        "dark",
    );
    await expect(stage.locator("iframe")).toHaveAttribute(
        "src",
        /[?&]theme=dark(&|$)/,
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
    const scroller = list.locator(".overflow-y-auto");
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
