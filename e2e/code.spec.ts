import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
    DOCKABLE,
    embed,
    expectReady,
    openExample,
    setSiteTheme,
} from "./helpers";

// The code panel on demand: a page carries no code; an example's files are fetched when its
// panel opens, and the shared files once per project and framework (lib/code.ts).

const OUT = join(import.meta.dirname, "..", "out");

function codeRequests(page: Page): string[] {
    const urls: string[] = [];
    page.on("request", (request) => {
        const { pathname } = new URL(request.url());
        if (/^\/[^/]+\/code\//.test(pathname)) urls.push(pathname);
    });
    return urls;
}

test("an example page carries no code", () => {
    const html = readFileSync(
        join(OUT, "dockable/examples/hello-layout/index.html"),
        "utf-8",
    );
    const source = DOCKABLE.manifests.react?.files["hello-layout/index.tsx"];
    expect(source?.content).toContain("IJsonModel");
    expect(html).not.toContain("IJsonModel");
    expect(html).not.toContain('_kit/card.tsx","lang');
});

test("the files are fetched when the panel opens, the shared ones once; the setup command", async ({
    page,
}) => {
    const requests = codeRequests(page);
    // until the panel opens, any code request fails (and is kept): the panel could not show it
    let open = false;
    const early: string[] = [];
    await page.route(
        (url) => /^\/[^/]+\/code\//.test(url.pathname),
        (route) => {
            if (open) return route.continue();
            early.push(new URL(route.request().url()).pathname);
            return route.abort();
        },
    );
    await openExample(page, "dockable", "hello-layout");
    expect(requests).toEqual([]);

    open = true;
    await page.getByTestId("toggle-code").click();
    const panel = page.getByRole("complementary", { name: "Example code" });
    await expect(panel.getByTestId("code-file")).toBeVisible();
    expect(requests.sort()).toEqual([
        "/dockable/code/react/hello-layout.json",
        "/dockable/code/react/shared.json",
        "/dockable/code/themes.json",
    ]);

    // another example, client-side, panel still open: its own files only
    requests.length = 0;
    await page
        .getByRole("navigation", { name: "Examples" })
        .getByRole("link", { name: "Add tabs", exact: true })
        .click();
    await expect(panel.getByRole("tab").first()).toHaveText(
        "add-tabs/index.tsx",
    );
    await expect(panel.getByRole("tab").nth(1)).toHaveText("_kit/card.tsx");
    expect(requests).toEqual(["/dockable/code/react/add-tabs.json"]);
    expect(early).toEqual([]);

    // the setup command lists the packages and the namespaced registry items
    const setup = panel.getByTestId("setup");
    await expect(setup).toHaveText(
        [
            "npm install @fragiola/dockable @fragiola/dockable-react lucide-react",
            "npx shadcn@latest add @fragiola/cn @fragiola/input",
        ].join("\n"),
    );
    await expect(setup).not.toContainText("fields");
});

test("an inline example fetches its code when asked, not before; with no stored preference, dark", async ({
    page,
}) => {
    const requests = codeRequests(page);
    await page.goto("dockable/docs/getting-started/first-layout/");
    // with no stored preference the site opens in dark, and so do the embeds
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const block = page.locator(
        '[data-example="hello-layout"][data-variant="inline"]',
    );
    await expect(block.locator("iframe")).toHaveAttribute("src", /theme=dark/);
    await expectReady(block);
    expect(requests).toEqual([]);
    await block.getByTestId("toggle-code").click();
    const region = block.getByRole("region", { name: "Example code" });
    await expect(region.getByRole("tab")).toHaveText(
        DOCKABLE.manifests.react?.examples[0]?.files ?? [],
    );
    await expect(region.getByTestId("setup")).toContainText(
        "npx shadcn@latest add @fragiola/cn",
    );
    expect(requests.sort()).toEqual([
        "/dockable/code/react/hello-layout.json",
        "/dockable/code/react/shared.json",
    ]);
});

test("the highlighted code follows the site's scheme", async ({ page }) => {
    // the site opens in dark: start from its light scheme
    await setSiteTheme(page, "light");
    await openExample(page, "ui", "clickable", { code: true });
    const code = page.getByTestId("code-file").locator("code span").first();
    await expect(code).toBeVisible();
    const light = await code.evaluate((el) => getComputedStyle(el).color);
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expect
        .poll(() => code.evaluate((el) => getComputedStyle(el).color))
        .not.toBe(light);
    // the embed is not reloaded by any of it
    await expect(
        embed(page.getByTestId("stage")).getByTestId("counter"),
    ).toBeVisible();
});
