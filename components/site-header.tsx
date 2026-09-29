"use client";

import { useSearchContext } from "fumadocs-ui/contexts/search";
import { Menu, Moon, Search, Sun, X } from "lucide-react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useId, useState } from "react";
import { NavigationMenu } from "@/components/ui/navigation-menu";
import { cn } from "@/lib/cn";

// The site header, the same on every page (the organization's landing, a project's landing, its
// docs, its gallery): the wordmark (→ /), the Projects menu (every project of projects.json), then,
// under /<slug>/**, the project's own context: its title (→ its landing), Docs and Examples. On
// the right: search, the site theme, GitHub (the project's repository, the organization's on /).
//
// The Projects menu is Fragiola UI's navigation-menu (components/ui/, copied from ui's registry
// by `pnpm registry:copy`), its links Next links: moving between projects is client-side. Below
// `md` the same entries collapse into a menu. `leading` is a slot before the wordmark (the
// gallery's examples-list toggle).

export interface HeaderProject {
    slug: string;
    title: string;
    description: string;
}

export interface HeaderContext {
    slug: string;
    title: string;
    docsUrl: string;
    examplesUrl?: string;
}

export interface SiteHeaderProps {
    projects: HeaderProject[];
    current?: HeaderContext;
    repoUrl: string;
}

type Section = "landing" | "docs" | "examples" | undefined;

function sectionOf(pathname: string, current?: HeaderContext): Section {
    if (!current) return undefined;
    const base = `/${current.slug}/`;
    const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
    if (path === base) return "landing";
    if (path.startsWith(`${base}docs/`)) return "docs";
    if (path.startsWith(`${base}examples/`)) return "examples";
    return undefined;
}

const item =
    "inline-flex h-8 items-center rounded-md px-3 font-medium text-palette-accent/85 text-sm transition-colors hover:bg-palette-soft hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-palette-ring aria-[current=page]:text-palette-contrast";

const iconButton =
    "inline-flex size-8 items-center justify-center rounded-md text-palette-accent/85 transition-colors hover:bg-palette-soft hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4";

function GitHubIcon({ className }: { className?: string }) {
    return (
        <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3" />
        </svg>
    );
}

function Wordmark() {
    return (
        <NextLink
            href="/"
            className="inline-flex items-center gap-2 rounded-md font-semibold text-base text-palette-contrast tracking-tight focus-visible:outline-2 focus-visible:outline-palette-ring"
        >
            <span
                aria-hidden
                className="palette-purple grid size-5 place-items-center rounded-sm bg-palette-base"
            >
                <span className="size-2 rounded-[2px] bg-palette-contrast" />
            </span>
            Fragiola
        </NextLink>
    );
}

function SearchButton() {
    const { enabled, hotKey, setOpenSearch } = useSearchContext();
    if (!enabled) return null;
    return (
        <>
            <button
                type="button"
                data-search-full=""
                onClick={() => setOpenSearch(true)}
                className="hidden h-8 w-52 items-center gap-2 rounded-md border border-palette-line bg-palette-soft/50 ps-2.5 pe-1.5 text-palette-accent/85 text-sm transition-colors hover:bg-palette-soft hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-palette-ring lg:inline-flex"
            >
                <Search aria-hidden className="size-4" />
                Search
                <span className="ms-auto inline-flex gap-0.5">
                    {hotKey.map((key, index) => (
                        <kbd
                            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of keys
                            key={index}
                            className="rounded-sm border border-palette-line bg-palette-base px-1.5 font-sans text-xs"
                        >
                            {key.display}
                        </kbd>
                    ))}
                </span>
            </button>
            <button
                type="button"
                data-search=""
                aria-label="Open search"
                onClick={() => setOpenSearch(true)}
                className={cn(iconButton, "lg:hidden")}
            >
                <Search aria-hidden />
            </button>
        </>
    );
}

function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const dark = mounted && resolvedTheme === "dark";
    return (
        <button
            type="button"
            data-theme-toggle=""
            aria-label="Toggle theme"
            onClick={() => setTheme(dark ? "light" : "dark")}
            className={iconButton}
        >
            {dark ? <Moon aria-hidden /> : <Sun aria-hidden />}
        </button>
    );
}

function ProjectCard({
    project,
    current,
    section,
}: {
    project: HeaderProject;
    current: boolean;
    section: Section;
}) {
    // the current project is marked; `aria-current="page"` only on its landing, the page it
    // links to
    return (
        <NavigationMenu.Link
            active={current && section === "landing"}
            data-current={current ? "" : undefined}
            closeOnClick
            render={<NextLink href={`/${project.slug}/`} />}
            className="group flex h-full flex-col gap-1 rounded-md p-3 transition-colors hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring data-current:bg-palette-soft/60"
        >
            <span className="flex items-center gap-2 font-medium text-palette-contrast text-sm">
                {project.title}
                {current ? (
                    <span className="rounded-full border border-palette-line px-1.5 font-normal text-[0.6875rem] text-palette-accent/85">
                        current
                    </span>
                ) : null}
            </span>
            <span className="line-clamp-2 text-palette-accent/85 text-xs leading-relaxed">
                {project.description}
            </span>
        </NavigationMenu.Link>
    );
}

function DesktopNav({
    projects,
    current,
    section,
}: {
    projects: HeaderProject[];
    current?: HeaderContext;
    section: Section;
}) {
    return (
        <NavigationMenu.Root
            aria-label="Site"
            className="ms-4 hidden flex-row items-center md:flex"
        >
            <NavigationMenu.List>
                <NavigationMenu.Item value="projects">
                    <NavigationMenu.Trigger>Projects</NavigationMenu.Trigger>
                    <NavigationMenu.Content>
                        <p className="px-3 pt-1 font-mono text-[0.6875rem] text-palette-accent/85 uppercase tracking-widest">
                            Projects
                        </p>
                        <ul
                            aria-label="Projects"
                            className={cn(
                                "grid w-[min(34rem,calc(100vw-2rem))] list-none gap-1 p-0",
                                projects.length > 1 && "sm:grid-cols-2",
                            )}
                        >
                            {projects.map((project) => (
                                <li key={project.slug}>
                                    <ProjectCard
                                        project={project}
                                        current={project.slug === current?.slug}
                                        section={section}
                                    />
                                </li>
                            ))}
                        </ul>
                    </NavigationMenu.Content>
                </NavigationMenu.Item>
                {current ? (
                    <>
                        <li
                            aria-hidden
                            className="mx-1 h-4 w-px bg-palette-line"
                        />
                        <NavigationMenu.Item>
                            <NavigationMenu.Link
                                active={section === "landing"}
                                render={<NextLink href={`/${current.slug}/`} />}
                                className={cn(item, "text-palette-contrast")}
                            >
                                {current.title}
                            </NavigationMenu.Link>
                        </NavigationMenu.Item>
                        <NavigationMenu.Item>
                            <NavigationMenu.Link
                                active={section === "docs"}
                                render={<NextLink href={current.docsUrl} />}
                                className={item}
                            >
                                Docs
                            </NavigationMenu.Link>
                        </NavigationMenu.Item>
                        {current.examplesUrl ? (
                            <NavigationMenu.Item>
                                <NavigationMenu.Link
                                    active={section === "examples"}
                                    render={
                                        <NextLink href={current.examplesUrl} />
                                    }
                                    className={item}
                                >
                                    Examples
                                </NavigationMenu.Link>
                            </NavigationMenu.Item>
                        ) : null}
                    </>
                ) : null}
            </NavigationMenu.List>
            <NavigationMenu.Portal>
                <NavigationMenu.Positioner
                    side="bottom"
                    align="start"
                    sideOffset={10}
                    collisionPadding={16}
                >
                    <NavigationMenu.Popup className="shadow-xl">
                        <NavigationMenu.Viewport />
                    </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
            </NavigationMenu.Portal>
        </NavigationMenu.Root>
    );
}

function MobileNav({
    projects,
    current,
    section,
    repoUrl,
    id,
    onNavigate,
}: SiteHeaderProps & {
    section: Section;
    id: string;
    onNavigate: () => void;
}) {
    const link = (active: boolean) =>
        cn(
            "flex rounded-md px-3 py-2 text-palette-accent/85 text-sm hover:bg-palette-soft hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-palette-ring",
            active && "bg-palette-soft/60 text-palette-contrast",
        );
    return (
        <nav
            id={id}
            aria-label="Site"
            className="palette-raised absolute inset-x-0 top-full max-h-[calc(100dvh-var(--site-header-height))] overflow-y-auto border-palette-line border-b bg-palette-base shadow-xl md:hidden"
        >
            <div className="flex flex-col gap-4 px-4 py-4">
                {current ? (
                    <ul className="flex list-none flex-col gap-0.5 p-0">
                        <li>
                            <NextLink
                                href={`/${current.slug}/`}
                                aria-current={
                                    section === "landing" ? "page" : undefined
                                }
                                className={cn(
                                    link(section === "landing"),
                                    "font-semibold text-palette-contrast",
                                )}
                                onClick={onNavigate}
                            >
                                {current.title}
                            </NextLink>
                        </li>
                        <li>
                            <NextLink
                                href={current.docsUrl}
                                aria-current={
                                    section === "docs" ? "page" : undefined
                                }
                                className={link(section === "docs")}
                                onClick={onNavigate}
                            >
                                Docs
                            </NextLink>
                        </li>
                        {current.examplesUrl ? (
                            <li>
                                <NextLink
                                    href={current.examplesUrl}
                                    aria-current={
                                        section === "examples"
                                            ? "page"
                                            : undefined
                                    }
                                    className={link(section === "examples")}
                                    onClick={onNavigate}
                                >
                                    Examples
                                </NextLink>
                            </li>
                        ) : null}
                    </ul>
                ) : null}
                <div className="flex flex-col gap-1">
                    <p className="px-3 font-mono text-[0.6875rem] text-palette-accent/85 uppercase tracking-widest">
                        Projects
                    </p>
                    <ul
                        aria-label="Projects"
                        className="flex list-none flex-col gap-0.5 p-0"
                    >
                        {projects.map((project) => (
                            <li key={project.slug}>
                                <NextLink
                                    href={`/${project.slug}/`}
                                    aria-current={
                                        project.slug === current?.slug &&
                                        section === "landing"
                                            ? "page"
                                            : undefined
                                    }
                                    className={cn(
                                        link(project.slug === current?.slug),
                                        "flex-col gap-0.5",
                                    )}
                                    onClick={onNavigate}
                                >
                                    <span className="font-medium text-palette-contrast">
                                        {project.title}
                                    </span>
                                    <span className="text-xs">
                                        {project.description}
                                    </span>
                                </NextLink>
                            </li>
                        ))}
                    </ul>
                </div>
                <a
                    href={repoUrl}
                    className={cn(link(false), "items-center gap-2")}
                >
                    <GitHubIcon className="size-4" />
                    GitHub
                </a>
            </div>
        </nav>
    );
}

export function SiteHeader({
    projects,
    current,
    repoUrl,
    leading,
    className,
}: SiteHeaderProps & { leading?: ReactNode; className?: string }) {
    const pathname = usePathname();
    const section = sectionOf(pathname, current);
    const [open, setOpen] = useState(false);
    const menuId = useId();

    // a navigation closes the small-screen menu
    // biome-ignore lint/correctness/useExhaustiveDependencies: the pathname is the trigger
    useEffect(() => setOpen(false), [pathname]);

    return (
        <header
            data-testid="site-header"
            className={cn(
                "palette-surface sticky top-0 z-40 h-(--site-header-height) shrink-0 border-palette-line border-b bg-palette-base/80 text-palette-contrast backdrop-blur-md",
                className,
            )}
        >
            <div className="flex h-full w-full items-center gap-2 px-4 sm:px-6">
                {leading}
                <Wordmark />
                {current ? (
                    <NextLink
                        href={`/${current.slug}/`}
                        className="truncate rounded-md px-1 font-medium text-palette-accent/85 text-sm focus-visible:outline-2 focus-visible:outline-palette-ring md:hidden"
                    >
                        <span aria-hidden className="pe-1 text-palette-line">
                            /
                        </span>
                        {current.title}
                    </NextLink>
                ) : null}
                <DesktopNav
                    projects={projects}
                    section={section}
                    {...(current ? { current } : {})}
                />
                <div className="ms-auto flex items-center gap-1">
                    <SearchButton />
                    <ThemeToggle />
                    <a
                        href={repoUrl}
                        aria-label="GitHub"
                        className={cn(iconButton, "max-md:hidden")}
                    >
                        <GitHubIcon />
                    </a>
                    <button
                        type="button"
                        aria-label="Menu"
                        aria-expanded={open}
                        aria-controls={menuId}
                        className={cn(iconButton, "md:hidden")}
                        onClick={() => setOpen((value) => !value)}
                    >
                        {open ? <X aria-hidden /> : <Menu aria-hidden />}
                    </button>
                </div>
            </div>
            {open ? (
                <MobileNav
                    projects={projects}
                    section={section}
                    repoUrl={repoUrl}
                    id={menuId}
                    onNavigate={() => setOpen(false)}
                    {...(current ? { current } : {})}
                />
            ) : null}
        </header>
    );
}
