import {
    Accessibility,
    Atom,
    Blocks,
    Book,
    BookOpen,
    Bot,
    Box,
    Calendar,
    ChevronsDownUp,
    Code,
    Columns3,
    Compass,
    Component,
    Download,
    FileText,
    GitBranch,
    Globe,
    Grid3x3,
    Languages,
    Layers,
    LayoutDashboard,
    LifeBuoy,
    ListTree,
    type LucideIcon,
    Menu,
    Moon,
    MousePointerClick,
    Move,
    Navigation,
    Package,
    Palette,
    PanelsTopLeft,
    Plug,
    Puzzle,
    Rocket,
    Settings,
    ShieldCheck,
    Sparkles,
    SquareStack,
    Table,
    Terminal,
    TextCursorInput,
    WandSparkles,
    Workflow,
    Zap,
} from "lucide-react";
import { createElement, type ReactNode } from "react";
import { isSidebarIcon, type SidebarIconName } from "@/lib/contract/icons";

// The drawing of every sidebar icon (§3.1, v1.4). The names are lib/contract/icons.ts's: the
// record is typed by them, so a name added there without a drawing here does not compile.

export const SIDEBAR_ICON_COMPONENTS: Record<SidebarIconName, LucideIcon> = {
    accessibility: Accessibility,
    atom: Atom,
    blocks: Blocks,
    book: Book,
    "book-open": BookOpen,
    bot: Bot,
    box: Box,
    calendar: Calendar,
    "chevrons-down-up": ChevronsDownUp,
    code: Code,
    "columns-3": Columns3,
    compass: Compass,
    component: Component,
    download: Download,
    "file-text": FileText,
    "git-branch": GitBranch,
    globe: Globe,
    "grid-3x3": Grid3x3,
    languages: Languages,
    layers: Layers,
    "layout-dashboard": LayoutDashboard,
    "life-buoy": LifeBuoy,
    "list-tree": ListTree,
    menu: Menu,
    moon: Moon,
    "mouse-pointer-click": MousePointerClick,
    move: Move,
    navigation: Navigation,
    package: Package,
    palette: Palette,
    "panels-top-left": PanelsTopLeft,
    plug: Plug,
    puzzle: Puzzle,
    rocket: Rocket,
    settings: Settings,
    "shield-check": ShieldCheck,
    sparkles: Sparkles,
    "square-stack": SquareStack,
    table: Table,
    terminal: Terminal,
    "text-cursor-input": TextCursorInput,
    "wand-sparkles": WandSparkles,
    workflow: Workflow,
    zap: Zap,
};

/**
 * The icon a config entry names, as an element for the page tree, or undefined without one.
 * Lucide's icons are client components, so the element crosses from the server-built tree to
 * the client docs layout as a client reference.
 */
export function docsIcon(name: string | undefined): ReactNode | undefined {
    if (!isSidebarIcon(name)) return undefined;
    // Lucide marks it `lucide-<name>` itself; decorative, the label beside it says it all
    return createElement(SIDEBAR_ICON_COMPONENTS[name], {
        "aria-hidden": true,
    });
}
