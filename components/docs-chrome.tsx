"use client";

import {
    Bot,
    Check,
    ChevronRight,
    ChevronsUpDown,
    LayoutGrid,
    type LucideIcon,
    Plug,
    Sparkles,
} from "lucide-react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { FrameworkSelect } from "@/components/framework";
import {
    GitHubIcon,
    SearchButton,
    ThemeToggle,
    Wordmark,
} from "@/components/site-controls";
import type { HeaderContext, HeaderProject } from "@/components/site-header";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { MCP_PATH, SKILLS_PATH } from "@/lib/site-paths";

// The docs' chrome (rule 9): the docs have no site header, its navigation lives in the sidebar,
// the same for every project, as on fumadocs.dev.
//
// - the sidebar's first row: the wordmark (→ /), then Fumadocs' collapse toggle;
// - its top: the AI agents block (the agent skills and the MCP server, the same on every page, so
//   it is plain that agents can build with Fragiola), the project switcher (every project of projects.json, Fragiola UI's dropdown-menu,
//   copied from ui's registry), the search field, the project's Docs | Examples, the framework
//   select when the project has several;
// - its footer: the project's GitHub and Fragiola's;
// - the theme toggle in the panel's top-right corner (DocsCorner), and on small screens in
//   Fumadocs' bar, beside the search button (DocsBarControls).

export interface DocsChromeProps {
    projects: HeaderProject[];
    current: HeaderContext;
    repoUrl: string;
    organizationUrl: string;
    frameworks: string[];
}

/** The wordmark in Fumadocs' `navTitle` slot: the sidebar's first row and the small-screen bar. */
export function DocsNavTitle({ className }: { className?: string }) {
    return (
        <span className={cn("me-auto self-center ps-1", className)}>
            <Wordmark />
        </span>
    );
}

const ROW =
    "flex w-full items-center gap-2.5 rounded-md border border-fd-border bg-fd-secondary/50 px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-fd-accent/60 focus-visible:outline-2 focus-visible:outline-fd-ring";

function ProjectSwitcher({
    projects,
    current,
}: {
    projects: HeaderProject[];
    current: HeaderContext;
}) {
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger
                data-testid="project-switcher"
                aria-label={`Project: ${current.title}. Switch project`}
                className={cn(ROW, "data-popup-open:bg-fd-accent/60")}
            >
                <LayoutGrid
                    aria-hidden
                    className="size-4 shrink-0 text-fd-primary"
                />
                <span className="min-w-0 flex-1 truncate font-medium text-fd-foreground">
                    {current.title}
                </span>
                <ChevronsUpDown
                    aria-hidden
                    className="size-4 shrink-0 text-fd-muted-foreground"
                />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
                data-testid="project-switcher-menu"
                className="w-(--anchor-width) min-w-64"
            >
                <DropdownMenu.Group>
                    <DropdownMenu.Label>Projects</DropdownMenu.Label>
                    {projects.map((project) => {
                        const selected = project.slug === current.slug;
                        return (
                            <DropdownMenu.Item
                                key={project.slug}
                                aria-current={selected ? "page" : undefined}
                                render={<NextLink href={project.docsUrl} />}
                                className="items-start"
                            >
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="font-medium">
                                        {project.title}
                                    </span>
                                    <span className="line-clamp-2 text-palette-accent/85 text-xs">
                                        {project.description}
                                    </span>
                                </span>
                                {selected ? (
                                    <Check
                                        aria-hidden
                                        className="mt-0.5 size-4 shrink-0"
                                    />
                                ) : null}
                            </DropdownMenu.Item>
                        );
                    })}
                </DropdownMenu.Group>
                <DropdownMenu.Separator />
                <DropdownMenu.Item render={<NextLink href="/" />}>
                    All projects
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}

const AGENT_LINKS: { href: string; title: string; icon: LucideIcon }[] = [
    { href: SKILLS_PATH, title: "Agent skills", icon: Sparkles },
    { href: MCP_PATH, title: "MCP server", icon: Plug },
];

/** The AI agents block: Fragiola's agent skills and MCP server, on every docs page. */
function DocsAgentLinks() {
    return (
        <nav
            data-testid="docs-agent-links"
            aria-label="For AI agents"
            className="flex flex-col gap-0.5 rounded-md border border-fd-primary/25 bg-fd-primary/5 p-1"
        >
            <p
                aria-hidden
                className="flex items-center gap-1.5 px-1.5 pt-1 pb-0.5 font-medium text-fd-muted-foreground text-xs"
            >
                <Bot aria-hidden className="size-3.5 text-fd-primary" />
                Built for AI agents
            </p>
            {AGENT_LINKS.map(({ href, title, icon: Icon }) => (
                <NextLink
                    key={href}
                    href={href}
                    className="group flex items-center gap-2.5 rounded-sm px-1.5 py-1 text-fd-foreground text-sm transition-colors hover:bg-fd-primary/10 focus-visible:outline-2 focus-visible:outline-fd-ring"
                >
                    <Icon
                        aria-hidden
                        className="size-4 shrink-0 text-fd-primary"
                    />
                    <span className="flex-1 truncate font-medium">{title}</span>
                    <ChevronRight
                        aria-hidden
                        className="size-3.5 shrink-0 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                </NextLink>
            ))}
        </nav>
    );
}

function DocsTabs({ current }: { current: HeaderContext }) {
    const tab =
        "flex flex-1 items-center justify-center rounded-sm px-2 py-1 font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-fd-ring";
    return (
        <nav
            aria-label={`${current.title} sections`}
            className="flex gap-1 rounded-md border border-fd-border bg-fd-secondary/50 p-0.5"
        >
            <NextLink
                href={current.docsUrl}
                aria-current="page"
                className={cn(
                    tab,
                    "bg-fd-background text-fd-foreground shadow-xs",
                )}
            >
                Docs
            </NextLink>
            {current.examplesUrl ? (
                <NextLink
                    href={current.examplesUrl}
                    className={cn(
                        tab,
                        "text-fd-muted-foreground hover:bg-fd-accent/60 hover:text-fd-foreground",
                    )}
                >
                    Examples
                </NextLink>
            ) : null}
        </nav>
    );
}

/** The sidebar's top (`sidebar.banner`): the same for every project. */
export function DocsSidebarTop({
    projects,
    current,
    frameworks,
}: DocsChromeProps) {
    return (
        <div data-testid="docs-sidebar-top" className="flex flex-col gap-2">
            <DocsAgentLinks />
            <ProjectSwitcher projects={projects} current={current} />
            <SearchButton variant="field" />
            <DocsTabs current={current} />
            {frameworks.length > 1 ? (
                <FrameworkSelect frameworks={frameworks} />
            ) : null}
        </div>
    );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-fd-muted-foreground text-sm transition-colors hover:bg-fd-accent/60 hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-fd-ring"
        >
            <GitHubIcon className="size-4 shrink-0" />
            {children}
        </a>
    );
}

/** The sidebar's footer (`sidebar.footer`): the project's GitHub, then Fragiola's. */
export function DocsSidebarFooter({
    current,
    repoUrl,
    organizationUrl,
}: DocsChromeProps) {
    return (
        <nav
            data-testid="docs-sidebar-footer"
            aria-label="GitHub"
            className="flex flex-col gap-0.5"
        >
            {repoUrl !== organizationUrl ? (
                <FooterLink href={repoUrl}>
                    {current.title} on GitHub
                </FooterLink>
            ) : null}
            <FooterLink href={organizationUrl}>Fragiola on GitHub</FooterLink>
        </nav>
    );
}

/** The panel's top-right corner (from md): the theme toggle, room for more later. */
export function DocsCorner() {
    return (
        <div data-testid="docs-corner" className="docs-corner">
            <ThemeToggle />
        </div>
    );
}

/** Fumadocs' small-screen bar, after the wordmark: search and the theme (`nav.children`). */
export function DocsBarControls() {
    return (
        <div className="flex items-center justify-end gap-0.5 md:hidden">
            <SearchButton variant="icon" />
            <ThemeToggle />
        </div>
    );
}
