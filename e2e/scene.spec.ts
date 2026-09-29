import { expect, type Page, test } from "@playwright/test";
import { collectErrors } from "./helpers";

// The organization landing's WebGL scene (components/landing/hero-scene.tsx): three loaded only
// on /, after hydration; paused when unseen; a still under reduced motion; recoloured with the
// site's theme; its WebGL context released when the page is left (without WebGL:
// scene-no-webgl.spec.ts). The specs
// count the draw calls the page makes (a loop that kept running would keep drawing), never read
// pixels.

const scene = (page: Page) => page.getByTestId("hero-scene");

/** Counts WebGL draws, and keeps every WebGL context the page creates. */
async function instrument(page: Page) {
    await page.addInitScript(() => {
        const w = window as unknown as {
            draws: number;
            contexts: WebGL2RenderingContext[];
        };
        w.draws = 0;
        w.contexts = [];
        const proto = WebGL2RenderingContext.prototype;
        for (const name of [
            "drawElements",
            "drawArrays",
            "drawElementsInstanced",
            "drawArraysInstanced",
        ] as const) {
            const original = proto[name] as (...args: unknown[]) => void;
            (proto as unknown as Record<string, unknown>)[name] = function (
                this: WebGL2RenderingContext,
                ...args: unknown[]
            ) {
                w.draws++;
                return original.apply(this, args);
            };
        }
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
            this: HTMLCanvasElement,
            ...args: Parameters<typeof getContext>
        ) {
            const context = getContext.apply(this, args);
            if (context instanceof WebGL2RenderingContext) {
                w.contexts.push(context);
            }
            return context;
        } as typeof getContext;
    });
}

/** The draws the page makes over `ms`. */
async function drawsOver(page: Page, ms = 600) {
    const before = await page.evaluate(
        () => (window as unknown as { draws: number }).draws,
    );
    await page.waitForTimeout(ms);
    const after = await page.evaluate(
        () => (window as unknown as { draws: number }).draws,
    );
    return after - before;
}

/** Every script the page loaded that carries three (its warnings name THREE.WebGLRenderer). */
function threeScripts(page: Page): Promise<string[]>[] {
    const found: Promise<string[]>[] = [];
    page.on("response", (response) => {
        if (!response.url().endsWith(".js")) return;
        found.push(
            response
                .text()
                .then((body) =>
                    body.includes("THREE.WebGLRenderer")
                        ? [response.url()]
                        : [],
                )
                .catch(() => []),
        );
    });
    return found;
}

async function settle(page: Page) {
    await expect(scene(page)).not.toHaveAttribute("data-state", "loading");
    return scene(page).getAttribute("data-state");
}

test("the scene runs behind the hero on /, after hydration", async ({
    page,
}) => {
    const errors = collectErrors(page);
    await instrument(page);
    await page.goto("");
    expect(await settle(page)).toBe("running");
    await expect(scene(page).locator("canvas")).toBeVisible();
    expect(await drawsOver(page)).toBeGreaterThan(0);
    // behind the content: the hero's actions still take the pointer
    await expect(scene(page)).toHaveCSS("pointer-events", "none");
    await expect(page.getByTestId("hero-grid")).toBeAttached();
    expect(errors).toEqual([]);
});

test("three is loaded on / and on no other page", async ({ page }) => {
    const scripts = threeScripts(page);
    await page.goto("");
    await settle(page);
    expect((await Promise.all(scripts)).flat().length).toBeGreaterThan(0);

    for (const path of [
        "ui/",
        "ui/docs/atoms/clickable/",
        "dockable/examples/hello-layout/",
    ]) {
        const elsewhere = await page.context().newPage();
        const loaded = threeScripts(elsewhere);
        await elsewhere.goto(path, { waitUntil: "networkidle" });
        expect((await Promise.all(loaded)).flat()).toEqual([]);
        await elsewhere.close();
    }
});

test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the scene is one still frame, no loop", async ({ page }) => {
        await instrument(page);
        await page.goto("");
        expect(await settle(page)).toBe("still");
        await page.waitForTimeout(200);
        expect(await drawsOver(page)).toBe(0);
        // the pointer moves nothing
        await page.mouse.move(900, 400);
        await page.mouse.move(1000, 500);
        expect(await drawsOver(page)).toBe(0);
    });
});

test("the scene stops drawing off-screen and in a hidden tab", async ({
    page,
}) => {
    await instrument(page);
    await page.goto("");
    expect(await settle(page)).toBe("running");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(scene(page)).toHaveAttribute("data-state", "paused");
    expect(await drawsOver(page)).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(scene(page)).toHaveAttribute("data-state", "running");
    expect(await drawsOver(page)).toBeGreaterThan(0);
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(scene(page)).toHaveAttribute("data-state", "paused");
    expect(await drawsOver(page)).toBe(0);
});

test("switching the site's theme recolours the scene, without a reload", async ({
    page,
}) => {
    await page.goto("");
    expect(await settle(page)).toBe("running");
    await expect(scene(page)).toHaveAttribute("data-scheme", "dark");
    await page
        .getByTestId("site-header")
        .locator("[data-theme-toggle]")
        .click();
    await expect(scene(page)).toHaveAttribute("data-scheme", "light");
});

test("leaving / releases the scene's WebGL context", async ({ page }) => {
    const errors = collectErrors(page);
    await instrument(page);
    await page.goto("");
    await settle(page);
    for (let round = 0; round < 2; round++) {
        await page.getByRole("link", { name: /^Meet / }).click();
        await expect(page).toHaveURL(/\/ui\/$/);
        await expect(scene(page)).toHaveCount(0);
        await page.goBack();
        await settle(page);
    }
    await expect(page.locator("canvas")).toHaveCount(1);
    // every context but the live one is lost (released)
    const lost = await page.evaluate(() =>
        (
            window as unknown as { contexts: WebGL2RenderingContext[] }
        ).contexts.map((context) => context.isContextLost()),
    );
    expect(lost.length).toBeGreaterThanOrEqual(3);
    expect(lost.slice(0, -1).every(Boolean)).toBe(true);
    expect(lost.at(-1)).toBe(false);
    expect(errors).toEqual([]);
});
