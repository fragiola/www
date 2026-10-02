"use client";

import { PanelLeft, Search, X } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";
import { defaultTheme, useSiteScheme } from "@/components/example-theme";
import {
    ProjectProvider,
    setFramework,
    useFramework,
} from "@/components/framework";
import { SiteHeader, type SiteHeaderProps } from "@/components/site-header";
import { cn } from "@/lib/cn";
import { frameworkName } from "@/lib/frameworks";
import type { ExampleVariant, Gallery, GalleryExample } from "@/lib/projects";
import { readStored, STORAGE_KEYS, writeStored } from "@/lib/storage";

// The example gallery's chrome (§4), ported from dockable's docs (components/site/
// examples-chrome.tsx) and made generic: the list on the left, by level, under the site header
// (components/site-header.tsx, the same as on every page, its leading slot the list's toggle
// on small screens). It is
// the gallery's layout, so it stays mounted while you move between examples: the list keeps its
// scroll and its filter, and the theme, the framework and the code panel their state. Plain
// markup and Fragiola palettes: no project's package is used to draw it.
//
// URL state: ?theme=<name> (an explicit choice; without one the example follows the site's
// scheme), ?code=1, ?framework=<name> (when not the project's default). The chosen theme is
// remembered per project; the framework choice is site-wide (components/framework.tsx).

export interface ShellState {
    /** the theme the reader chose; null follows the site's scheme */
    theme: string | null;
    code: boolean;
}

function readState(gallery: Gallery): ShellState {
    const params = new URLSearchParams(window.location.search);
    const known = (name: string | null) =>
        name !== null && gallery.themes.some((theme) => theme.name === name);
    const stored = readStored(STORAGE_KEYS.exampleTheme(gallery.project.slug));
    const fromUrl = params.get("theme");
    return {
        theme: known(fromUrl) ? fromUrl : known(stored) ? stored : null,
        code: params.get("code") === "1",
    };
}

export function query(
    state: ShellState,
    framework: string,
    defaultFramework: string,
): string {
    const params = new URLSearchParams();
    if (state.theme) params.set("theme", state.theme);
    if (state.code) params.set("code", "1");
    if (framework !== defaultFramework) params.set("framework", framework);
    const text = params.toString();
    return text ? `?${text}` : "";
}

export const iconButton =
    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-palette-accent/85 outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast disabled:pointer-events-none disabled:opacity-50";

interface ShellContextValue {
    gallery: Gallery;
    state: ShellState;
    setState: (update: (state: ShellState) => ShellState) => void;
    framework: string;
    /** the example theme to show: the chosen one, else the site scheme's default */
    theme: string | undefined;
    /** the URL and storage were read (client only): the stage may render */
    ready: boolean;
}

const ShellContext = createContext<ShellContextValue | null>(null);

/** The shell state the gallery's layout keeps across examples. */
export function useShell(): ShellContextValue {
    const context = useContext(ShellContext);
    if (!context) throw new Error("useShell must be used inside GalleryChrome");
    return context;
}

/** The example as the given framework has it, else as the first framework that does. */
export function variantFor(
    example: GalleryExample,
    framework: string,
): { variant: ExampleVariant; available: boolean } {
    const own = example.variants[framework];
    if (own) return { variant: own, available: true };
    const [first] = Object.values(example.variants);
    if (!first) throw new Error(`example "${example.id}" has no variant`);
    return { variant: first, available: false };
}

function ExampleList({
    gallery,
    current,
    href,
    framework,
    onNavigate,
}: {
    gallery: Gallery;
    current: string;
    href: (id: string) => string;
    framework: string;
    onNavigate: () => void;
}) {
    const [filter, setFilter] = useState("");
    const needle = filter.trim().toLowerCase();
    const visible = gallery.examples.filter((example) => {
        if (!needle) return true;
        const { variant } = variantFor(example, framework);
        return (
            variant.title.toLowerCase().includes(needle) ||
            variant.description.toLowerCase().includes(needle) ||
            variant.features.some((f) => f.toLowerCase().includes(needle))
        );
    });
    const groups = gallery.levels.map((level) => ({
        level,
        items: visible.filter((example) => example.level === level.id),
    }));

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="p-3">
                <label className="flex h-8 items-center gap-2 rounded-md border border-palette-line bg-palette-soft px-2 focus-within:ring-2 focus-within:ring-palette-ring">
                    <Search
                        aria-hidden
                        className="size-4 text-palette-accent/85"
                    />
                    <span className="sr-only">Filter examples</span>
                    <input
                        type="search"
                        value={filter}
                        placeholder="Filter examples"
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-palette-accent/85"
                        onChange={(event) => setFilter(event.target.value)}
                    />
                </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
                {groups.map(({ level, items }) =>
                    items.length === 0 ? null : (
                        <section
                            key={level.id}
                            className="mb-4"
                            aria-labelledby={`level-${level.id}`}
                        >
                            <h2
                                id={`level-${level.id}`}
                                className="flex items-center justify-between px-2 pb-1 font-semibold text-palette-accent/85 text-xs uppercase tracking-wide"
                            >
                                {level.title}
                                <span className="font-normal">
                                    {items.length}
                                </span>
                            </h2>
                            <ul>
                                {items.map((example) => {
                                    const { variant, available } = variantFor(
                                        example,
                                        framework,
                                    );
                                    return (
                                        <li key={example.id}>
                                            <Link
                                                href={href(example.id)}
                                                aria-current={
                                                    example.id === current
                                                        ? "page"
                                                        : undefined
                                                }
                                                data-missing={
                                                    available ? undefined : ""
                                                }
                                                onClick={onNavigate}
                                                className="block rounded-md px-2 py-1.5 text-palette-accent/85 text-sm outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring aria-[current=page]:bg-palette-soft aria-[current=page]:font-medium aria-[current=page]:text-palette-contrast data-missing:opacity-60"
                                            >
                                                {variant.title}
                                                {available ? null : (
                                                    <span className="sr-only">
                                                        {` (not in ${frameworkName(framework)})`}
                                                    </span>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ),
                )}
                {visible.length === 0 ? (
                    <p className="px-2 text-palette-accent/85 text-sm">
                        No example matches.
                    </p>
                ) : null}
            </div>
        </div>
    );
}

function Chrome({
    gallery,
    header,
    children,
}: {
    gallery: Gallery;
    header: SiteHeaderProps;
    children: ReactNode;
}) {
    const { project } = gallery;
    // the example's id: the segment below /<slug>/examples (none on the index redirect)
    const current = useSelectedLayoutSegment() ?? "";
    const framework = useFramework();
    const scheme = useSiteScheme();
    const [state, setShellState] = useState<ShellState>({
        theme: null,
        code: false,
    });
    const [ready, setReady] = useState(false);
    const [navOpen, setNavOpen] = useState(false);

    // the URL and storage are client-only: read them once mounted
    useEffect(() => {
        setShellState(readState(gallery));
        const asked = new URLSearchParams(window.location.search).get(
            "framework",
        );
        if (asked && project.frameworks.includes(asked)) setFramework(asked);
        setReady(true);
    }, [gallery, project.frameworks]);

    // keep the URL (and the remembered theme) in step with the state, on every example
    // biome-ignore lint/correctness/useExhaustiveDependencies: a new example has a new URL to update
    useEffect(() => {
        if (!ready) return;
        const url = `${window.location.pathname}${query(state, framework, project.defaultFramework)}${window.location.hash}`;
        window.history.replaceState(window.history.state, "", url);
        if (state.theme) {
            writeStored(STORAGE_KEYS.exampleTheme(project.slug), state.theme);
        }
    }, [state, framework, ready, current]);

    const theme =
        state.theme ??
        (scheme ? defaultTheme(gallery.themes, scheme) : undefined);
    const context: ShellContextValue = {
        gallery,
        state,
        setState: setShellState,
        framework,
        theme,
        ready,
    };
    const href = (id: string) =>
        `/${project.slug}/examples/${id}/${query(state, framework, project.defaultFramework)}`;

    return (
        <ShellContext value={context}>
            <div className="flex h-dvh flex-col bg-palette-base text-palette-contrast">
                <SiteHeader
                    {...header}
                    onMenuOpen={() => setNavOpen(false)}
                    leading={
                        <button
                            type="button"
                            aria-label="Examples list"
                            aria-expanded={navOpen}
                            className={cn(iconButton, "md:hidden")}
                            onClick={() => setNavOpen((open) => !open)}
                        >
                            <PanelLeft aria-hidden className="size-4" />
                        </button>
                    }
                />

                <div className="relative flex min-h-0 flex-1">
                    <nav
                        aria-label="Examples"
                        data-open={navOpen ? "" : undefined}
                        className="palette-surface absolute inset-y-0 start-0 z-40 hidden w-72 border-palette-line border-e bg-palette-base data-open:block md:static md:block md:w-64 md:shrink-0"
                    >
                        <ExampleList
                            gallery={gallery}
                            current={current}
                            href={href}
                            framework={framework}
                            onNavigate={() => setNavOpen(false)}
                        />
                    </nav>

                    {children}

                    {navOpen ? (
                        <button
                            type="button"
                            aria-label="Close the examples list"
                            className="absolute inset-0 z-30 bg-scrim md:hidden"
                            onClick={() => setNavOpen(false)}
                        >
                            <X aria-hidden className="sr-only" />
                        </button>
                    ) : null}
                </div>
            </div>
        </ShellContext>
    );
}

export function GalleryChrome({
    gallery,
    header,
    children,
}: {
    gallery: Gallery;
    header: SiteHeaderProps;
    children: ReactNode;
}) {
    return (
        <ProjectProvider
            project={{
                slug: gallery.project.slug,
                frameworks: gallery.project.frameworks,
                defaultFramework: gallery.project.defaultFramework,
            }}
        >
            <Chrome gallery={gallery} header={header}>
                {children}
            </Chrome>
        </ProjectProvider>
    );
}
