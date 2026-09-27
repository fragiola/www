"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { embedHref } from "@/lib/contract/links";

// A project's embed app in an iframe (contract v1, §5), the only way the site shows an example.
//
// - src: `/<slug>/embed/<fw>/?id=<id>&theme=<theme>` (the directory, never index.html?…: §5.1),
//   fixed when the frame mounts. A
//   later theme is a `fragiola:example:theme` message, never a reload; a new src (Reset, another
//   example) is a new frame, which the parent asks for with a React key.
// - The frame stays invisible until the embed says `fragiola:example:ready`: by then its theme
//   is applied and its lazy parts are mounted, so there is no flash.
// - Height: a `fill` example gets its manifest `height` (or the page's); a `flow` example grows
//   with its `fragiola:example:resize` messages, never below `height`. With `fill` set, the
//   frame fills its container instead (the gallery's stage), a flow example still growing past
//   it.
// - Messages are same-origin only, and only from this frame's window.

const READY = "fragiola:example:ready";
const RESIZE = "fragiola:example:resize";
const THEME = "fragiola:example:theme";
/** How long an embed may take to say ready before the frame says it failed. */
const READY_TIMEOUT_MS = 15_000;

const subscribeNothing = () => () => {};

export interface ExampleFrameProps {
    slug: string;
    framework: string;
    id: string;
    title: string;
    /** the example theme; undefined until the site's scheme is known (nothing loads before) */
    theme: string | undefined;
    layout: "fill" | "flow";
    height: number;
    /** fill the container (the gallery's stage) rather than size the frame */
    fill?: boolean;
    /** load when near the viewport (docs pages) */
    lazy?: boolean;
    className?: string;
}

export function ExampleFrame({
    slug,
    framework,
    id,
    title,
    theme,
    layout,
    height,
    fill = false,
    lazy = false,
    className,
}: ExampleFrameProps) {
    const frame = useRef<HTMLIFrameElement>(null);
    // never in the server's HTML: a frame loading before hydration could say ready before
    // anyone listens
    const mounted = useSyncExternalStore(
        subscribeNothing,
        () => true,
        () => false,
    );
    // the theme the frame was loaded with: the first one known
    const [loadedWith, setLoadedWith] = useState(theme);
    if (loadedWith === undefined && theme !== undefined) setLoadedWith(theme);
    const applied = useRef<string | undefined>(undefined);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);
    const [reported, setReported] = useState<number>();

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (!frame.current || event.source !== frame.current.contentWindow)
                return;
            const data = event.data as {
                type?: unknown;
                id?: unknown;
                height?: unknown;
            } | null;
            if (data?.id !== id) return;
            if (data.type === READY) {
                setReady(true);
            } else if (
                data.type === RESIZE &&
                layout === "flow" &&
                typeof data.height === "number" &&
                data.height >= 0
            ) {
                setReported(Math.ceil(data.height));
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [id, layout]);

    // a theme chosen after load reaches the embed as a message (once it listens: after ready)
    useEffect(() => {
        if (!ready || theme === undefined) return;
        if (theme === (applied.current ?? loadedWith)) return;
        applied.current = theme;
        frame.current?.contentWindow?.postMessage(
            { type: THEME, theme },
            window.location.origin,
        );
    }, [ready, theme, loadedWith]);

    useEffect(() => {
        if (ready || loadedWith === undefined) return;
        const timer = setTimeout(() => setFailed(true), READY_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [ready, loadedWith]);

    const size = layout === "flow" ? Math.max(reported ?? 0, height) : height;
    const style = fill
        ? layout === "flow"
            ? { height: size, minHeight: "100%" }
            : { height: "100%" }
        : { height: size };

    return (
        <div
            data-testid="example-frame"
            data-example-id={id}
            data-framework={framework}
            data-layout={layout}
            data-ready={ready ? "" : undefined}
            className={cn("relative w-full", fill && "min-h-0", className)}
            style={fill ? { height: "100%" } : { height: size }}
        >
            {!mounted || loadedWith === undefined ? null : (
                <iframe
                    ref={frame}
                    src={embedHref(slug, framework, id, loadedWith)}
                    title={title}
                    loading={lazy ? "lazy" : "eager"}
                    allow="clipboard-read; clipboard-write; fullscreen"
                    data-theme={theme}
                    aria-hidden={ready ? undefined : true}
                    tabIndex={ready ? undefined : -1}
                    className={cn(
                        "block w-full border-0 bg-transparent transition-opacity duration-150",
                        ready ? "opacity-100" : "pointer-events-none opacity-0",
                    )}
                    style={style}
                />
            )}
            {ready ? null : (
                <div
                    aria-hidden={!failed}
                    role={failed ? "alert" : undefined}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center text-palette-accent/85 text-sm"
                >
                    {failed ? (
                        `The example “${title}” did not load.`
                    ) : (
                        <span className="size-4 animate-spin rounded-full border-2 border-palette-line border-t-palette-accent" />
                    )}
                </div>
            )}
        </div>
    );
}
