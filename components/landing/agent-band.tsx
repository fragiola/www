import { MCP_PATH, SKILLS_PATH } from "@/lib/site-paths";
import { ActionLink } from "./action";
import { Section } from "./section";

// The agent band (CONTRACT.md §3.5, v1.7): the same block on every project's landing, owned by
// www like the adapters row and the project footer, never written by a project. It sits right
// after the landing's showcase <Example> (after the Hero when there is none): the fastest way to
// build with a project is the reader's coding agent, given the MCP server and the agent skills;
// the docs come second. Placed by lib/agent-band.ts, a remark step over the landing.

export const AGENT_BAND = {
    eyebrow: "Build with your agent",
    title: "Docs are for reading. Your agent can just know it.",
    description:
        "The Fragiola MCP server gives Claude Code, Codex, Cursor and OpenCode every component, docs page and API of the whole ecosystem, and the agent skills teach them its rules. Your agent builds instead of reading how to.",
} as const;

export function AgentBand() {
    return (
        <Section testId="agent-band" {...AGENT_BAND}>
            <div className="not-prose flex flex-wrap items-center gap-3">
                <ActionLink
                    label="Set up the MCP server"
                    href={MCP_PATH}
                    variant="primary"
                    icon="arrow"
                />
                <ActionLink
                    label="Install the agent skills"
                    href={SKILLS_PATH}
                    variant="secondary"
                />
            </div>
        </Section>
    );
}
