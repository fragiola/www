import { expect, test } from "@playwright/test";
import { DOCKABLE, embed, expectReady } from "./helpers";

// The site's localStorage (lib/storage.ts): every key under `@fragiola:`, and a reader who chose
// before the prefix keeps the site theme, the framework and the example theme, from the first
// paint on.

const first = DOCKABLE.ordered[0];
if (!first) throw new Error("no examples in the dockable fixture");

test("the keys written before @fragiola: move on the first visit, with no theme flash", async ({
    page,
}) => {
    await page.addInitScript(() => {
        // every data-theme the page gives <html>, from the first one next-themes sets
        const seen: (string | null)[] = [];
        (window as unknown as { themes: typeof seen }).themes = seen;
        new MutationObserver((records) => {
            for (const record of records) {
                if (record.target === document.documentElement) {
                    seen.push(document.documentElement.dataset.theme ?? null);
                }
            }
        }).observe(document, {
            subtree: true,
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        // what an earlier version of the site wrote, once per tab
        if (sessionStorage.getItem("seeded")) return;
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("theme", "light");
        localStorage.setItem("fragiola:framework", "vue");
        localStorage.setItem("fragiola:example-theme:dockable", "paper");
    });

    await page.goto(`dockable/examples/${first.id}/`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(
        await page.evaluate(
            () => (window as unknown as { themes: string[] }).themes,
        ),
    ).not.toContain("dark");
    const stage = page.getByTestId("stage");
    await expect(stage).toHaveAttribute("data-example-theme", "paper");
    await expect(stage.getByTestId("example-frame")).toHaveAttribute(
        "data-framework",
        "vue",
    );
    await expectReady(stage);

    expect(await page.evaluate(() => ({ ...localStorage }))).toMatchObject({
        "@fragiola:theme": "light",
        "@fragiola:framework": "vue",
        "@fragiola:example-theme:dockable": "paper",
    });
    expect(
        await page.evaluate(() =>
            ["theme", "fragiola:framework", "fragiola:example-theme:dockable"]
                .map((key) => localStorage.getItem(key))
                .filter((value) => value !== null),
        ),
    ).toEqual([]);

    // a reload keeps them: nothing moves back
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(stage).toHaveAttribute("data-example-theme", "paper");
});

test("the framework choice reaches another tab through @fragiola:framework", async ({
    page,
}) => {
    await page.goto(`dockable/examples/${first.id}/`);
    await expectReady(page.getByTestId("stage"));
    const other = await page.context().newPage();
    await other.goto(`dockable/examples/${first.id}/`);
    const stage = other.getByTestId("stage");
    await expectReady(stage);

    await page.locator('[data-framework-option="vue"]').click();
    await expect(stage.getByTestId("example-frame")).toHaveAttribute(
        "data-framework",
        "vue",
    );
    await expect(embed(stage).getByTestId("framework")).toHaveText(
        `vue · ${first.id}`,
    );
    expect(
        await other.evaluate(() => localStorage.getItem("@fragiola:framework")),
    ).toBe("vue");
});
