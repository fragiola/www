"use client";

import { usePathname } from "fumadocs-core/framework";
import type * as PageTree from "fumadocs-core/page-tree";
import {
    SidebarFolder,
    SidebarFolderContent,
    SidebarFolderTrigger,
    SidebarItem,
} from "fumadocs-ui/components/sidebar/base";
import type { SidebarPageTreeComponents } from "fumadocs-ui/components/sidebar/page-tree";
import { useTreeContext, useTreePath } from "fumadocs-ui/contexts/tree";
import { ExternalLink } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";
import { cn } from "@/lib/cn";

// The docs sidebar's rows, in the inset style of fumadocs.dev: every row is a rounded item inset
// from the sidebar's edges, the current page a filled pill in the accent role (no vertical line),
// a section's or page's icon (§3.1, v1.4) before its label. A section that folds is a row with a
// chevron and its pages nested behind a guide line; a section that does not fold is a small
// heading over its pages.
//
// Only the rendering is the site's: Fumadocs' own parts (SidebarItem, SidebarFolder…) keep the
// active page, the open state of a section (the current page's always opens), the auto scroll
// and the drawer.

/** Whether a row of this list has an icon: then a row without one keeps the icon's room. */
const IconColumn = createContext(false);

const ROW =
    "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-start text-sm text-fd-muted-foreground transition-colors wrap-anywhere hover:bg-fd-accent/60 hover:text-fd-foreground hover:transition-none focus-visible:outline-2 focus-visible:outline-fd-ring [&_svg]:size-4 [&_svg]:shrink-0";

function Icon({ icon }: { icon: ReactNode }) {
    const column = useContext(IconColumn);
    if (icon) return icon;
    return column ? <span aria-hidden className="size-4 shrink-0" /> : null;
}

/** Normalized like Fumadocs' own active check: no trailing slash. */
function isCurrent(url: string, pathname: string): boolean {
    const strip = (path: string) =>
        path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
    return strip(url) === strip(pathname);
}

function Item({ item }: { item: PageTree.Item }) {
    const pathname = usePathname();
    const active = !item.external && isCurrent(item.url, pathname);
    return (
        <SidebarItem
            href={item.url}
            external={item.external}
            active={active}
            aria-current={active ? "page" : undefined}
            // always an element, so the base item draws no external-link icon in its place: the
            // row ends with one instead
            icon={<Icon icon={item.icon} />}
            className={cn(
                ROW,
                "data-[active=true]:bg-fd-primary/10 data-[active=true]:font-medium data-[active=true]:text-fd-primary data-[active=true]:hover:bg-fd-primary/15",
            )}
        >
            <span className="min-w-0 flex-1">{item.name}</span>
            {item.external ? (
                <ExternalLink aria-hidden className="size-3.5! opacity-60" />
            ) : null}
        </SidebarItem>
    );
}

function Folder({
    item,
    children,
}: {
    item: PageTree.Folder;
    children: ReactNode;
}) {
    const path = useTreePath();
    const { root } = useTreeContext();
    const active = path.includes(item);
    const sectionsHaveIcons = root.children.some((child) => child.icon);
    const pagesHaveIcons = item.children.some((child) => child.icon);
    const pages = (
        <IconColumn value={pagesHaveIcons}>
            <div className="flex flex-col gap-0.5">{children}</div>
        </IconColumn>
    );

    if (!item.collapsible) {
        return (
            <SidebarFolder
                collapsible={false}
                active={active}
                className="group/section"
            >
                <div
                    data-sidebar-heading=""
                    className="flex items-center gap-2.5 px-2.5 pt-5 pb-1.5 font-medium text-fd-foreground/80 text-xs group-first/section:pt-0 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fd-primary"
                >
                    {item.icon}
                    {item.name}
                </div>
                {pages}
            </SidebarFolder>
        );
    }

    return (
        <SidebarFolder
            collapsible
            active={active}
            defaultOpen={item.defaultOpen}
        >
            <SidebarFolderTrigger
                data-sidebar-folder=""
                // Fumadocs' trigger ends with its chevron (down when open, turned when closed)
                className={cn(
                    ROW,
                    "font-medium text-fd-foreground/85 [&>svg:last-child]:text-fd-muted-foreground",
                )}
            >
                <IconColumn value={sectionsHaveIcons}>
                    <Icon icon={item.icon} />
                </IconColumn>
                <span className="min-w-0 flex-1">{item.name}</span>
            </SidebarFolderTrigger>
            <SidebarFolderContent>
                {/* the guide line runs under the section's icon */}
                <div
                    data-sidebar-pages=""
                    className="relative ms-4.5 mt-0.5 mb-1 ps-2 before:absolute before:inset-y-1 before:inset-s-0 before:w-px before:bg-fd-border"
                >
                    {pages}
                </div>
            </SidebarFolderContent>
        </SidebarFolder>
    );
}

export const docsSidebarComponents: Partial<SidebarPageTreeComponents> = {
    Item,
    Folder,
};
