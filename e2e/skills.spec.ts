import { expect, test } from "@playwright/test";

// /skills/ (app/skills/page.tsx): the agent skills' page, organization-level, like /mcp/. Under the
// site header, it says what the fragiola skill teaches, how to install it, the agents it works
// with, and links the MCP server and the repository. Its search metadata is checked by
// seo.spec.ts.

test("the skills page: header, what the agent learns, the install command, the links", async ({
    page,
}) => {
    await page.goto("skills/");
    await expect(page.getByTestId("site-header")).toBeVisible();
    const main = page.getByTestId("skills");
    await expect(
        main.getByRole("heading", {
            level: 1,
            name: "Fragiola skills for AI agents",
        }),
    ).toBeVisible();
    for (const feature of ["Fragiola UI", "Palettes", "Headless libraries"]) {
        await expect(
            main.getByRole("heading", { level: 3, name: feature }),
        ).toBeVisible();
    }
    await expect(main).toContainText("npx skills add fragiola/skills");
    for (const agent of ["Claude Code", "Codex", "Cursor", "OpenCode"]) {
        await expect(
            main.getByRole("list", { name: "Agents" }).getByText(agent, {
                exact: true,
            }),
        ).toBeVisible();
    }
    await expect(
        main.getByRole("link", { name: "MCP server page" }),
    ).toHaveAttribute("href", "/mcp/");
    await expect(
        main.getByRole("link", { name: "View on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/fragiola/skills");
});

test("the landing and the MCP page link the skills page", async ({ page }) => {
    await page.goto("");
    await page.getByRole("link", { name: "Install the agent skills" }).click();
    await expect(page).toHaveURL(/\/skills\/$/);
    await page.goto("");
    await expect(
        page
            .getByTestId("site-footer")
            .getByRole("link", { name: "Agent skills" }),
    ).toHaveAttribute("href", "/skills/");
    await page.goto("mcp/");
    await expect(
        page
            .getByTestId("mcp")
            .getByRole("link", { name: "agent skills page" }),
    ).toHaveAttribute("href", "/skills/");
});
