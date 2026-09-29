import { expect, test } from "@playwright/test";
import { DOCKABLE, embed, openExample, setSiteTheme } from "./helpers";

// The example themes (§4, §5.1), ported from dockable's docs e2e/themes.spec.ts: every theme of
// examples.json reaches the embed before its first paint and paints a different floor, whatever
// the site's own theme; a missing or unknown theme is the first theme of the site's scheme (dark
// by default).

const floor = (page: import("@playwright/test").Page) =>
    embed(page.getByTestId("stage"))
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor);

for (const site of ["light", "dark"] as const) {
    test(`the themes paint different floors (site ${site})`, async ({
        page,
    }) => {
        await setSiteTheme(page, site);
        const seen = new Set<string>();
        for (const theme of DOCKABLE.examples.themes) {
            await openExample(page, "dockable", "hello-layout", {
                theme: theme.name,
            });
            const html = embed(page.getByTestId("stage")).locator("html");
            await expect(html).toHaveAttribute(
                "data-example-theme",
                theme.name,
            );
            await expect(html).toHaveAttribute("data-theme", theme.scheme);
            seen.add(await floor(page));
        }
        expect(seen.size).toBe(DOCKABLE.examples.themes.length);
    });
}

test("the theme is applied before the embed's first paint", async ({
    page,
}) => {
    // the pre-paint script ran if the attribute is there when the document is parsed
    await page.goto("dockable/embed/react/?id=hello-layout&theme=paper", {
        waitUntil: "commit",
    });
    await page.waitForFunction(() => document.body !== null);
    expect(
        await page.evaluate(
            () => document.documentElement.dataset.exampleTheme,
        ),
    ).toBe("paper");
});

test("an unknown ?theme= in the URL is ignored", async ({ page }) => {
    await openExample(page, "dockable", "hello-layout", {});
    await page.goto("dockable/examples/hello-layout/?theme=sepia");
    // the site opens in dark: the first dark theme of examples.json
    await expect(page.getByTestId("stage")).toHaveAttribute(
        "data-example-theme",
        "dark",
    );
});

test("with no stored preference the site opens in dark, and so do the embeds", async ({
    page,
}) => {
    await page.goto("dockable/docs/getting-started/first-layout/");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const block = page.locator(
        '[data-example="hello-layout"][data-variant="inline"]',
    );
    await expect(block.locator("iframe")).toHaveAttribute("src", /theme=dark/);
});
