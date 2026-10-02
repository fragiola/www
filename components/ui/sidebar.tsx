"use client";

import { useDirection } from "@base-ui/react/direction-provider";
import { useRender } from "@base-ui/react/use-render";
import { PanelLeftIcon } from "lucide-react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { Badge } from "@/components/atoms/badge";
import { Clickable } from "@/components/atoms/clickable";
import { Input } from "@/components/atoms/fields";
import { menu } from "@/components/families/menu";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/ui/drawer";
import { Field } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";

// Sidebar — the app shell's navigation column. Base UI has no sidebar
// primitive, so this component is a RECOMBINATION: the behaviour comes from
// primitives that already sit behind Fragiola components (Drawer on mobile,
// Tooltip in icon mode, useRender for polymorphic parts), and the appearance
// from families that already exist. shadcn's sidebar rebuilds a menu item, a
// label, an icon button and a sub-list from scratch (28 `.cn-sidebar-*`
// classes, 8 `--sidebar-*` tokens); here each part points at the piece it is.
//
// ─── EVERY PART POINTS AT SOMETHING ─────────────────────────────────────────
//   MenuButton / MenuSubButton   menu.navItem / menu.navSubItem (the family's
//                                navigation members) through useRender
//   GroupLabel                   menu.label
//   Trigger, GroupAction,        Clickable.Button (icon fill, square form)
//   MenuAction
//   MenuBadge                    Badge
//   MenuSkeleton                 Skeleton
//   Separator                    Separator
//   Input                        Field row + Input (the row is the body)
//   mobile                       Drawer
//   icon-mode tooltips           Tooltip
// What is left here is structure: the layout, the collapse modes, and where
// each borrowed piece sits in the column.
//
// ─── ICON MODE WITHOUT !important ───────────────────────────────────────────
// shadcn squares its buttons with `size-8! p-2!` and `p-0!` because its size
// variants are `@apply`-ed classes defined later in the stylesheet. Here they
// are plain utilities: `group-data-[collapsible=icon]/sidebar:size-8` is a
// variant utility, which Tailwind emits after `h-12`, so it wins on its own.
//
// ─── PALETTE ────────────────────────────────────────────────────────────────
// `palette-raised` by default — shadcn's `--sidebar` is `raised` in both
// themes, so there is no `palette-sidebar`: the number of palettes is free,
// but a palette that duplicates another is not a new one. The class sits on
// the element that also takes `className`, so `className="palette-surface-blue"`
// replaces it (cn merges palettes as one group). The same `className` reaches
// the mobile Drawer popup, which is portalled and would not inherit it.
//
// Swap it for a SURFACE-tier palette (surface, raised, surface-*). The items
// are the menu family's, whose resting text is secondary text
// (`accent/85`), guaranteed readable on neutral surfaces only — the same
// limit a dropdown menu has. A chromatic palette paints the column but not
// legible items.
//
// ─── LAYOUT IS RELATIVE TO THE PROVIDER, NOT TO THE VIEWPORT ────────────────
// The Provider's wrapper is a size container (`@container/sidebar`). Desktop
// or mobile is decided by the WRAPPER's inline size, and the desktop sidebar
// is `sticky` inside the wrapper instead of `fixed` to the viewport. A shell
// behaves the same full-page, in a docs iframe and in a playground stage;
// shadcn's `fixed` + viewport media query leaves the stage and picks the
// wrong mode in a narrow frame. Its height is the viewport's (`h-svh`, the
// usual scrollport); a host shorter than the viewport, or a column under a
// fixed header, sets it through `className`.
//
// First paint is decided by CSS alone (`hidden @2xl/sidebar:block`), so there
// is no server/client flash. The ResizeObserver below only decides whether
// the Drawer mounts. The threshold is 42rem, `@2xl`: a docs column (~720px)
// shows the desktop sidebar, a phone in portrait gets the Drawer. The JS
// constant and the container variant are one decision in two languages —
// tests/sidebar.test.ts asserts they agree.
//
// ─── NO PERSISTENCE ─────────────────────────────────────────────────────────
// shadcn writes a `sidebar_state` cookie for Next.js SSR. Fragiola is
// framework-agnostic: `defaultOpen` + controlled `open`/`onOpenChange`, and
// the consumer persists where their stack reads it (the docs show a cookie
// and a localStorage recipe).
//
// ─── SIDE IS LOGICAL ────────────────────────────────────────────────────────
// `side="start" | "end"` (rule 6). The desktop layout flips on its own with
// logical properties. The Drawer's `side` is physical, so the mobile edge is
// resolved against the reading direction Base UI reads (DirectionProvider).

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
// Below this wrapper width the sidebar is a Drawer. Must equal Tailwind's
// `--container-2xl`, the `@2xl/sidebar:` used in the classes below.
const SIDEBAR_MOBILE_THRESHOLD_REM = 42;

type Side = "start" | "end";
type Variant = "sidebar" | "floating" | "inset";
type Collapsible = "offcanvas" | "icon" | "none";

type SidebarContextProps = {
    state: "expanded" | "collapsed";
    open: boolean;
    setOpen: (open: boolean) => void;
    openMobile: boolean;
    setOpenMobile: (open: boolean) => void;
    isMobile: boolean;
    toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

// What the Root was given, for the parts inside it. The Provider's `state`
// flips whatever the Root's mode; only an icon-mode Root turns labels into
// tooltips.
const SidebarRootContext = React.createContext<{ collapsible: Collapsible }>({
    collapsible: "offcanvas",
});

function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a Sidebar.Provider.");
    }
    return context;
}

// Whether `element` is narrower than the mobile threshold. Measured on the
// element, not the window: the wrapper is what the container variant reads.
function useIsNarrow(element: HTMLElement | null) {
    const [narrow, setNarrow] = React.useState(false);

    React.useEffect(() => {
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            if (!entry) return;
            const rem = Number.parseFloat(
                getComputedStyle(document.documentElement).fontSize,
            );
            setNarrow(
                entry.contentRect.width < SIDEBAR_MOBILE_THRESHOLD_REM * rem,
            );
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);

    return narrow;
}

// ─── Provider ───────────────────────────────────────────────────────────────
// The state, the keyboard shortcut and the wrapper: the size container the
// whole layout reads. The wrapper declares `palette-raised` and paints nothing
// — except in the `inset` variant, where it is the raised floor the Inset
// card sits on.

function SidebarProvider({
    defaultOpen = true,
    open: openProp,
    onOpenChange: setOpenProp,
    className,
    style,
    children,
    ref,
    ...props
}: React.ComponentProps<"div"> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [wrapper, setWrapper] = React.useState<HTMLDivElement | null>(null);
    const isMobile = useIsNarrow(wrapper);
    const [openMobile, setOpenMobile] = React.useState(false);

    // Internal state, overridden by `open` / `onOpenChange` when controlled.
    const [_open, _setOpen] = React.useState(defaultOpen);
    const open = openProp ?? _open;
    // Uncontrolled keeps its own state even when it reports changes: a
    // Provider with `defaultOpen` + `onOpenChange` (the cookie recipe) must
    // still toggle.
    const setOpen = React.useCallback(
        (value: boolean | ((value: boolean) => boolean)) => {
            const openState = typeof value === "function" ? value(open) : value;
            if (openProp === undefined) _setOpen(openState);
            setOpenProp?.(openState);
        },
        [setOpenProp, openProp, open],
    );

    const toggleSidebar = React.useCallback(() => {
        return isMobile
            ? setOpenMobile((open) => !open)
            : setOpen((open) => !open);
    }, [isMobile, setOpen]);

    React.useEffect(() => {
        // Not while typing: in a field, Ctrl/⌘+B belongs to the field (bold
        // in a rich-text editor), and a handler that already took the key
        // wins.
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as Element | null;
            if (
                event.defaultPrevented ||
                target?.closest?.(
                    "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
                )
            ) {
                return;
            }
            if (
                event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
                (event.metaKey || event.ctrlKey)
            ) {
                event.preventDefault();
                toggleSidebar();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleSidebar]);

    const state = open ? "expanded" : "collapsed";

    const contextValue = React.useMemo<SidebarContextProps>(
        () => ({
            state,
            open,
            setOpen,
            isMobile,
            openMobile,
            setOpenMobile,
            toggleSidebar,
        }),
        [state, open, setOpen, isMobile, openMobile, toggleSidebar],
    );

    const setRefs = React.useCallback(
        (node: HTMLDivElement | null) => {
            setWrapper(node);
            if (typeof ref === "function") return ref(node);
            if (ref) ref.current = node;
        },
        [ref],
    );

    return (
        <SidebarContext.Provider value={contextValue}>
            <Tooltip.Provider>
                <div
                    ref={setRefs}
                    data-slot="sidebar-wrapper"
                    style={
                        {
                            "--sidebar-width": SIDEBAR_WIDTH,
                            ...style,
                        } as React.CSSProperties
                    }
                    className={cn(
                        "palette-raised group/sidebar-wrapper @container/sidebar flex min-h-svh w-full",
                        "has-[[data-slot=sidebar][data-variant=inset]]:bg-palette-base",
                        className as string,
                    )}
                    {...props}
                >
                    {children}
                </div>
            </Tooltip.Provider>
        </SidebarContext.Provider>
    );
}

// ─── Root ───────────────────────────────────────────────────────────────────
// Three nested elements on desktop, each with one job:
//
//   sidebar    the flex item in the wrapper's row. Sticky, and its WIDTH is
//              what collapses (0 for offcanvas, the icon rail for icon), so
//              the Inset beside it grows as it animates. It is `group/sidebar`
//              and carries the data attributes every part reads.
//   container  clips on the inline axis (`overflow-x-clip`, not hidden: clip
//              makes no scroll container, so `sticky` above keeps working) and
//              holds the floating/inset gutter.
//   inner      the painted panel. In offcanvas mode it keeps its full width
//              and is anchored to the far edge, so it SLIDES out as the box
//              narrows instead of reflowing — shadcn does the same with a
//              `fixed` panel moved by `left`/`right`.
//
// The widths read two custom properties set per variant: `--sidebar-gutter`
// (the p-2 around a floating or inset panel) and `--sidebar-frame` (the
// border the panel's content loses: one edge for `sidebar`, two for
// `floating`), so an icon rail is always exactly `--sidebar-rail` of
// content, whatever the variant.

function SidebarRoot({
    side = "start",
    variant = "sidebar",
    collapsible = "offcanvas",
    className,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    side?: Side;
    variant?: Variant;
    collapsible?: Collapsible;
}) {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
    const direction = useDirection();

    const root = React.useMemo(() => ({ collapsible }), [collapsible]);

    if (collapsible === "none") {
        return (
            <SidebarRootContext.Provider value={root}>
                <div
                    data-slot="sidebar"
                    data-variant={variant}
                    data-side={side}
                    className={cn(
                        "palette-raised flex h-full w-(--sidebar-width) flex-col bg-palette-base text-palette-contrast",
                        className as string,
                    )}
                    {...props}
                >
                    {children}
                </div>
            </SidebarRootContext.Provider>
        );
    }

    if (isMobile) {
        // The Drawer's side is physical; `start` is the left edge only in LTR.
        const edge =
            (side === "start") === (direction === "ltr") ? "left" : "right";
        // Only the palette crosses into the portalled popup. The rest of
        // `className` places the desktop column (`top-12 h-[…]` under a
        // header) and would misplace the Drawer.
        const palette = (className as string | undefined)
            ?.split(/\s+/)
            .filter((name) => name.startsWith("palette-"));
        return (
            <SidebarRootContext.Provider value={root}>
                <Drawer.Root
                    open={openMobile}
                    onOpenChange={setOpenMobile}
                    swipeDirection={edge}
                >
                    <Drawer.Portal>
                        <Drawer.Backdrop />
                        <Drawer.Viewport side={edge}>
                            <Drawer.Popup
                                side={edge}
                                data-slot="sidebar"
                                data-mobile="true"
                                className={cn(
                                    "palette-raised w-72 text-palette-contrast",
                                    palette,
                                )}
                                {...props}
                            >
                                <Drawer.Content
                                    showClose={false}
                                    className="h-full"
                                >
                                    <Drawer.Title className="sr-only">
                                        Sidebar
                                    </Drawer.Title>
                                    <Drawer.Description className="sr-only">
                                        Displays the mobile sidebar.
                                    </Drawer.Description>
                                    {children}
                                </Drawer.Content>
                            </Drawer.Popup>
                        </Drawer.Viewport>
                    </Drawer.Portal>
                </Drawer.Root>
            </SidebarRootContext.Provider>
        );
    }

    return (
        <SidebarRootContext.Provider value={root}>
            <div
                data-slot="sidebar"
                data-state={state}
                data-collapsible={state === "collapsed" ? collapsible : ""}
                data-variant={variant}
                data-side={side}
                className={cn(
                    "palette-raised group/sidebar text-palette-contrast",
                    "hidden @2xl/sidebar:block",
                    // z-10: sticky makes a stacking context, and the Inset after
                    // it is positioned — without it the Inset paints over the
                    // part of the Rail that straddles the edge.
                    "sticky top-0 z-10 h-svh max-h-full shrink-0 self-start",
                    "w-(--sidebar-width) transition-[width] duration-200 ease-linear motion-reduce:transition-none",
                    "data-[collapsible=offcanvas]:w-0",
                    // The icon rail holds a size-8 button in a p-2 group —
                    // spacing units, so the rail is too: 3rem at the default
                    // density, and it follows compact and spacious (§4)
                    // instead of clipping their buttons. Resolved HERE, not
                    // on the Provider, so density set on the Root itself
                    // counts; `--sidebar-width-icon` still overrides it.
                    "[--sidebar-rail:var(--sidebar-width-icon,calc(var(--spacing)*12))]",
                    "data-[collapsible=icon]:w-[calc(var(--sidebar-rail)+2*var(--sidebar-gutter)+var(--sidebar-frame))]",
                    variant === "sidebar" &&
                        "[--sidebar-frame:1px] [--sidebar-gutter:0px]",
                    variant === "floating" &&
                        "[--sidebar-frame:2px] [--sidebar-gutter:calc(var(--spacing)*2)]",
                    variant === "inset" &&
                        "[--sidebar-frame:0px] [--sidebar-gutter:calc(var(--spacing)*2)]",
                    className as string,
                )}
                {...props}
            >
                <div
                    data-slot="sidebar-container"
                    className={cn(
                        "flex size-full overflow-x-clip p-(--sidebar-gutter)",
                        // Off canvas is out of reach, not only out of sight:
                        // `invisible` takes it out of the tab order and the
                        // accessibility tree, once the slide has finished
                        // (visibility transitions discretely). Not `inert`:
                        // the Rail renders in here and must stay clickable,
                        // and only visibility can be restored by a descendant.
                        "transition-[visibility] duration-200 motion-reduce:transition-none",
                        "group-data-[collapsible=offcanvas]/sidebar:invisible",
                        // The inner panel is anchored to the edge away from the
                        // sidebar's side, so it leaves by the side it lives on.
                        side === "start" ? "justify-end" : "justify-start",
                    )}
                >
                    <div
                        data-slot="sidebar-inner"
                        className={cn(
                            "flex h-full w-full min-w-0 flex-col bg-palette-base",
                            collapsible === "offcanvas" &&
                                "w-[calc(var(--sidebar-width)-2*var(--sidebar-gutter))] shrink-0",
                            variant === "sidebar" && "border-palette-line",
                            variant === "sidebar" &&
                                side === "start" &&
                                "border-e",
                            variant === "sidebar" &&
                                side === "end" &&
                                "border-s",
                            variant === "floating" &&
                                "rounded-lg border border-palette-line shadow-sm",
                        )}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </SidebarRootContext.Provider>
    );
}

// ─── Trigger ────────────────────────────────────────────────────────────────
// The icon button, not a new one: Clickable, icon fill, square form. The
// panel icon mirrors under RTL.

function SidebarTrigger({
    onClick,
    ...props
}: React.ComponentProps<typeof Clickable.Button>) {
    const { toggleSidebar } = useSidebar();

    return (
        <Clickable.Button
            data-slot="sidebar-trigger"
            variant="icon"
            shape="square"
            size="sm"
            onClick={(event) => {
                onClick?.(event);
                toggleSidebar();
            }}
            {...props}
        >
            <PanelLeftIcon className="rtl:-scale-x-100" />
            <span className="sr-only">Toggle Sidebar</span>
        </Clickable.Button>
    );
}

// ─── Rail ───────────────────────────────────────────────────────────────────
// A 16px hit area straddling the sidebar's inner edge, with a hairline on
// hover. Out of the tab order: the Trigger is the keyboard path. When the
// sidebar is off canvas the rail moves fully onto the page, at the edge the
// sidebar comes back from. The cursor is `ew-resize` in every state — a
// per-side, per-state, per-direction matrix of w/e cursors bought nothing.
// It exists only on the desktop column (the one Root with `data-state`): a
// Drawer or a `collapsible="none"` column has no edge to drag.

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
    const { toggleSidebar } = useSidebar();

    return (
        <button
            type="button"
            data-slot="sidebar-rail"
            aria-label="Toggle Sidebar"
            tabIndex={-1}
            onClick={toggleSidebar}
            title="Toggle Sidebar"
            className={cn(
                "visible absolute inset-y-0 z-20 hidden w-4 cursor-ew-resize outline-none",
                "group-data-[state]/sidebar:block",
                "after:absolute after:inset-y-0 after:inset-x-[7px] after:transition-colors hover:after:bg-palette-line",
                "group-data-[side=start]/sidebar:-end-2 group-data-[side=end]/sidebar:-start-2",
                "group-data-[collapsible=offcanvas]/sidebar:group-data-[side=start]/sidebar:-end-4",
                "group-data-[collapsible=offcanvas]/sidebar:group-data-[side=end]/sidebar:-start-4",
                className as string,
            )}
            {...props}
        />
    );
}

// ─── Inset ──────────────────────────────────────────────────────────────────
// The page beside the sidebar. It declares `palette-surface` — it is the
// app's floor, not the sidebar's — and in the `inset` variant becomes the card
// on the raised floor the wrapper paints. It reads the Root through the
// wrapper (`group-has-[…]/sidebar-wrapper`), not through `peer`, so a sidebar
// on the end side can come after it or before it in the markup.

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
    return (
        <main
            data-slot="sidebar-inset"
            className={cn(
                "palette-surface relative flex w-full min-w-0 flex-1 flex-col bg-palette-base",
                "@2xl/sidebar:group-has-[[data-slot=sidebar][data-variant=inset]]/sidebar-wrapper:m-2",
                "@2xl/sidebar:group-has-[[data-slot=sidebar][data-variant=inset]]/sidebar-wrapper:rounded-lg",
                "@2xl/sidebar:group-has-[[data-slot=sidebar][data-variant=inset]]/sidebar-wrapper:shadow-sm",
                "@2xl/sidebar:group-has-[[data-slot=sidebar][data-variant=inset][data-side=start][data-state=expanded]]/sidebar-wrapper:ms-0",
                "@2xl/sidebar:group-has-[[data-slot=sidebar][data-variant=inset][data-side=end][data-state=expanded]]/sidebar-wrapper:me-0",
                className as string,
            )}
            {...props}
        />
    );
}

// ─── Header, Footer, Content ────────────────────────────────────────────────
// Structure only. Content is the part that scrolls; in icon mode it clips,
// so a label mid-collapse cannot open a scrollbar.

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-header"
            className={cn("flex flex-col gap-2 p-2", className as string)}
            {...props}
        />
    );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-footer"
            className={cn("flex flex-col gap-2 p-2", className as string)}
            {...props}
        />
    );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-content"
            className={cn(
                "flex min-h-0 flex-1 flex-col gap-2 overflow-auto",
                "group-data-[collapsible=icon]/sidebar:overflow-hidden",
                className as string,
            )}
            {...props}
        />
    );
}

// ─── Separator ──────────────────────────────────────────────────────────────
// The Separator, inset to the groups' padding. The inset is a wrapper's
// padding, not a margin on the Separator: a horizontal Separator is
// `w-full`, and `w-full` plus a margin overflows the column.

function SidebarSeparator(props: React.ComponentProps<typeof Separator>) {
    return (
        <div data-slot="sidebar-separator" className="px-2">
            <Separator {...props} />
        </div>
    );
}

// ─── Input ──────────────────────────────────────────────────────────────────
// A field, not a restyled input. The row is the body — border, surface,
// height, focus ring (rule 3) — so `className` lands on the row; the rest are
// the input's props. It keeps the field's own height (h-control) rather than
// shadcn's h-8: a sidebar search lines up with every other field. A field
// cannot fit an icon rail, so in icon mode it steps aside like the labels.

function SidebarInput({
    className,
    ...props
}: React.ComponentProps<typeof Input>) {
    return (
        <Field.Row
            data-slot="sidebar-input"
            className={cn(
                "group-data-[collapsible=icon]/sidebar:hidden",
                className as string,
            )}
        >
            <Field.Body>
                <Input {...props} />
            </Field.Body>
        </Field.Row>
    );
}

// ─── Group ──────────────────────────────────────────────────────────────────

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-group"
            className={cn(
                "relative flex w-full min-w-0 flex-col p-2",
                className as string,
            )}
            {...props}
        />
    );
}

// The menu family's label. Polymorphic, because a collapsible group makes it
// the trigger. In icon mode it folds up and fades rather than vanishing, so
// the icons below slide into place.
function SidebarGroupLabel({
    className,
    render,
    ...props
}: useRender.ComponentProps<"div">) {
    return useRender({
        defaultTagName: "div",
        render,
        props: {
            ...props,
            className: cn(
                menu.label(),
                "flex h-8 shrink-0 items-center gap-2 rounded-md",
                "focus-visible:outline-2 focus-visible:outline-palette-ring",
                "[&>svg]:size-4 [&>svg]:shrink-0",
                "transition-[margin,opacity] duration-200 ease-linear motion-reduce:transition-none",
                "group-data-[collapsible=icon]/sidebar:-mt-8 group-data-[collapsible=icon]/sidebar:opacity-0",
                className as string,
            ),
        },
        state: { slot: "sidebar-group-label" },
    });
}

// Clickable's icon button, at a 20px measure (Clickable has no 20px size; a
// local measure is not a new size). Its hit area grows past its box where
// there is no pointer precision — outside the desktop container.
function SidebarGroupAction({
    className,
    ...props
}: React.ComponentProps<typeof Clickable.Button>) {
    return (
        <Clickable.Button
            data-slot="sidebar-group-action"
            variant="icon"
            shape="square"
            size="xs"
            className={cn(
                "absolute end-3 top-3.5 size-5",
                "after:absolute after:-inset-2 @2xl/sidebar:after:hidden",
                "group-data-[collapsible=icon]/sidebar:hidden",
                className as string,
            )}
            {...props}
        />
    );
}

function SidebarGroupContent({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-group-content"
            className={cn("w-full text-sm", className as string)}
            {...props}
        />
    );
}

// ─── Menu ───────────────────────────────────────────────────────────────────

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
    return (
        <ul
            data-slot="sidebar-menu"
            className={cn(
                "flex w-full min-w-0 flex-col gap-1",
                className as string,
            )}
            {...props}
        />
    );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
    return (
        <li
            data-slot="sidebar-menu-item"
            className={cn("group/menu-item relative", className as string)}
            {...props}
        />
    );
}

// MenuButton — `menu.navItem` plus the two axes shadcn's button has. They are
// component axes (as Clickable's are), not family variants: `size` is
// measure, `variant` is fill strategy, neither is colour. The family member
// stays single. The button makes room at its end when its item holds an
// action or a badge, and squares itself in icon mode.
const menuButton = tv({
    extend: menu.navItem,
    base: `
        peer/menu-button
        group-has-[[data-slot=sidebar-menu-action]]/menu-item:pe-8
        group-has-[[data-slot=sidebar-menu-badge]]/menu-item:pe-8
        group-data-[collapsible=icon]/sidebar:size-8
        group-data-[collapsible=icon]/sidebar:px-2
    `,
    variants: {
        variant: {
            ghost: "",
            outline: "border border-palette-line",
        },
        size: {
            sm: "h-7 text-xs",
            md: "",
            lg: "h-12 group-data-[collapsible=icon]/sidebar:px-0",
        },
    },
    defaultVariants: { variant: "ghost", size: "md" },
});

function SidebarMenuButton({
    render,
    isActive = false,
    variant,
    size = "md",
    tooltip,
    className,
    ...props
}: useRender.ComponentProps<"button"> &
    VariantProps<typeof menuButton> & {
        /** The current page: `data-active`, lit and weighted. */
        isActive?: boolean;
        /** Shown beside the icon while the sidebar is collapsed to icons. */
        tooltip?: string | React.ComponentProps<typeof Tooltip.Content>;
    }) {
    const { isMobile, state } = useSidebar();
    const { collapsible } = React.useContext(SidebarRootContext);
    const button = useRender({
        defaultTagName: "button",
        render: tooltip ? <Tooltip.Trigger render={render} /> : render,
        props: {
            ...props,
            className: cn(menuButton({ variant, size }), className as string),
        },
        state: { slot: "sidebar-menu-button", size, active: isActive },
    });

    if (!tooltip) return button;

    const content =
        typeof tooltip === "string" ? { children: tooltip } : tooltip;
    return (
        <Tooltip.Root
            disabled={
                collapsible !== "icon" || state !== "collapsed" || isMobile
            }
        >
            {button}
            <Tooltip.Content side="inline-end" align="center" {...content} />
        </Tooltip.Root>
    );
}

// The end-side slot of a menu item — an action or a badge — sits at a fixed
// offset from the item's top, per button size, not centred: an item that
// holds an open sub-menu is taller than its button.
const endSlot = `
    absolute end-1 top-1.5
    peer-data-[size=sm]/menu-button:top-1
    peer-data-[size=lg]/menu-button:top-3.5
    group-data-[collapsible=icon]/sidebar:hidden
`;

function SidebarMenuAction({
    className,
    showOnHover = false,
    ...props
}: React.ComponentProps<typeof Clickable.Button> & {
    /** Hidden until the item is hovered or focused, on desktop. */
    showOnHover?: boolean;
}) {
    return (
        <Clickable.Button
            data-slot="sidebar-menu-action"
            variant="icon"
            shape="square"
            size="xs"
            className={cn(
                endSlot,
                "size-5 peer-hover/menu-button:text-palette-contrast",
                "after:absolute after:-inset-2 @2xl/sidebar:after:hidden",
                showOnHover &&
                    "@2xl/sidebar:opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 aria-expanded:opacity-100 data-popup-open:opacity-100",
                className as string,
            )}
            {...props}
        />
    );
}

// Badge, as it is — a counter is a badge.
function SidebarMenuBadge({
    className,
    ...props
}: React.ComponentProps<typeof Badge>) {
    return (
        <Badge
            data-slot="sidebar-menu-badge"
            className={cn(
                endSlot,
                "pointer-events-none tabular-nums select-none",
                className as string,
            )}
            {...props}
        />
    );
}

// Skeleton rows. The text width varies between 50% and 90% so a loading list
// does not read as a grid — derived from useId, not Math.random, so the
// server and the client agree on it.
function SidebarMenuSkeleton({
    className,
    showIcon = false,
    ...props
}: React.ComponentProps<"div"> & { showIcon?: boolean }) {
    const id = React.useId();
    // A string hash, so neighbouring ids (":r1:", ":r2:") land far apart.
    const seed = [...id].reduce(
        (hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973,
        7,
    );
    const width = `${50 + (seed % 41)}%`;

    return (
        <div
            data-slot="sidebar-menu-skeleton"
            className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2",
                className as string,
            )}
            {...props}
        >
            {showIcon ? <Skeleton className="size-4" /> : null}
            <Skeleton
                className="h-4 max-w-(--skeleton-width) flex-1"
                style={{ "--skeleton-width": width } as React.CSSProperties}
            />
        </div>
    );
}

// ─── Sub-menu ───────────────────────────────────────────────────────────────
// One level down: a line on the inline-start side (it flips under RTL) and
// the family's navSubItem. Hidden in icon mode — an icon rail has no depth.

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
    return (
        <ul
            data-slot="sidebar-menu-sub"
            className={cn(
                "mx-3.5 flex min-w-0 flex-col gap-1 border-s border-palette-line px-2.5 py-0.5",
                "group-data-[collapsible=icon]/sidebar:hidden",
                className as string,
            )}
            {...props}
        />
    );
}

function SidebarMenuSubItem({
    className,
    ...props
}: React.ComponentProps<"li">) {
    return (
        <li
            data-slot="sidebar-menu-sub-item"
            className={cn("group/menu-sub-item relative", className as string)}
            {...props}
        />
    );
}

const menuSubButton = tv({
    extend: menu.navSubItem,
    base: "min-w-0",
    variants: {
        size: { sm: "text-xs", md: "" },
    },
    defaultVariants: { size: "md" },
});

function SidebarMenuSubButton({
    render,
    size = "md",
    isActive = false,
    className,
    ...props
}: useRender.ComponentProps<"a"> &
    VariantProps<typeof menuSubButton> & {
        /** The current page: `data-active`, lit and weighted. */
        isActive?: boolean;
    }) {
    return useRender({
        defaultTagName: "a",
        render,
        props: {
            ...props,
            className: cn(menuSubButton({ size }), className as string),
        },
        state: { slot: "sidebar-menu-sub-button", size, active: isActive },
    });
}

export const Sidebar = {
    Provider: SidebarProvider,
    Root: SidebarRoot,
    Trigger: SidebarTrigger,
    Rail: SidebarRail,
    Inset: SidebarInset,
    Header: SidebarHeader,
    Footer: SidebarFooter,
    Content: SidebarContent,
    Separator: SidebarSeparator,
    Input: SidebarInput,
    Group: SidebarGroup,
    GroupLabel: SidebarGroupLabel,
    GroupAction: SidebarGroupAction,
    GroupContent: SidebarGroupContent,
    Menu: SidebarMenu,
    MenuItem: SidebarMenuItem,
    MenuButton: SidebarMenuButton,
    MenuAction: SidebarMenuAction,
    MenuBadge: SidebarMenuBadge,
    MenuSkeleton: SidebarMenuSkeleton,
    MenuSub: SidebarMenuSub,
    MenuSubItem: SidebarMenuSubItem,
    MenuSubButton: SidebarMenuSubButton,
};

export { useSidebar };
