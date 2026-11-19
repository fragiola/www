import { expect, test } from "@playwright/test";

// The AI agents docs (content/ai/, app/ai/docs/): the agent skills and the MCP server, written by
// www and served in the docs' own layout, so reaching them from a project's docs only switches the
// "project". /mcp/ and /skills/, where they were landing pages, redirect to them. Their search
// metadata is checked by seo.spec.ts.

test("the skills page is a docs page: the sidebar, the inset panel, the page header", async ({
    page,
}) => {
    await page.goto("ai/docs/skills/");
    await expect(page.getByTestId("site-header")).toHaveCount(0);
    await expect(page.locator("#nd-sidebar")).toBeVisible();
    await expect(page.locator(".docs-inset-panel")).toBeVisible();
    await expect(
        page.getByRole("heading", { level: 1, name: "Agent skills" }),
    ).toBeVisible();
    const body = page.locator(".docs-body");
    await expect(body).toContainText("npx skills add fragiola/skills");
    for (const id of ["fragiola-ui", "palettes", "headless-libraries"]) {
        await expect(body.locator(`h3#${id}`)).toBeVisible();
    }
    // the switcher names the space
    await expect(page.getByTestId("project-switcher")).toContainText(
        "AI agents",
    );
    // the sidebar lists the space's pages
    const sidebar = page.locator("#nd-sidebar");
    for (const name of ["Set up the server", "Tools", "Troubleshooting"]) {
        await expect(
            sidebar.getByRole("link", { name, exact: true }),
        ).toBeVisible();
    }
});

test("the MCP page: a tab per client, its init command and config; code blocks keep their padding", async ({
    page,
}) => {
    await page.goto("ai/docs/mcp/");
    const body = page.locator(".docs-body");
    for (const [label, id, file] of [
        ["Claude Code", "claude", ".mcp.json"],
        ["Cursor", "cursor", ".cursor/mcp.json"],
        ["VS Code", "vscode", ".vscode/mcp.json"],
        ["Codex", "codex", "~/.codex/config.toml"],
        ["OpenCode", "opencode", "opencode.json"],
    ] as const) {
        await body.getByRole("tab", { name: label, exact: true }).click();
        const panel = body.getByRole("tabpanel");
        await expect(panel).toContainText(
            `npx fragiola@latest mcp init --client ${id}`,
        );
        await expect(panel).toContainText(file);
    }
    // the first line of a code block sits inside its frame, not against it
    const gap = await body
        .getByRole("tabpanel")
        .locator("pre")
        .first()
        .evaluate((pre) => {
            // where the first character is drawn, against the block's frame
            const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
            let text = walker.nextNode();
            while (text && !text.textContent?.trim()) text = walker.nextNode();
            const range = document.createRange();
            range.setStart(text as Node, 0);
            range.setEnd(text as Node, 1);
            const frame = (
                pre.closest("figure") ?? pre
            ).getBoundingClientRect();
            return range.getBoundingClientRect().left - frame.left;
        });
    expect(gap).toBeGreaterThanOrEqual(8);
});

test("the tools page lists the server's tools", async ({ page }) => {
    await page.goto("ai/docs/mcp/tools/");
    for (const tool of [
        "get_fragiola_overview",
        "list_components",
        "get_component",
        "get_api",
        "get_install_command",
    ]) {
        await expect(page.getByRole("cell", { name: tool })).toBeVisible();
    }
});

test("/mcp/, /skills/, /ai/ and /ai/docs/ go to the AI agents docs", async ({
    page,
}) => {
    for (const [from, to] of [
        ["mcp/", /\/ai\/docs\/mcp\/$/],
        ["skills/", /\/ai\/docs\/skills\/$/],
        ["ai/", /\/ai\/docs\/skills\/$/],
        ["ai/docs/", /\/ai\/docs\/skills\/$/],
    ] as const) {
        await page.goto(from);
        await expect(page, from).toHaveURL(to);
    }
});

test("the organization's landing links the AI agents docs, in its section and its footer", async ({
    page,
}) => {
    await page.goto("");
    await page.getByRole("link", { name: "Set up the MCP server" }).click();
    await expect(page).toHaveURL(/\/ai\/docs\/mcp\/$/);
    await page.goto("");
    const footer = page.getByTestId("site-footer");
    await expect(
        footer.getByRole("link", { name: "MCP server" }),
    ).toHaveAttribute("href", "/ai/docs/mcp/");
    await expect(
        footer.getByRole("link", { name: "Agent skills" }),
    ).toHaveAttribute("href", "/ai/docs/skills/");
});

test("search finds the AI agents docs", async ({ page }) => {
    await page.goto("ai/docs/skills/");
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("troubleshooting");
    await expect(
        dialog
            .getByRole("button")
            .filter({ hasText: /Troubleshooting/ })
            .first(),
    ).toBeVisible();
});
