"use client";

import { useEffect, useRef, useState } from "react";
import { defaultTheme, useSiteScheme } from "@/components/example-theme";
import { cn } from "@/lib/cn";
import { createAppHref } from "@/lib/contract/links";
import type { ThemeSummary } from "@/lib/projects";

// A project's Create page (contract v1.6, §5.5) in an iframe: the page's whole viewport, the
// project's own app and chrome inside, nothing of the site drawn over it. The lifecycle of an
// example frame (components/example-frame.tsx), without what a full page does not need:
//
// - src: `/<slug>/embed/<fw>/create.html?theme=<theme>`, fixed when the frame mounts, which is
//   only after hydration (a frame loading before could say ready before anyone listens) and
//   once the site's scheme is known (the theme is the first of that scheme, §4).
// - Invisible until `fragiola:example:ready`; then `fragiola:example:host` (overlay: false, the
//   frame is already the whole page: no promotion, §5.4) and `fragiola:example:theme` with the
//   current theme, again whenever the site's theme changes: never a reload.
// - No `resize`: the frame is the viewport's size. Messages are same-origin only, and only from
//   this frame's window.
// - Its `color-scheme` is the theme's scheme (§5.1): no opaque canvas behind a transparent root.

const READY = "fragiola:example:ready";
const THEME = "fragiola:example:theme";
const HOST = "fragiola:example:host";
/** How long the app may take to say ready before the page says it failed. */
const READY_TIMEOUT_MS = 15_000;

export interface CreateFrameProps {
    slug: string;
    framework: string;
    /** the page's title: the frame's accessible name */
    title: string;
    themes: Pick<ThemeSummary, "name" | "scheme">[];
}

export function CreateFrame({
    slug,
    framework,
    title,
    themes,
}: CreateFrameProps) {
    const frame = useRef<HTMLIFrameElement>(null);
    // undefined until mounted: never in the server's HTML
    const scheme = useSiteScheme();
    const theme = scheme ? defaultTheme(themes, scheme) : undefined;
    const themeScheme = themes.find((t) => t.name === theme)?.scheme ?? scheme;
    // the theme the frame was loaded with: the first one known
    const [loadedWith, setLoadedWith] = useState(theme);
    if (loadedWith === undefined && theme !== undefined) setLoadedWith(theme);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (!frame.current || event.source !== frame.current.contentWindow)
                return;
            const data = event.data as { type?: unknown } | null;
            if (data?.type === READY) setReady(true);
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, []);

    // once ready: the host first, once (no promotion here)
    useEffect(() => {
        if (!ready) return;
        frame.current?.contentWindow?.postMessage(
            { type: HOST, overlay: false },
            window.location.origin,
        );
    }, [ready]);

    // then the theme, and every theme after it (declared after the host's: effects run in order)
    useEffect(() => {
        if (!ready || theme === undefined) return;
        frame.current?.contentWindow?.postMessage(
            { type: THEME, theme },
            window.location.origin,
        );
    }, [ready, theme]);

    useEffect(() => {
        if (ready || loadedWith === undefined) return;
        const timer = setTimeout(() => setFailed(true), READY_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [ready, loadedWith]);

    return (
        <div
            data-testid="create-frame"
            data-ready={ready ? "" : undefined}
            className="relative size-full"
        >
            {loadedWith === undefined ? null : (
                <iframe
                    ref={frame}
                    src={createAppHref(slug, framework, loadedWith)}
                    title={title}
                    allow="clipboard-read; clipboard-write; fullscreen"
                    data-theme={theme}
                    aria-hidden={ready ? undefined : true}
                    tabIndex={ready ? undefined : -1}
                    className={cn(
                        "block size-full border-0 bg-transparent transition-opacity duration-150",
                        ready ? "opacity-100" : "pointer-events-none opacity-0",
                    )}
                    style={{ colorScheme: themeScheme }}
                />
            )}
            {ready ? null : (
                <div
                    aria-hidden={!failed}
                    role={failed ? "alert" : undefined}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center text-palette-accent/85 text-sm"
                >
                    {failed ? (
                        `${title} did not load.`
                    ) : (
                        <span className="size-4 animate-spin rounded-full border-2 border-palette-line border-t-palette-accent" />
                    )}
                </div>
            )}
        </div>
    );
}
