import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { collectErrors, mark, marked } from "./helpers";

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

const draws = (page: Page) =>
    page.evaluate(() => (window as unknown as { draws: number }).draws);

/** The scene draws: the counter grows (a running loop draws on every frame). */
async function expectDrawing(page: Page) {
    const before = await draws(page);
    await expect.poll(() => draws(page)).toBeGreaterThan(before);
}

/** The draws the page makes over the next `frames` animation frames (a loop draws on each). */
function drawsOverFrames(page: Page, frames = 10) {
    return page.evaluate(async (count) => {
        const w = window as unknown as { draws: number };
        const before = w.draws;
        for (let frame = 0; frame < count; frame++) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return w.draws - before;
    }, frames);
}

/** The export's chunks that carry three (its warnings name THREE.WebGLRenderer). */
function threeChunks(): string[] {
    const chunks = join(import.meta.dirname, "..", "out", "_next", "static");
    return readdirSync(chunks, { recursive: true, encoding: "utf-8" })
        .filter(
            (file) =>
                file.endsWith(".js") &&
                readFileSync(join(chunks, file), "utf-8").includes(
                    "THREE.WebGLRenderer",
                ),
        )
        .map((file) => `/_next/static/${file}`);
}

async function settle(page: Page) {
    await expect(scene(page)).not.toHaveAttribute("data-state", "loading");
    return scene(page).getAttribute("data-state");
}

test("the scene runs behind the hero on /, after hydration; recoloured with the theme, paused when unseen", async ({
    page,
}) => {
    const errors = collectErrors(page);
    await instrument(page);
    await page.goto("");
    expect(await settle(page)).toBe("running");
    await expect(scene(page).locator("canvas")).toBeVisible();
    await expectDrawing(page);
    // behind the content: the hero's actions still take the pointer
    await expect(scene(page)).toHaveCSS("pointer-events", "none");
    await expect(page.getByTestId("hero-grid")).toBeAttached();

    // switching the site's theme recolours the scene, without a reload
    await mark(page);
    await expect(scene(page)).toHaveAttribute("data-scheme", "dark");
    await page
        .getByTestId("site-header")
        .locator("[data-theme-toggle]")
        .click();
    await expect(scene(page)).toHaveAttribute("data-scheme", "light");
    expect(await marked(page)).toBe(true);

    // it stops drawing off-screen and in a hidden tab
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(scene(page)).toHaveAttribute("data-state", "paused");
    expect(await drawsOverFrames(page)).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(scene(page)).toHaveAttribute("data-state", "running");
    await expectDrawing(page);
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(scene(page)).toHaveAttribute("data-state", "paused");
    expect(await drawsOverFrames(page)).toBe(0);
    expect(errors).toEqual([]);
});

test("three is loaded on / and on no other page", async ({ page }) => {
    const chunks = threeChunks();
    expect(chunks.length).toBeGreaterThan(0);
    const requested: string[] = [];
    page.on("request", (request) => {
        requested.push(new URL(request.url()).pathname);
    });
    const three = () => requested.filter((path) => chunks.includes(path));

    // elsewhere first (nothing cached): once the network is quiet, no three
    for (const path of ["ui/", "ui/docs/atoms/clickable/"]) {
        requested.length = 0;
        await page.goto(path, { waitUntil: "networkidle" });
        expect(three(), path).toEqual([]);
    }

    requested.length = 0;
    await page.goto("");
    await settle(page);
    expect(three().length).toBeGreaterThan(0);
});

test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the scene is one still frame, no loop", async ({ page }) => {
        await instrument(page);
        await page.goto("");
        expect(await settle(page)).toBe("still");
        // the still is drawn again by the observers' first callbacks, then never: a loop
        // would draw on every frame
        await expect.poll(() => drawsOverFrames(page)).toBe(0);
        // the pointer moves nothing
        await page.mouse.move(900, 400);
        await page.mouse.move(1000, 500);
        expect(await drawsOverFrames(page)).toBe(0);
    });
});

test("leaving / releases the scene's WebGL context", async ({ page }) => {
    const errors = collectErrors(page);
    await instrument(page);
    await page.goto("");
    await settle(page);
    await page.getByRole("link", { name: /^Meet / }).click();
    await expect(page).toHaveURL(/\/ui\/$/);
    await expect(scene(page)).toHaveCount(0);
    await page.goBack();
    await settle(page);
    await expect(page.locator("canvas")).toHaveCount(1);
    // every context but the live one is lost (released)
    const lost = await page.evaluate(() =>
        (
            window as unknown as { contexts: WebGL2RenderingContext[] }
        ).contexts.map((context) => context.isContextLost()),
    );
    expect(lost.length).toBeGreaterThanOrEqual(2);
    expect(lost.slice(0, -1).every(Boolean)).toBe(true);
    expect(lost.at(-1)).toBe(false);
    expect(errors).toEqual([]);
});
