import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";
import { Feature, Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { Section } from "@/components/landing/section";
import { SiteHeader } from "@/components/site-header";
import { siteHeader } from "@/lib/layout.shared";
import { getProject, getProjects } from "@/lib/projects";
import {
    MCP_DESCRIPTION,
    MCP_PATH,
    MCP_TITLE,
    organizationPageJsonLd,
    pageMetadata,
    SKILLS_PATH,
} from "@/lib/seo";

// /mcp/: Fragiola's MCP server for AI agents (fragiola/cli, `npx fragiola@latest mcp`). An
// organization-level page, not a project of projects.json: what the server gives an agent, how
// to set it up in each client, its tools, and the files any other agent can read
// (lib/agents.ts). Built from the landing pieces (components/landing/) and Fumadocs' tabs and
// code blocks, like a docs page. It says only what the CLI does today.

const HEADING = "Fragiola for AI agents";
const SERVER = { command: "npx", args: ["fragiola@latest", "mcp"] };

export const metadata: Metadata = pageMetadata({
    title: MCP_TITLE,
    description: MCP_DESCRIPTION,
    path: MCP_PATH,
});

const json = (value: unknown) => JSON.stringify(value, null, 2);

interface Client {
    id: string;
    label: string;
    /** the file `fragiola mcp init` writes, or where to paste the config */
    file: string;
    lang: "json" | "toml";
    config: string;
    next: string;
}

const CLIENTS: Client[] = [
    {
        id: "claude",
        label: "Claude Code",
        file: ".mcp.json",
        lang: "json",
        config: json({ mcpServers: { fragiola: SERVER } }),
        next: "Restart Claude Code and approve the fragiola server: /mcp shows its status.",
    },
    {
        id: "cursor",
        label: "Cursor",
        file: ".cursor/mcp.json",
        lang: "json",
        config: json({ mcpServers: { fragiola: SERVER } }),
        next: "Open Cursor Settings → MCP and enable the fragiola server.",
    },
    {
        id: "vscode",
        label: "VS Code",
        file: ".vscode/mcp.json",
        lang: "json",
        config: json({ servers: { fragiola: SERVER } }),
        next: "Open .vscode/mcp.json, click Start next to the fragiola server, then use Copilot Chat in agent mode.",
    },
    {
        id: "codex",
        label: "Codex",
        file: "~/.codex/config.toml",
        lang: "toml",
        config: [
            "[mcp_servers.fragiola]",
            'command = "npx"',
            'args = ["fragiola@latest", "mcp"]',
        ].join("\n"),
        next: "Codex keeps its servers outside the project: init prints this block for you to paste. Then restart Codex.",
    },
    {
        id: "opencode",
        label: "OpenCode",
        file: "opencode.json",
        lang: "json",
        config: json({
            $schema: "https://opencode.ai/config.json",
            mcp: {
                fragiola: {
                    type: "local",
                    command: [SERVER.command, ...SERVER.args],
                    enabled: true,
                },
            },
        }),
        next: "Restart OpenCode.",
    },
];

const TOOLS: { name: string; answers: string }[] = [
    {
        name: "get_fragiola_overview",
        answers:
            "What Fragiola is, its two kinds of components and every project. Where an agent starts.",
    },
    {
        name: "list_projects",
        answers: "Every project, its kind, its packages and how to install it.",
    },
    {
        name: "list_components",
        answers:
            "Fragiola UI's components and the libraries' API entries, filtered by kind, project or group.",
    },
    {
        name: "search_fragiola",
        answers: "A fuzzy search over the components and every docs page.",
    },
    {
        name: "get_component",
        answers:
            "A component or library by name: its install command, dependencies, files, docs and, for Fragiola UI, its source.",
    },
    {
        name: "get_docs",
        answers: "A project's pages, or one page as Markdown.",
    },
    {
        name: "get_api",
        answers: "A library's API reference: primitives, model, commands.",
    },
    {
        name: "get_install_command",
        answers:
            "The exact commands: the registry and shadcn add for Fragiola UI, and for a library the npm install of its adapter, one per framework (or only the one asked for).",
    },
];

const PROMPTS = [
    "Which Fragiola components exist for forms?",
    "Add a Fragiola select to this form, styled with the palette roles.",
    "Which Fragiola library gives me dockable panels, and how do I install it?",
    "Show me the API of Dockable's Tab primitive.",
];

function Code({
    title,
    lang,
    children,
}: {
    title?: string;
    lang: string;
    children: string;
}) {
    return (
        <CodeBlock title={title} data-lang={lang} className="my-0">
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

export default function McpPage() {
    const ui = getProject("ui");
    const libraries = getProjects().filter((project) => !project.registry);
    return (
        <>
            <JsonLd
                items={organizationPageJsonLd({
                    path: MCP_PATH,
                    title: HEADING,
                    description: MCP_DESCRIPTION,
                })}
            />
            <SiteHeader {...siteHeader()} />
            <main
                data-testid="mcp"
                className="landing flex flex-1 flex-col pb-24"
            >
                <Hero
                    eyebrow="MCP server"
                    title={HEADING}
                    description="An MCP server that gives your coding agent every Fragiola component, docs page and API, and knows which ones are source code to copy and which are npm packages to install."
                    background="grid"
                    actions={[
                        {
                            label: "Set it up",
                            href: "#setup",
                            variant: "primary",
                            icon: "arrow",
                        },
                        {
                            label: "Read llms.txt",
                            href: "/llms.txt",
                            variant: "secondary",
                        },
                    ]}
                />

                <Section
                    eyebrow="What the agent learns"
                    title="Two kinds of components, never mixed up"
                    description="Fragiola ships components in two ways. The server says which one every item is, and how to use it."
                >
                    <Features columns={2}>
                        <Feature
                            title={`${ui?.title ?? "Fragiola UI"}: source code`}
                        >
                            Components on Base UI and Tailwind v4, copied into
                            your project with{" "}
                            <code className={inlineCode}>
                                npx shadcn@latest add{" "}
                                {ui?.registry?.namespace ?? "@fragiola"}
                                /&lt;name&gt;
                            </code>
                            . The code is yours, styled with six palette roles.
                        </Feature>
                        <Feature title="Libraries: npm packages">
                            Headless libraries
                            {libraries.length > 0
                                ? ` (${libraries.map((project) => project.title).join(", ")})`
                                : ""}
                            : install the adapter for your framework, which
                            brings the core, and import everything from it.
                            Behaviour and accessibility, no CSS.
                        </Feature>
                    </Features>
                </Section>

                <Section
                    id="setup"
                    eyebrow="Quick start"
                    title="Set it up in your client"
                    description="Run one command in your project. It writes the client's config, keeps your other servers, and changes nothing on a second run."
                >
                    <div className="not-prose flex flex-col gap-4">
                        <Tabs items={CLIENTS.map((client) => client.label)}>
                            {CLIENTS.map((client) => (
                                <Tab
                                    key={client.id}
                                    value={client.label}
                                    data-client={client.id}
                                >
                                    <div className="flex flex-col gap-4">
                                        <Code lang="bash">
                                            {`npx fragiola@latest mcp init --client ${client.id}`}
                                        </Code>
                                        <Prose>{client.next}</Prose>
                                        <Prose>
                                            Or configure it by hand in{" "}
                                            <code className={inlineCode}>
                                                {client.file}
                                            </code>
                                            :
                                        </Prose>
                                        <Code
                                            title={client.file}
                                            lang={client.lang}
                                        >
                                            {client.config}
                                        </Code>
                                    </div>
                                </Tab>
                            ))}
                        </Tabs>
                        <Prose>
                            Every client runs{" "}
                            <code className={inlineCode}>
                                npx fragiola@latest mcp
                            </code>
                            , so the server is always the latest one, and
                            nothing is added to your dependencies. It needs
                            Node.js 24 or later.
                        </Prose>
                    </div>
                </Section>

                <Section
                    eyebrow="Tools"
                    title="What the agent can ask"
                    description="Every answer is Markdown written for an agent, and names the next tool or command to run."
                >
                    <div className="not-prose overflow-x-auto rounded-lg border border-palette-line">
                        <table className="w-full border-collapse text-start text-sm">
                            <thead className="bg-palette-soft text-palette-contrast">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-4 py-2 text-start font-medium"
                                    >
                                        Tool
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-2 text-start font-medium"
                                    >
                                        Answers
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {TOOLS.map((tool) => (
                                    <tr
                                        key={tool.name}
                                        className="border-palette-line border-t"
                                    >
                                        <td className="whitespace-nowrap px-4 py-2 font-mono text-palette-contrast">
                                            {tool.name}
                                        </td>
                                        <td className="px-4 py-2 text-palette-accent/85">
                                            {tool.answers}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>

                <Section
                    eyebrow="Try it"
                    title="Ask your agent"
                    description="Once the server is running, ask in plain words. The agent picks the tools."
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
                    eyebrow="Any agent"
                    title="Without MCP"
                    description="The server reads files the site publishes for agents. Any agent or tool can read them too."
                >
                    <ul className="not-prose flex list-none flex-col gap-3 p-0 text-palette-accent/85">
                        <li>
                            <a
                                href="/llms.txt"
                                className="font-medium text-palette-contrast underline underline-offset-4"
                            >
                                /llms.txt
                            </a>
                            : the entry point, with every docs page linked as
                            Markdown.
                        </li>
                        <li>
                            <a
                                href="/agents/index.json"
                                className="font-medium text-palette-contrast underline underline-offset-4"
                            >
                                /agents/index.json
                            </a>
                            : every project, its kind, packages, pages, examples
                            and components.
                        </li>
                        <li>
                            <a
                                href="/agents/overview.md"
                                className="font-medium text-palette-contrast underline underline-offset-4"
                            >
                                /agents/overview.md
                            </a>
                            : the ecosystem, written for agents.
                        </li>
                    </ul>
                </Section>

                <Section
                    eyebrow="Better together"
                    title="Pair it with the agent skills"
                    description="The server answers what exists; the fragiola skill teaches the agent how to build with it: palettes, composition and the libraries."
                >
                    <Prose>
                        Install it with{" "}
                        <code className={inlineCode}>
                            npx skills add fragiola/skills
                        </code>
                        . More on the{" "}
                        <a
                            href={SKILLS_PATH}
                            className="font-medium text-palette-contrast underline underline-offset-4"
                        >
                            agent skills page
                        </a>
                        .
                    </Prose>
                </Section>

                <Section
                    eyebrow="Troubleshooting"
                    title="If the server does not answer"
                >
                    <ul className="not-prose flex list-disc flex-col gap-2 ps-5 text-palette-accent/85">
                        <li>
                            Run{" "}
                            <code className={inlineCode}>
                                npx fragiola@latest mcp
                            </code>{" "}
                            in a terminal. It should wait silently for input.
                            Check that Node.js 24 or later is on the client's
                            PATH, then restart the client.
                        </li>
                        <li>
                            No tools listed: enable the fragiola server in the
                            client, and restart it after{" "}
                            <code className={inlineCode}>mcp init</code>.
                        </li>
                        <li>
                            A config file with comments (JSONC) is never
                            overwritten: add the entry by hand.
                        </li>
                        <li>
                            The source and the issues are on{" "}
                            <a
                                href="https://github.com/fragiola/cli"
                                className="font-medium text-palette-contrast underline underline-offset-4"
                            >
                                GitHub
                            </a>
                            .
                        </li>
                    </ul>
                </Section>
            </main>
        </>
    );
}
