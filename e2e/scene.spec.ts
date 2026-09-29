import { expect, type Page, test } from "@playwright/test";
import { collectErrors, mark, marked } from "./helpers";

// The organization landing's WebGL scene (components/landing/hero-scene.tsx): three loaded only
// on /, after hydration; paused when unseen; a still under reduced motion; recoloured with the
// site's theme; released when the page is left. WebGL in headless Chromium may be software or
// missing: the specs assert the scene's state, never pixels, and accept `unavailable` (the CSS
// grid stays) wherever WebGL is not the point.

const scene = (page: Page) => page.getByTestId("hero-scene");

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
    await page.goto("");
    const state = await settle(page);
    expect(["running", "unavailable"]).toContain(state);
    const canvas = scene(page).locator("canvas");
    if (state === "running") {
        await expect(canvas).toBeVisible();
        // behind the content: the hero's actions still take the pointer
        await expect(
            page.getByRole("link", { name: "Explore the projects" }),
        ).toBeInViewport();
        await expect(scene(page)).toHaveCSS("pointer-events", "none");
    } else {
        await expect(canvas).toBeHidden();
    }
    await expect(page.getByTestId("hero-grid")).toBeAttached();
    expect(errors).toEqual([]);
});

test("three is loaded on / and on no other page", async ({ page }) => {
    const scripts = threeScripts(page);
    await page.goto("");
    await settle(page);
    expect((await Promise.all(scripts)).flat()).toHaveLength(1);

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

    test("the scene is a still, no loop", async ({ page }) => {
        await page.goto("");
        const state = await settle(page);
        expect(["still", "unavailable"]).toContain(state);
    });
});

test("the scene pauses off-screen and in a hidden tab", async ({ page }) => {
    await page.goto("");
    test.skip((await settle(page)) === "unavailable", "no WebGL here");
    await expect(scene(page)).toHaveAttribute("data-state", "running");
    await page.locator("#projects").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(scene(page)).toHaveAttribute("data-state", "paused");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(scene(page)).toHaveAttribute("data-state", "running");
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(scene(page)).toHaveAttribute("data-state", "paused");
});

test("switching the site's theme recolours the scene, without a reload", async ({
    page,
}) => {
    await page.goto("");
    test.skip((await settle(page)) === "unavailable", "no WebGL here");
    await mark(page);
    await expect(scene(page)).toHaveAttribute("data-scheme", "dark");
    await page
        .getByTestId("site-header")
        .locator("[data-theme-toggle]")
        .click();
    await expect(scene(page)).toHaveAttribute("data-scheme", "light");
    expect(await marked(page)).toBe(true);
});

test("leaving / and coming back leaves one canvas, and no error", async ({
    page,
}) => {
    const errors = collectErrors(page);
    await page.goto("");
    await settle(page);
    await page.getByRole("link", { name: /^Meet / }).click();
    await expect(page).toHaveURL(/\/ui\/$/);
    await expect(scene(page)).toHaveCount(0);
    await page.goBack();
    await settle(page);
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(errors).toEqual([]);
});
