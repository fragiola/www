"use client";

import * as ResizablePrimitive from "react-resizable-panels";
import { cn } from "@/lib/cn";

// Resizable panels: shadcn's `resizable` (ui.shadcn.com/r/styles/base-nova/resizable.json), over
// react-resizable-panels v4 (Group, Panel, Separator), painted with Fragiola's palette roles
// instead of shadcn's tokens, which the vendored theme does not define (bg-border, ring-ring would
// paint nothing). Fragiola UI has no resizable yet, so this is the site's own code, not a copy of
// ui's registry (components/ui/ holds only those): when ui ships one, it replaces this file.
//
// The handle is a line of the line role; hovered, dragged or focused (the library's
// data-separator state) it is lit with the ring role, the colour of focus on this site. The hit
// area is wider than the line (`after:`), and the library adds its own minimum target size. While
// a handle is dragged, no iframe in the group takes the pointer (an example's embed, §5).
//
// The library sets `touch-action: pan-y` inline on the group and on each panel's inner element,
// which takes pinch-zoom and horizontal touch scrolling away from everything inside (a wide code
// line, an example's embed: the effective touch-action reaches into an iframe). Resizing is the
// handle's job, which keeps its own `touch-action: none`; the panels give the gestures back.

function ResizablePanelGroup({
    className,
    ...props
}: ResizablePrimitive.GroupProps) {
    return (
        <ResizablePrimitive.Group
            data-slot="resizable-panel-group"
            className={cn(
                "flex h-full w-full aria-[orientation=vertical]:flex-col",
                // a drag that crosses an iframe would end inside it: the frame's document takes
                // the pointer, the handle never hears it move
                "[&:has([data-separator=active])_iframe]:pointer-events-none",
                // the browser's own touch gestures back (see the header)
                "touch-auto!",
                className,
            )}
            {...props}
        />
    );
}

function ResizablePanel({
    className,
    ...props
}: ResizablePrimitive.PanelProps) {
    return (
        <ResizablePrimitive.Panel
            data-slot="resizable-panel"
            // the panel's inner element: the browser's own touch gestures back (see the header)
            className={cn("touch-auto!", className)}
            {...props}
        />
    );
}

function ResizableHandle({
    withHandle,
    className,
    ...props
}: ResizablePrimitive.SeparatorProps & {
    withHandle?: boolean;
}) {
    return (
        <ResizablePrimitive.Separator
            data-slot="resizable-handle"
            className={cn(
                "group/handle relative flex w-px items-center justify-center bg-palette-line outline-none transition-colors",
                "after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2",
                "data-[separator=active]:bg-palette-ring data-[separator=focus]:bg-palette-ring data-[separator=hover]:bg-palette-ring",
                "focus-visible:ring-2 focus-visible:ring-palette-ring",
                "aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-2 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
                className,
            )}
            {...props}
        >
            {withHandle ? (
                <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-palette-line transition-colors group-data-[separator=active]/handle:bg-palette-ring group-data-[separator=focus]/handle:bg-palette-ring group-data-[separator=hover]/handle:bg-palette-ring" />
            ) : null}
        </ResizablePrimitive.Separator>
    );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
