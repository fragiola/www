import { expect, test } from "@playwright/test";

// /mcp/ (app/mcp/page.tsx): the MCP server's page, organization-level. Under the site header, it
// says what the two kinds of components are, sets the server up in five clients, lists the tools
// and links the files any agent can read. Its search metadata is checked by seo.spec.ts.

const CLIENTS = [
    ["Claude Code", "claude", ".mcp.json"],
    ["Cursor", "cursor", ".cursor/mcp.json"],
    ["VS Code", "vscode", ".vscode/mcp.json"],
    ["Codex", "codex", "~/.codex/config.toml"],
    ["OpenCode", "opencode", "opencode.json"],
] as const;

test("the MCP page: header, the two kinds, a tab per client, the tools", async ({
    page,
}) => {
    await page.goto("mcp/");
    await expect(page.getByTestId("site-header")).toBeVisible();
    const main = page.getByTestId("mcp");
    await expect(
        main.getByRole("heading", { level: 1, name: "Fragiola for AI agents" }),
    ).toBeVisible();
    await expect(main).toContainText("source code");
    await expect(main).toContainText("npm packages");
    await expect(main).toContainText(
        "install the adapter for your framework, which brings the core",
    );

    for (const [label, id, file] of CLIENTS) {
        await main.getByRole("tab", { name: label, exact: true }).click();
        const panel = main.getByRole("tabpanel");
        await expect(panel).toContainText(
            `npx fragiola@latest mcp init --client ${id}`,
        );
        await expect(panel).toContainText(file);
        await expect(panel).toContainText("fragiola@latest");
    }

    for (const tool of [
        "get_fragiola_overview",
        "list_components",
        "get_component",
        "get_api",
        "get_install_command",
    ]) {
        await expect(main.getByRole("cell", { name: tool })).toBeVisible();
    }
    await expect(
        main.getByRole("link", { name: "/agents/index.json" }),
    ).toHaveAttribute("href", "/agents/index.json");
});

test("the organization's landing links the MCP page, in a section and in the footer", async ({
    page,
}) => {
    await page.goto("");
    await page.getByRole("link", { name: "Set up the MCP server" }).click();
    await expect(page).toHaveURL(/\/mcp\/$/);
    await page.goto("");
    await expect(
        page
            .getByTestId("site-footer")
            .getByRole("link", { name: "MCP server" }),
    ).toHaveAttribute("href", "/mcp/");
});
