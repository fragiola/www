import { expect, test } from "@playwright/test";
import { collectErrors } from "./helpers";

// The organization landing's scene in a browser without WebGL (a launch option, so a file of its
// own): the CSS grid stays the hero's background, the canvas goes, and nothing is logged.

test.use({ launchOptions: { args: ["--disable-3d-apis"] } });

test("without WebGL the CSS grid stays, the canvas goes, and nothing is logged", async ({
    page,
}) => {
    const errors = collectErrors(page);
    const warnings: string[] = [];
    page.on("console", (message) => {
        if (message.text().includes("THREE")) warnings.push(message.text());
    });
    await page.goto("");
    const scene = page.getByTestId("hero-scene");
    await expect(scene).toHaveAttribute("data-state", "unavailable");
    await expect(scene.locator("canvas")).toBeHidden();
    await expect(page.getByTestId("hero-grid")).toBeAttached();
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
});
