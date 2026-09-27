import { expect, test } from "@playwright/test";
import {
    embed,
    expectReady,
    frameMarked,
    markFrame,
    messages,
    openExample,
    recordMessages,
    setSiteTheme,
} from "./helpers";

// The embeds as the site drives them (§5): the frame stays hidden until `ready`, its height comes
// from `layout`/`height`/`resize`, its theme from `?theme=` and the `theme` message (the site
// resolves "system"), Reset reloads it, and a popout opened inside it lives under its base.

test("the frame stays hidden until the embed says ready", async ({ page }) => {
    await recordMessages(page);
    // slow-start says ready 1.2 s after its first render
    await page.goto("dockable/examples/slow-start/");
    const frame = page.getByTestId("stage").getByTestId("example-frame");
    const iframe = frame.locator("iframe");
    await expect(
        embed(page.getByTestId("stage")).getByTestId("counter"),
    ).toBeAttached();
    // rendered, not ready: invisible
    await expect(iframe).toHaveCSS("opacity", "0");
    await expect(frame).not.toHaveAttribute("data-ready");
    await expect(frame).toHaveAttribute("data-ready", "", { timeout: 5000 });
    await expect(iframe).toHaveCSS("opacity", "1");
    expect(await messages(page)).toContainEqual({
        type: "fragiola:example:ready",
        id: "slow-start",
    });
});

test("a fill example has its height, a flow example grows with its content", async ({
    page,
}) => {
    await recordMessages(page);
    await page.goto("dockable/docs/getting-started/first-layout/");
    const fill = page.locator(
        '[data-example="hello-layout"][data-variant="inline"]',
    );
    await expectReady(fill);
    // fill: the manifest's height (420), no resize messages
    expect((await fill.locator("iframe").boundingBox())?.height).toBe(420);

    await page.goto("ui/docs/atoms/clickable/");
    const flow = page.locator(
        '[data-example="clickable"][data-variant="inline"]',
    );
    await expectReady(flow);
    const iframe = flow.locator("iframe");
    const content = () =>
        embed(flow)
            .getByTestId("example-root")
            .evaluate((el) => Math.ceil(el.getBoundingClientRect().height));
    // flow: never below the manifest's height (180), a floor
    const initial = (await iframe.boundingBox())?.height ?? 0;
    expect(initial).toBeGreaterThanOrEqual(180);
    // the embed grows past the floor: the frame follows its resize messages
    for (let row = 0; row < 6; row += 1) {
        await embed(flow).getByTestId("grow").click();
    }
    await expect
        .poll(async () => (await iframe.boundingBox())?.height)
        .toBe(await content());
    expect(await content()).toBeGreaterThan(initial);
    const resizes = (await messages(page)).filter(
        (m) => (m as { type: string }).type === "fragiola:example:resize",
    );
    expect(resizes.length).toBeGreaterThan(0);
});

test("the page's height is a floor on a flow example", async ({ page }) => {
    await page.goto("ui/docs/menus/dropdown-menu/");
    const block = page.locator('[data-example="dropdown-menu"]');
    await expectReady(block);
    // <Example height={360}> over a manifest height of 320, content shorter than both
    expect((await block.locator("iframe").boundingBox())?.height).toBe(360);
});

test("the embed gets the site's theme, and follows it without a reload", async ({
    page,
}) => {
    await page.goto("dockable/docs/getting-started/first-layout/");
    const block = page.locator(
        '[data-example="hello-layout"][data-variant="inline"]',
    );
    await expectReady(block);
    const html = embed(block).locator("html");
    await expect(block.locator("iframe")).toHaveAttribute("src", /theme=light/);
    await expect(html).toHaveAttribute("data-example-theme", "light");
    await markFrame(block);

    await page.locator("[data-theme-toggle]:visible").first().click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    // the first dark theme of examples.json, as a message
    await expect(html).toHaveAttribute("data-example-theme", "dark");
    await expect(html).toHaveClass(/\bdark\b/);
    expect(await frameMarked(block)).toBe(true);
});

test("the site resolves `system` before it passes a theme", async ({
    page,
}) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await setSiteTheme(page, "system" as "dark");
    await page.goto("ui/docs/atoms/clickable/");
    const block = page.locator('[data-example="clickable"]');
    await expectReady(block);
    await expect(block.locator("iframe")).toHaveAttribute("src", /theme=dark/);
    await expect(embed(block).locator("html")).toHaveAttribute(
        "data-theme",
        "dark",
    );
});

test("a theme set by the page is kept whatever the site's theme", async ({
    page,
}) => {
    await setSiteTheme(page, "light");
    await page.goto("dockable/");
    const bleed = page.locator(
        '[data-example="hello-layout"][data-variant="showcase"]',
    );
    await expectReady(bleed);
    await expect(embed(bleed).locator("html")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
    await page.locator("[data-theme-toggle]:visible").first().click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.waitForTimeout(200);
    await expect(embed(bleed).locator("html")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
});

test("Reset reloads an inline example's frame", async ({ page }) => {
    await page.goto("dockable/docs/getting-started/first-layout/");
    const block = page.locator(
        '[data-example="hello-layout"][data-variant="inline"]',
    );
    await expectReady(block);
    await embed(block).getByTestId("counter").click();
    await expect(embed(block).getByTestId("counter")).toHaveText("Count: 1");
    await markFrame(block);
    await block.getByTestId("reset").click();
    await expectReady(block);
    await expect(embed(block).getByTestId("counter")).toHaveText("Count: 0");
    expect(await frameMarked(block)).toBeUndefined();
});

test("a popout opened from inside the frame lives under the embed's base", async ({
    page,
}) => {
    const stage = await openExample(page, "dockable", "popout", {
        theme: "terminal",
    });
    const [popout] = await Promise.all([
        page.context().waitForEvent("page"),
        embed(stage).getByTestId("popout").click(),
    ]);
    await popout.waitForLoadState();
    const url = new URL(popout.url());
    expect(url.pathname).toBe("/dockable/embed/react/popout/");
    expect(url.searchParams.get("theme")).toBe("terminal");
    await expect(popout.getByTestId("popped")).toHaveText("Popped out: popout");
    await expect(popout.locator("body")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
});

test("messages from another frame, or for another example, are ignored", async ({
    page,
}) => {
    await page.goto("dockable/examples/slow-start/");
    const frame = page.getByTestId("stage").getByTestId("example-frame");
    // the page itself posts a ready for the example: not the frame's window, so ignored
    await page.evaluate(() =>
        window.postMessage(
            { type: "fragiola:example:ready", id: "slow-start" },
            location.origin,
        ),
    );
    await page.waitForTimeout(200);
    await expect(frame).not.toHaveAttribute("data-ready");
    await expect(frame).toHaveAttribute("data-ready", "", { timeout: 5000 });
});
