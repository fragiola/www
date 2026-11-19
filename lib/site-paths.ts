// The organization-level pages, outside every project, and where the agent skills live. Plain
// constants with no imports, so client components (components/docs-chrome.tsx) can read them
// without pulling the server-side modules lib/seo.ts depends on.

/** The MCP server's page (app/mcp/page.tsx): an organization-level page, not a project. */
export const MCP_PATH = "/mcp/";
/** The agent skills' page (app/skills/page.tsx): an organization-level page, like /mcp/. */
export const SKILLS_PATH = "/skills/";
/** The skills' repository (fragiola/skills). */
export const SKILLS_REPO_URL = "https://github.com/fragiola/skills";
