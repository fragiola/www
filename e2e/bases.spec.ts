import { expect, test } from "@playwright/test";
import { collectErrors, embed, expectReady } from "./helpers";

// Bases (CONTRACT.md v1.8 §2, §5.6, §7): ui's fixture declares Fragiola Primitives (the default,
// embed/react/) and Base UI (embed/react/base/, whose page marks <html data-fixture-base>). The
// choice is site-wide like the framework's: the docs' select and the gallery's switch set it,
// `?base=` sets it from a link, it is remembered, and a project without bases has no control.

const BASE_FRAME = '[data-testid="example-frame"][data-base="base"]';

test("the docs' base select loads the base's embed and adds its components.json entry", {
    tag: "@serve",
}, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("ui/docs/atoms/clickable/");
    const select = page.getByTestId("base-select").first();
    await expect(select).toHaveValue("primitives");
    await expect(page.getByTestId("base-registry-note")).toHaveCount(0);
    const frame = page.getByTestId("example-frame").first();
    await expect(frame).not.toHaveAttribute("data-base", /.*/);

    await select.selectOption("base");
    await expect(page.locator(BASE_FRAME).first()).toBeVisible();
    await expect(page.locator(BASE_FRAME).first()).toHaveAttribute(
        "data-ready",
        "",
    );
    await expect(
        embed(page).locator("html[data-fixture-base='base']"),
    ).toHaveCount(1);
    const note = page.getByTestId("base-registry-note").first();
    await expect(note).toHaveAttribute("data-base", "base");
    await expect(note).toContainText(
        '"url": "https://fragiola.com/r/base/{name}.json"',
    );

    // remembered: another page of the same project opens on Base UI
    await page.goto("ui/docs/menus/dropdown-menu/");
    await expect(page.getByTestId("base-select").first()).toHaveValue("base");
    expect(errors).toEqual([]);
});

test("?base= in a link chooses the base", async ({ page }) => {
    await page.goto("ui/docs/atoms/clickable/?base=base");
    await expect(page.getByTestId("base-select").first()).toHaveValue("base");
    await expect(page.locator(BASE_FRAME).first()).toBeVisible();
});

test("an unknown base shows the default one", async ({ page }) => {
    await page.goto("ui/docs/atoms/clickable/?base=radix");
    await expect(page.getByTestId("base-select").first()).toHaveValue(
        "primitives",
    );
    await expect(page.locator(BASE_FRAME)).toHaveCount(0);
});

test("a project without bases has no base control", async ({ page }) => {
    await page.goto("dockable/docs/getting-started/installation/");
    await expect(page.getByTestId("docs-sidebar-top").first()).toBeVisible();
    await expect(page.getByTestId("base-select")).toHaveCount(0);
});

test("the gallery's base switch: the embed, the URL and the setup note follow it", {
    tag: "@serve",
}, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("ui/examples/clickable/?code=1");
    const stage = page.getByTestId("stage");
    await expectReady(stage);
    await expect(
        page.locator('[data-base-option="primitives"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-base-option="base"]').click();
    await expect(page).toHaveURL(/base=base/);
    await expect(stage.getByTestId("example-frame")).toHaveAttribute(
        "data-base",
        "base",
    );
    await expectReady(stage);
    await expect(page.getByTestId("base-setup-note")).toContainText(
        "/r/base/{name}.json",
    );
    // back to the default: the URL drops it
    await page.locator('[data-base-option="primitives"]').click();
    await expect(page).not.toHaveURL(/base=/);
    await expect(page.getByTestId("base-setup-note")).toHaveCount(0);
    expect(errors).toEqual([]);
});
