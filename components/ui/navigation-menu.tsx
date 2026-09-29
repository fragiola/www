"use client";

import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";
import { Text } from "@/components/atoms/text";
import { popup } from "@/components/families/popup";
import { cn } from "@/lib/cn";

// NavigationMenu — the heaviest primitive in the batch. A strip of triggers
// where each opens a morphing popup with a viewport that resizes between
// items. The popup is `popup.content` — the second consumer of that family
// outside menus (after popover). No new popup member was needed: the
// viewport's size transition uses the primitive's `--popup-width` /
// `--popup-height` CSS variables, not a family member.
//
// No navigation family is created. Tabs and navigation-menu triggers share
// state normalisation (the `highlighted` custom variant) but differ in
// cursor, rounding and state-specific treatments. The negative result is
// recorded in the port report.
//
// `Link` renders `Text.Link` through `render` and supports the consumer's
// router link the same way. The trigger's chevron rotates on open
// (data-popup-open) and sits on the inline end (`ms-auto`, not `ml-auto`).
// Content layout (grids of links) is the consumer's; we supply the parts,
// not a layout.

function NavigationMenuRoot<Value>({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Root<Value>>) {
    return (
        <NavigationMenuPrimitive.Root<Value>
            data-slot="navigation-menu"
            className={cn("flex flex-col gap-2", className as string)}
            {...props}
        />
    );
}

function NavigationMenuList({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
    return (
        <NavigationMenuPrimitive.List
            data-slot="navigation-menu-list"
            className={cn(
                "flex flex-row items-center gap-1",
                className as string,
            )}
            {...props}
        />
    );
}

function NavigationMenuItem({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
    return (
        <NavigationMenuPrimitive.Item
            data-slot="navigation-menu-item"
            className={cn("relative", className as string)}
            {...props}
        />
    );
}

function NavigationMenuTrigger({
    className,
    children,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
    // The trigger: no typography of its own (the consumer's text is the
    // label). `highlighted` covers :focus. The open state is
    // `data-popup-open:bg-palette-soft` (a role). Focus ring is
    // `palette-ring`. The chevron sits on the inline end (`ms-auto`) and
    // rotates on open.
    return (
        <NavigationMenuPrimitive.Trigger
            data-slot="navigation-menu-trigger"
            className={cn(
                "relative cursor-pointer inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-palette-accent/85 outline-none select-none",
                "highlighted:bg-palette-soft highlighted:text-palette-contrast",
                "data-popup-open:bg-palette-soft data-popup-open:text-palette-contrast",
                "focus-visible:outline-2 focus-visible:outline-palette-ring",
                className as string,
            )}
            {...props}
        >
            {children}
            <ChevronDownIcon
                className="size-4 text-palette-accent/85 transition-transform duration-200 data-popup-open:rotate-180"
                data-slot="navigation-menu-icon"
            />
        </NavigationMenuPrimitive.Trigger>
    );
}

function NavigationMenuContent({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
    // Content is moved into the viewport by the primitive. The outgoing
    // content stays mounted (absolutely positioned over the incoming one)
    // until its exit transition finishes, so an exit effect on switch would
    // overlay the new content. Switching items (`data-activation-direction`
    // is only set while the menu stays open) hides the outgoing content at
    // once; only the incoming content transitions in, from the side of the
    // trigger that activated it. Closing the menu (no direction) fades the
    // content with the popup.
    //
    // `data-starting-style` / `data-ending-style` are TRANSITION markers (the
    // attribute lives one frame on entry), so they drive a transition, never
    // a keyframe class. `activation-direction` is physical in the primitive
    // (measured left/right), so the translate is physical too.
    return (
        <NavigationMenuPrimitive.Content
            data-slot="navigation-menu-content"
            className={cn(
                "flex flex-col gap-2 p-2 outline-none",
                "transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
                "data-starting-style:opacity-0 data-ending-style:opacity-0",
                "data-starting-style:data-[activation-direction=left]:-translate-x-8",
                "data-starting-style:data-[activation-direction=right]:translate-x-8",
                "data-ending-style:data-activation-direction:hidden",
                className as string,
            )}
            {...props}
        />
    );
}

function NavigationMenuLink({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
    // Renders Text.Link through render — the consumer stitches a router link
    // the same way as every other link in the project. The active state is a
    // role (data-[active]:text-palette-contrast), not a colour.
    return (
        <NavigationMenuPrimitive.Link
            data-slot="navigation-menu-link"
            render={<Text.Link />}
            className={cn(
                "text-palette-accent/85 data-active:text-palette-contrast",
                className as string,
            )}
            {...props}
        />
    );
}

function NavigationMenuPortal({
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Portal>) {
    return (
        <NavigationMenuPrimitive.Portal
            data-slot="navigation-menu-portal"
            {...props}
        />
    );
}

function NavigationMenuPositioner({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Positioner>) {
    return (
        <NavigationMenuPrimitive.Positioner
            data-slot="navigation-menu-positioner"
            className={cn("z-50 outline-none", className as string)}
            {...props}
        />
    );
}

function NavigationMenuPopup({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Popup>) {
    // The popup is `popup.content` — the same floating box dropdown-menu and
    // popover use. The viewport's size transition uses the primitive's
    // --popup-width / --popup-height CSS variables; no new popup member.
    return (
        <NavigationMenuPrimitive.Popup
            data-slot="navigation-menu-popup"
            className={cn(
                popup.content("z-50 outline-none"),
                "overflow-hidden",
                className as string,
            )}
            {...props}
        />
    );
}

function NavigationMenuViewport({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
    // The viewport morphs between items of different sizes. The transition
    // uses the primitive's --popup-width / --popup-height CSS variables
    // (set on the popup). `transition-[width,height]` animates the morph;
    // the primitive handles the variable updates. No `!important`.
    return (
        <NavigationMenuPrimitive.Viewport
            data-slot="navigation-menu-viewport"
            className={cn(
                "flex w-full origin-(--transform-origin) transition-[width,height] duration-200",
                className as string,
            )}
            {...props}
        />
    );
}

function NavigationMenuArrow({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Arrow>) {
    return (
        <NavigationMenuPrimitive.Arrow
            data-slot="navigation-menu-arrow"
            className={cn(
                "z-50 size-2 rotate-45 border border-palette-line bg-palette-base",
                "data-[side=bottom]:top-0 data-[side=bottom]:-translate-y-1/2",
                "data-[side=top]:bottom-0 data-[side=top]:translate-y-1/2",
                "data-[side=left]:right-0 data-[side=left]:translate-x-1/2",
                "data-[side=right]:left-0 data-[side=right]:-translate-x-1/2",
                className as string,
            )}
            {...props}
        />
    );
}

function NavigationMenuBackdrop({
    className,
    ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Backdrop>) {
    return (
        <NavigationMenuPrimitive.Backdrop
            data-slot="navigation-menu-backdrop"
            className={cn(
                "fixed inset-0 z-40 bg-scrim",
                "data-open:animate-in data-open:fade-in-0",
                "data-closed:animate-out data-closed:fade-out-0",
                className as string,
            )}
            {...props}
        />
    );
}

export const NavigationMenu = {
    Root: NavigationMenuRoot,
    List: NavigationMenuList,
    Item: NavigationMenuItem,
    Trigger: NavigationMenuTrigger,
    Content: NavigationMenuContent,
    Link: NavigationMenuLink,
    Portal: NavigationMenuPortal,
    Positioner: NavigationMenuPositioner,
    Popup: NavigationMenuPopup,
    Viewport: NavigationMenuViewport,
    Arrow: NavigationMenuArrow,
    Backdrop: NavigationMenuBackdrop,
};
