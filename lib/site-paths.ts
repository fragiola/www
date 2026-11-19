// The AI agents docs space and its two entry pages. Plain constants with no imports,
// so client components (components/docs-chrome.tsx) can read them without pulling the server-side
// modules lib/seo.ts depends on.

/**
 * The AI agents docs space (content/ai/, lib/projects.ts): served at /ai/docs/**. Here, with no
 * imports, so scripts/prepare-site.ts checks it too (validateDocsSpace).
 */
export const AI_SPACE = {
    slug: "ai",
    title: "AI agents",
    description:
        "Fragiola for AI coding agents: the agent skills and the MCP server give Claude Code, Codex, Cursor, VS Code and OpenCode every component, docs page and API.",
} as const;
/** The docs spaces www writes itself, in content/<slug>/. */
export const DOCS_SPACES = [AI_SPACE] as const;

export const AI_DOCS_PATH = "/ai/docs/";
/** The MCP server's docs: its setup page. */
export const MCP_PATH = "/ai/docs/mcp/";
/** The agent skills' docs. */
export const SKILLS_PATH = "/ai/docs/skills/";
