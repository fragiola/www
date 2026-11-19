import { expect, type Locator, type Page, test } from "@playwright/test";
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

// Overlay promotion (CONTRACT.md §5.4, v1.3): while an example's modal overlay is open, its frame
// covers the page — above the site's header, in docs and in the gallery — and the example stays
// where it was. The `ui` fixture's `clickable` example has "Open dialog", a modal overlay that
// follows the protocol (fixtures/README.md).

const OVERLAY = "fragiola:example:overlay";
const DOCS = "ui/docs/atoms/clickable/";

const docsBlock = (page: Page) =>
    page.locator('[data-example="clickable"][data-variant="inline"]');

/** The example's own box, in the page's coordinates. */
const exampleBox = async (scope: Locator) => {
    const box = await embed(scope).getByTestId("example-root").boundingBox();
    if (!box) throw new Error("the example has no box");
    return box;
};

const expectSameBox = (
    actual: { x: number; y: number; width: number; height: number },
    expected: { x: number; y: number; width: number; height: number },
) => {
    for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(1);
    }
};

const viewport = (page: Page) =>
    page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
    }));

/** The `fragiola:example:*` messages the example's own window received. */
const frameMessages = (scope: Locator) =>
    embed(scope)
        .locator("html")
        .evaluate(
            () =>
                (window as unknown as { messages: { type: string }[] })
                    .messages,
        );

/** The overlay panel's inline-end edge, once its opening transition has played. */
const panelEnd = async (scope: Locator) => {
    const panel = embed(scope).getByTestId("overlay-panel");
    await expect(panel).toHaveAttribute("data-open", "");
    await panel.evaluate((node) =>
        Promise.all(node.getAnimations().map((a) => a.finished)),
    );
    const box = await panel.boundingBox();
    return (box?.x ?? 0) + (box?.width ?? 0);
};

/**
 * Samples, on every animation frame of the page, where the example is drawn: the iframe's box
 * plus the example's box inside it. A frame painted between the promotion and the embed's
 * arming would show here as an example displaced by the frame's old position.
 */
const sampleExample = (page: Page) =>
    page.evaluate(() => {
        const samples: { x: number; y: number }[] = [];
        const iframe = document.querySelector<HTMLIFrameElement>(
            '[data-example="clickable"] iframe',
        );
        let running = true;
        const tick = () => {
            const root = iframe?.contentDocument?.querySelector(
                '[data-testid="example-root"]',
            );
            if (iframe && root) {
                const outer = iframe.getBoundingClientRect();
                const inner = root.getBoundingClientRect();
                samples.push({ x: outer.x + inner.x, y: outer.y + inner.y });
            }
            if (running) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        (
            window as unknown as { stopSampling: () => typeof samples }
        ).stopSampling = () => {
            running = false;
            return samples;
        };
    });

const stopSampling = (page: Page) =>
    page.evaluate(() =>
        (
            window as unknown as {
                stopSampling: () => { x: number; y: number }[];
            }
        ).stopSampling(),
    );

/** What is drawn at a point of the page: the promoted iframe covers everything. */
const topAt = (page: Page, x: number, y: number) =>
    page.evaluate(
        (point) => document.elementFromPoint(point.x, point.y)?.tagName ?? null,
        { x, y },
    );

test("a docs example's overlay covers the page, the example stays in place, and the frame goes back once it has closed", async ({
    page,
}) => {
    await recordMessages(page);
    await page.goto(DOCS);
    const block = docsBlock(page);
    const frame = await expectReady(block);
    // the site says it can promote, once ready
    await expect
        .poll(async () =>
            (await frameMessages(block)).some(
                (m) => m.type === "fragiola:example:host",
            ),
        )
        .toBe(true);
    await embed(block).getByTestId("counter").click();
    await markFrame(block);
    const before = await exampleBox(block);
    const scrollY = await page.evaluate(() => window.scrollY);

    await sampleExample(page);
    await embed(block).getByTestId("open-overlay").click();
    await expect(frame).toHaveAttribute("data-promoted", "");
    const panel = embed(block).getByTestId("overlay-panel");
    await expect(panel).toHaveAttribute("data-open", "");

    // the frame covers the viewport, the docs' sidebar (their navigation, rule 9) included
    const size = await viewport(page);
    const backdrop = await embed(block)
        .getByTestId("overlay-backdrop")
        .boundingBox();
    expectSameBox(backdrop ?? { x: -1, y: -1, width: 0, height: 0 }, {
        x: 0,
        y: 0,
        ...size,
    });
    const switcher = await page.getByTestId("project-switcher").boundingBox();
    expect(
        await topAt(
            page,
            (switcher?.x ?? 0) + 20,
            (switcher?.y ?? 0) + (switcher?.height ?? 0) / 2,
        ),
    ).toBe("IFRAME");
    // the panel sits at the page's inline-end edge, and opened from there: its first frame
    // already had the page's viewport
    expect(Math.abs((await panelEnd(block)) - size.width)).toBeLessThanOrEqual(
        1,
    );
    const first = await embed(block)
        .locator("html")
        .evaluate(
            () =>
                (
                    window as unknown as {
                        overlayFirstFrame: {
                            viewport: { width: number; height: number };
                        };
                    }
                ).overlayFirstFrame.viewport,
        );
    expect(first).toEqual(size);

    // nothing of the example moved, nothing reloaded, the focus is in the overlay
    expectSameBox(await exampleBox(block), before);
    await expect(embed(block).getByTestId("counter")).toHaveText("Count: 1");
    expect(await frameMarked(block)).toBe(true);
    await expect(embed(block).getByTestId("close-overlay")).toBeFocused();

    // the page under the frame does not scroll
    await page.mouse.move(size.width / 2, size.height / 2);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    expectSameBox(await exampleBox(block), before);

    // closing: the frame stays promoted while the exit transition plays, then goes back
    await embed(block).getByTestId("close-overlay").click();
    await expect(frame).toHaveAttribute("data-promoted", "");
    await expect(frame).not.toHaveAttribute("data-promoted", "");
    await expect(panel).toHaveCount(0);
    await page.waitForTimeout(100);
    expectSameBox(await exampleBox(block), before);
    // in no painted frame, opening or closing, was the example anywhere else
    const samples = await stopSampling(page);
    expect(samples.length).toBeGreaterThan(10);
    for (const sample of samples) {
        expect(Math.abs(sample.x - before.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(sample.y - before.y)).toBeLessThanOrEqual(1);
    }
    expect(await frameMarked(block)).toBe(true);
    expect(
        await page.evaluate(() => document.querySelector(":popover-open")),
    ).toBeNull();

    // the embed asked and armed (the site's log); the site answered (the frame's log)
    const toSite = (await messages(page)).map(
        (m) => (m as { type: string }).type,
    );
    expect(toSite.indexOf(OVERLAY)).toBeGreaterThanOrEqual(0);
    expect(toSite.indexOf("fragiola:example:armed")).toBeGreaterThan(
        toSite.indexOf(OVERLAY),
    );
    const toFrame = (await frameMessages(block)).map((m) => m.type);
    expect(toFrame.indexOf("fragiola:example:promoted")).toBeGreaterThan(
        toFrame.indexOf("fragiola:example:promote"),
    );
    expect(toFrame.indexOf("fragiola:example:promote")).toBeGreaterThan(
        toFrame.indexOf("fragiola:example:host"),
    );
    expect(
        (await messages(page)).filter(
            (m) =>
                (m as { type: string; open?: boolean }).type === OVERLAY &&
                (m as { open?: boolean }).open === false,
        ),
    ).toHaveLength(1);

    // the page scrolls again (the wheel over the page's own header: over an example's frame it
    // would stay the frame's)
    await page.locator("[data-docs-header]").first().hover();
    await page.mouse.wheel(0, 300);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(scrollY);
});

test("in the gallery the overlay covers the list and the code panel, in fullscreen too", async ({
    page,
}) => {
    const stage = await openExample(page, "ui", "clickable", { code: true });
    const frame = stage.getByTestId("example-frame");
    const list = page.getByRole("navigation", { name: "Examples" });

    for (const fullscreen of [false, true]) {
        if (fullscreen) {
            await page.getByRole("button", { name: "Fullscreen" }).click();
        }
        const before = await exampleBox(stage);
        await embed(stage).getByTestId("open-overlay").click();
        await expect(frame).toHaveAttribute("data-promoted", "");
        await expect(embed(stage).getByTestId("overlay-panel")).toHaveAttribute(
            "data-open",
            "",
        );
        const size = await viewport(page);
        expect(
            Math.abs((await panelEnd(stage)) - size.width),
        ).toBeLessThanOrEqual(1);
        if (!fullscreen && (await list.isVisible())) {
            const item = await list.boundingBox();
            expect(
                await topAt(page, (item?.x ?? 0) + 10, (item?.y ?? 0) + 10),
            ).toBe("IFRAME");
        }
        expect(await topAt(page, 5, 5)).toBe("IFRAME");
        expectSameBox(await exampleBox(stage), before);

        await embed(stage).getByTestId("close-overlay").click();
        await expect(frame).not.toHaveAttribute("data-promoted", "");
        expectSameBox(await exampleBox(stage), before);
    }
});

for (const [site, example] of [
    ["dark", "light"],
    ["light", "dark"],
] as const) {
    test(`a promoted frame is transparent: a ${example} example on a ${site} site`, async ({
        page,
    }) => {
        await setSiteTheme(page, site);
        const stage = await openExample(page, "ui", "clickable", {
            theme: example,
        });
        const frame = stage.getByTestId("example-frame");
        // the iframe's scheme is its theme's, which differs from the site's here
        await expect(frame.locator("iframe")).toHaveCSS(
            "color-scheme",
            example,
        );
        await expect(embed(stage).locator("html")).toHaveCSS(
            "color-scheme",
            example,
        );
        const clip = await page.locator("header").first().boundingBox();
        if (!clip) throw new Error("no header");
        const area = {
            x: clip.x,
            y: clip.y,
            width: Math.min(clip.width, 400),
            height: clip.height,
        };
        const before = await page.screenshot({
            clip: area,
            animations: "disabled",
        });

        await embed(stage).getByTestId("open-overlay").click();
        await expect(frame).toHaveAttribute("data-promoted", "");
        await expect(embed(stage).getByTestId("overlay-panel")).toHaveAttribute(
            "data-open",
            "",
        );
        // without its overlay, a promoted frame shows the page under it untouched: no opaque
        // canvas behind a transparent document
        await embed(stage)
            .locator("html")
            .evaluate(() => {
                for (const node of document.querySelectorAll<HTMLElement>(
                    "[data-overlay]",
                )) {
                    node.style.visibility = "hidden";
                }
            });
        const after = await page.screenshot({
            clip: area,
            animations: "disabled",
        });
        expect(after.equals(before)).toBe(true);
    });
}

test("a docs example's iframe has its theme's color-scheme", async ({
    page,
}) => {
    await setSiteTheme(page, "dark");
    await page.goto(DOCS);
    const block = docsBlock(page);
    await expectReady(block);
    await expect(block.locator("iframe")).toHaveCSS("color-scheme", "dark");
    await expect(embed(block).locator("html")).toHaveCSS(
        "color-scheme",
        "dark",
    );
});

test("Reset while promoted gives the page back; a frame that never arms is promoted anyway; other ids are ignored", async ({
    page,
}) => {
    await page.goto(DOCS);
    const block = docsBlock(page);
    let frame = await expectReady(block);
    await embed(block).getByTestId("open-overlay").click();
    await expect(frame).toHaveAttribute("data-promoted", "");
    // the frame covers Reset: what a reader cannot press, a remount does (another example, a
    // client-side navigation)
    await block.getByTestId("reset").dispatchEvent("click");
    frame = await expectReady(block);
    await expect(frame).not.toHaveAttribute("data-promoted", "");
    expect(
        await page.evaluate(() => document.querySelector(":popover-open")),
    ).toBeNull();
    const scrollY = await page.evaluate(() => window.scrollY);
    // the wheel over the page's own header: over an example's frame it would stay the frame's
    await page.locator("[data-docs-header]").first().hover();
    await page.mouse.wheel(0, 300);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(scrollY);

    const ask = (id: string, open: boolean) =>
        embed(block)
            .locator("html")
            .evaluate(
                (_, message) =>
                    window.parent.postMessage(message, location.origin),
                { type: OVERLAY, id, open },
            );
    // for another example: ignored
    await ask("text", true);
    await page.waitForTimeout(700);
    await expect(frame).not.toHaveAttribute("data-promoted", "");
    // no `armed`: promoted after the timeout all the same, and back on `open: false`
    await ask("clickable", true);
    await expect(frame).toHaveAttribute("data-promoted", "");
    await ask("clickable", false);
    await expect(frame).not.toHaveAttribute("data-promoted", "");
});

test("an embed that never asks is never promoted", async ({ page }) => {
    await page.goto("dockable/docs/getting-started/first-layout/");
    const block = page.locator(
        '[data-example="hello-layout"][data-variant="inline"]',
    );
    const frame = await expectReady(block);
    await embed(block).getByTestId("counter").click();
    await expect(frame).not.toHaveAttribute("data-promoted", "");
    expect(
        await page.evaluate(() => document.querySelector(":popover-open")),
    ).toBeNull();
});
