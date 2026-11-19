// The icons a sidebar section or page may name in docs/config.json (§3.1, v1.4): a curated set of
// Lucide icons, by their kebab-case name. This list is the only place they are named: the checks
// (validate.ts) accept these names and nothing else, and the site draws each one from the map in
// components/docs-icon.tsx, typed by `SidebarIconName` so a name without a drawing does not
// compile. CONTRACT.md §3.1 lists the same names (tests/contract.test.ts compares them).

export const SIDEBAR_ICONS = [
    "accessibility",
    "atom",
    "blocks",
    "book",
    "book-open",
    "bot",
    "box",
    "calendar",
    "chevrons-down-up",
    "code",
    "columns-3",
    "compass",
    "component",
    "download",
    "file-text",
    "git-branch",
    "globe",
    "grid-3x3",
    "languages",
    "layers",
    "layout-dashboard",
    "life-buoy",
    "list-tree",
    "menu",
    "moon",
    "mouse-pointer-click",
    "move",
    "navigation",
    "package",
    "palette",
    "panels-top-left",
    "plug",
    "puzzle",
    "rocket",
    "settings",
    "shield-check",
    "sparkles",
    "square-stack",
    "table",
    "terminal",
    "text-cursor-input",
    "wand-sparkles",
    "workflow",
    "zap",
] as const;

export type SidebarIconName = (typeof SIDEBAR_ICONS)[number];

const NAMES: ReadonlySet<string> = new Set(SIDEBAR_ICONS);

export function isSidebarIcon(name: unknown): name is SidebarIconName {
    return typeof name === "string" && NAMES.has(name);
}
