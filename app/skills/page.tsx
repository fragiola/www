import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";
import { Feature, Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { Section } from "@/components/landing/section";
import { SiteHeader } from "@/components/site-header";
import { siteHeader } from "@/lib/layout.shared";
import {
    MCP_PATH,
    organizationPageJsonLd,
    pageMetadata,
    SKILLS_DESCRIPTION,
    SKILLS_PATH,
    SKILLS_REPO_URL,
    SKILLS_TITLE,
} from "@/lib/seo";

// /skills/: Fragiola's agent skills (fragiola/skills). An organization-level page, like /mcp/:
// what the `fragiola` skill teaches an agent, how to install it, the agents it works with and how
// it pairs with the MCP server. Built from the landing pieces (components/landing/) and Fumadocs'
// code blocks. It says only what fragiola/skills does today.

const HEADING = "Fragiola skills for AI agents";

export const metadata: Metadata = pageMetadata({
    title: SKILLS_TITLE,
    description: SKILLS_DESCRIPTION,
    path: SKILLS_PATH,
});

const AGENTS = ["Claude Code", "Codex", "Cursor", "OpenCode"];

/** The libraries the skill has pages for (fragiola/skills, skills/fragiola/libraries/). */
const LIBRARIES = "Dockable, Data Grid and Grid Layout";

const PROMPTS = [
    "Build a settings form with Fragiola fields and a danger palette for errors.",
    "Port this shadcn dialog to Fragiola UI.",
    "Add a dockable layout with tabs and a side panel.",
    "Show a million rows with the Fragiola data grid.",
];

function Code({ title, children }: { title?: string; children: string }) {
    return (
        <CodeBlock title={title} data-lang="bash" className="my-0">
            <Pre>
                <code>{children}</code>
            </Pre>
        </CodeBlock>
    );
}

function Prose({ children }: { children: ReactNode }) {
    return <p className="text-palette-accent/85">{children}</p>;
}

const inlineCode =
    "rounded-sm bg-palette-soft px-1 py-0.5 font-mono text-[0.9em] text-palette-contrast";

const link = "font-medium text-palette-contrast underline underline-offset-4";

export default function SkillsPage() {
    return (
        <>
            <JsonLd
                items={organizationPageJsonLd({
                    path: SKILLS_PATH,
                    title: HEADING,
                    description: SKILLS_DESCRIPTION,
                })}
            />
            <SiteHeader {...siteHeader()} />
            <main
                data-testid="skills"
                className="landing flex flex-1 flex-col pb-24"
            >
                <Hero
                    eyebrow="Agent skills"
                    title={HEADING}
                    description="A skill your coding agent loads when it works with Fragiola: the components, the palettes, the composition rules and the headless libraries, so the code it writes is the code we would write."
                    background="grid"
                    actions={[
                        {
                            label: "Install the skill",
                            href: "#install",
                            variant: "primary",
                            icon: "arrow",
                        },
                        {
                            label: "View on GitHub",
                            href: SKILLS_REPO_URL,
                            variant: "secondary",
                        },
                    ]}
                />

                <Section
                    eyebrow="What the agent learns"
                    title="Fragiola's rules, before it writes a line"
                    description="The fragiola skill follows the Agent Skills format: the agent reads it only when the task is about Fragiola."
                >
                    <Features columns={3}>
                        <Feature title="Fragiola UI">
                            Which components exist, how to add them with the
                            shadcn CLI, and how to compose them: one namespace
                            per component,{" "}
                            <code className={inlineCode}>render</code> instead
                            of <code className={inlineCode}>asChild</code>,
                            complete dialogs and fields.
                        </Feature>
                        <Feature title="Palettes">
                            Colour comes from palettes and their six roles,
                            never from raw colours. Fields, invalid states,
                            secondary text and themes, the way the design system
                            expects.
                        </Feature>
                        <Feature title="Headless libraries">
                            The npm packages ({LIBRARIES}): which adapter to
                            install, what to import and how to style them
                            through their state.
                        </Feature>
                    </Features>
                </Section>

                <Section
                    id="install"
                    eyebrow="Quick start"
                    title="Install it in your project"
                    description="One command, with the skills CLI. It copies the skill where your agent reads it."
                >
                    <div className="not-prose flex flex-col gap-4">
                        <Code>npx skills add fragiola/skills</Code>
                        <Prose>
                            Add <code className={inlineCode}>-g</code> to
                            install it for every project, or{" "}
                            <code className={inlineCode}>-a &lt;agent&gt;</code>{" "}
                            to pick the agent. Without the CLI, copy{" "}
                            <code className={inlineCode}>skills/fragiola/</code>{" "}
                            from the{" "}
                            <a href={SKILLS_REPO_URL} className={link}>
                                repository
                            </a>{" "}
                            into your agent&apos;s skills folder:
                        </Prose>
                        <Code title="Claude Code">
                            {"cp -r skills/fragiola .claude/skills/"}
                        </Code>
                        <Code title="Codex, Cursor, OpenCode and other agents">
                            {"cp -r skills/fragiola .agents/skills/"}
                        </Code>
                    </div>
                </Section>

                <Section
                    eyebrow="Any agent"
                    title="Works with the agents you use"
                    description="Agent Skills is an open format: these agents read it, and so does any other agent that supports skills."
                >
                    <ul
                        aria-label="Agents"
                        className="not-prose flex list-none flex-wrap gap-2 p-0"
                    >
                        {AGENTS.map((agent) => (
                            <li
                                key={agent}
                                className="rounded-md border border-palette-line bg-palette-soft/40 px-3 py-1.5 text-palette-contrast text-sm"
                            >
                                {agent}
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section
                    eyebrow="Try it"
                    title="Ask your agent"
                    description="Once the skill is installed, ask in plain words. The agent loads it when the task is about Fragiola."
                >
                    <ul className="not-prose flex list-none flex-col gap-2 p-0">
                        {PROMPTS.map((prompt) => (
                            <li
                                key={prompt}
                                className="rounded-md border border-palette-line bg-palette-soft/40 px-4 py-3 text-palette-contrast"
                            >
                                “{prompt}”
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section
                    eyebrow="Better together"
                    title="Pair it with the MCP server"
                    description="The skill teaches the rules; the MCP server gives the agent the current components, docs and APIs on demand. The skill tells the agent when to use each tool."
                >
                    <Prose>
                        Set up the server in your client on the{" "}
                        <a href={MCP_PATH} className={link}>
                            MCP server page
                        </a>
                        . The skill&apos;s source and its issues are on{" "}
                        <a href={SKILLS_REPO_URL} className={link}>
                            GitHub
                        </a>
                        .
                    </Prose>
                </Section>
            </main>
        </>
    );
}
