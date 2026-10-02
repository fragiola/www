"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import {
    createContext,
    type ReactNode,
    type RefObject,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { defaultTheme, useSiteScheme } from "@/components/example-theme";
import {
    ProjectProvider,
    setFramework,
    useFramework,
} from "@/components/framework";
import { SiteHeader, type SiteHeaderProps } from "@/components/site-header";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";
import { frameworkName } from "@/lib/frameworks";
import type { ExampleVariant, Gallery, GalleryExample } from "@/lib/projects";
import { readStored, STORAGE_KEYS, writeStored } from "@/lib/storage";

// The example gallery's chrome (§4), ported from dockable's docs (components/site/
// examples-chrome.tsx) and made generic, under the site header (components/site-header.tsx, the
// same as on every page). The list of examples, by level, is Fragiola UI's Sidebar
// (components/ui/sidebar.tsx, copied from ui's registry by `pnpm registry:copy`): a column that
// collapses off canvas on desktop (the Trigger in the header's leading slot, Ctrl/⌘+B), its state
// remembered, and a Drawer below 42rem of width. It is the gallery's layout, so it stays mounted
// while you move between examples: the list keeps its scroll and its filter, and the theme, the
// framework and the code panel their state. No project's package is used to draw it.
//
// URL state: ?theme=<name> (an explicit choice; without one the example follows the site's
// scheme), ?code=1, ?framework=<name> (when not the project's default). The chosen theme is
// remembered per project; the framework choice is site-wide (components/framework.tsx); the
// list's open state is the reader's (lib/storage.ts).

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
    filter,
    setFilter,
    scroll,
}: {
    gallery: Gallery;
    current: string;
    href: (id: string) => string;
    framework: string;
    /** the filter and the scroll belong to the layout: the Drawer unmounts the list on close */
    filter: string;
    setFilter: (filter: string) => void;
    scroll: RefObject<number>;
}) {
    const { setOpenMobile } = useSidebar();
    const scroller = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (scroller.current) scroller.current.scrollTop = scroll.current;
    }, [scroll]);
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

    // a landmark of its own, the same on the desktop column and in the Drawer
    return (
        <nav aria-label="Examples" className="flex h-full min-h-0 flex-col">
            <Sidebar.Header>
                <Sidebar.Input
                    type="search"
                    value={filter}
                    aria-label="Filter examples"
                    placeholder="Filter examples"
                    onChange={(event) => setFilter(event.target.value)}
                />
            </Sidebar.Header>
            <Sidebar.Content
                ref={scroller}
                className="pb-2"
                onScroll={(event) => {
                    scroll.current = event.currentTarget.scrollTop;
                }}
            >
                {groups.map(({ level, items }) =>
                    items.length === 0 ? null : (
                        <Sidebar.Group
                            key={level.id}
                            role="region"
                            aria-labelledby={`level-${level.id}`}
                        >
                            <Sidebar.GroupLabel
                                id={`level-${level.id}`}
                                // the level title and its count, a heading
                                render={(props) => <h2 {...props} />}
                            >
                                {level.title}
                                <span className="ms-auto tabular-nums">
                                    {items.length}
                                </span>
                            </Sidebar.GroupLabel>
                            <Sidebar.GroupContent>
                                <Sidebar.Menu>
                                    {items.map((example) => {
                                        const { variant, available } =
                                            variantFor(example, framework);
                                        const active = example.id === current;
                                        return (
                                            <Sidebar.MenuItem key={example.id}>
                                                <Sidebar.MenuButton
                                                    render={
                                                        <Link
                                                            href={href(
                                                                example.id,
                                                            )}
                                                        />
                                                    }
                                                    isActive={active}
                                                    aria-current={
                                                        active
                                                            ? "page"
                                                            : undefined
                                                    }
                                                    data-missing={
                                                        available
                                                            ? undefined
                                                            : ""
                                                    }
                                                    // choosing one closes the Drawer
                                                    onClick={() =>
                                                        setOpenMobile(false)
                                                    }
                                                    className="data-missing:opacity-60"
                                                >
                                                    <span className="truncate">
                                                        {variant.title}
                                                    </span>
                                                    {available ? null : (
                                                        <span className="sr-only">
                                                            {` (not in ${frameworkName(framework)})`}
                                                        </span>
                                                    )}
                                                </Sidebar.MenuButton>
                                            </Sidebar.MenuItem>
                                        );
                                    })}
                                </Sidebar.Menu>
                            </Sidebar.GroupContent>
                        </Sidebar.Group>
                    ),
                )}
                {visible.length === 0 ? (
                    <p className="px-4 text-palette-accent/85 text-sm">
                        No example matches.
                    </p>
                ) : null}
            </Sidebar.Content>
        </nav>
    );
}

/** The header's leading control: the list's toggle, a Drawer below 42rem. */
function ListTrigger() {
    const { isMobile, open, openMobile } = useSidebar();
    return (
        <Sidebar.Trigger
            aria-label="Examples list"
            aria-expanded={isMobile ? openMobile : open}
        />
    );
}

/** The site header, its leading slot the list's toggle (inside the Provider: it needs it). */
function GalleryHeader(header: SiteHeaderProps) {
    const { setOpenMobile } = useSidebar();
    return (
        <SiteHeader
            {...header}
            onMenuOpen={() => setOpenMobile(false)}
            leading={<ListTrigger />}
        />
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
    const [listOpen, setListOpen] = useState(true);
    const [settled, setSettled] = useState(false);
    const [filter, setFilter] = useState("");
    const scroll = useRef(0);

    // the URL and storage are client-only: read them once mounted
    useEffect(() => {
        setShellState(readState(gallery));
        setListOpen(readStored(STORAGE_KEYS.examplesSidebar) !== "false");
        const asked = new URLSearchParams(window.location.search).get(
            "framework",
        );
        if (asked && project.frameworks.includes(asked)) setFramework(asked);
        setReady(true);
    }, [gallery, project.frameworks]);

    // the remembered state is painted without the slide; a toggle slides from then on. Until
    // then a collapsed list was painted by CSS, from a mark the gallery's layout put on <html>
    // before the list was parsed (lib/storage.ts): React has it now, the mark goes.
    useEffect(() => {
        if (!ready) return;
        const frame = requestAnimationFrame(() => {
            delete document.documentElement.dataset.examplesList;
            setSettled(true);
        });
        return () => cancelAnimationFrame(frame);
    }, [ready]);

    const onListOpenChange = (open: boolean) => {
        setListOpen(open);
        writeStored(STORAGE_KEYS.examplesSidebar, String(open));
    };

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
            <Sidebar.Provider
                open={listOpen}
                onOpenChange={onListOpenChange}
                className="h-dvh min-h-0 flex-col text-palette-contrast"
            >
                <GalleryHeader {...header} />
                <div className="flex min-h-0 flex-1">
                    {/* the row's height, under the header: nothing scrolls the page */}
                    <Sidebar.Root
                        collapsible="offcanvas"
                        className={cn("h-full", !settled && "transition-none")}
                    >
                        <ExampleList
                            gallery={gallery}
                            current={current}
                            href={href}
                            framework={framework}
                            filter={filter}
                            setFilter={setFilter}
                            scroll={scroll}
                        />
                        <Sidebar.Rail />
                    </Sidebar.Root>
                    <Sidebar.Inset className="min-h-0 flex-row">
                        {children}
                    </Sidebar.Inset>
                </div>
            </Sidebar.Provider>
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
