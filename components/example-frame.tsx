"use client";

import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import {
    holdScroll,
    measurePromotion,
    type Promotion,
} from "@/components/example-promotion";
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
// - The iframe's `color-scheme` is the example theme's scheme (§5.1, v1.3): a frame whose scheme
//   differs from its document's is painted on an opaque canvas, not a transparent one.
// - Overlay promotion (§5.4, v1.3): while the example has a modal overlay open, the frame covers
//   the viewport. It goes to the top layer (`popover="manual"`), which escapes every containing
//   block and stacking context around it (the gallery's size container, its scrolling stage)
//   without moving the iframe in the DOM — a moved iframe reloads. The wrapper keeps the frame's
//   place; the page's scroll is held still (example-promotion.ts). The embed keeps its example
//   where it was and opens the overlay once `promoted` arrives.

const READY = "fragiola:example:ready";
const RESIZE = "fragiola:example:resize";
const THEME = "fragiola:example:theme";
const HOST = "fragiola:example:host";
const OVERLAY = "fragiola:example:overlay";
const PROMOTE = "fragiola:example:promote";
const ARMED = "fragiola:example:armed";
const PROMOTED = "fragiola:example:promoted";
/** How long the site waits for `armed` before it promotes the frame anyway (§5.4). */
const ARM_TIMEOUT_MS = 500;
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
    /** the example theme's scheme: the iframe's `color-scheme` */
    scheme?: "light" | "dark";
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
    scheme,
    layout,
    height,
    fill = false,
    lazy = false,
    className,
}: ExampleFrameProps) {
    const frame = useRef<HTMLIFrameElement>(null);
    const wrapper = useRef<HTMLDivElement>(null);
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
    // §5.4: inline → arming (asked to promote, `promote` sent) → promoted → inline
    const [promotion, setPromotion] = useState<Promotion | null>(null);
    const phase = useRef<"inline" | "arming" | "promoted">("inline");
    const pending = useRef<Promotion | null>(null);
    const armTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const releaseScroll = useRef<(() => void) | null>(null);

    useEffect(() => {
        const post = (message: object) =>
            frame.current?.contentWindow?.postMessage(
                message,
                window.location.origin,
            );
        const promote = () => {
            if (phase.current !== "arming") return;
            clearTimeout(armTimer.current);
            phase.current = "promoted";
            setPromotion(pending.current);
        };
        const askedToPromote = () => {
            if (
                phase.current !== "inline" ||
                !wrapper.current ||
                !frame.current
            )
                return;
            phase.current = "arming";
            releaseScroll.current = holdScroll(wrapper.current);
            pending.current = measurePromotion(
                wrapper.current,
                frame.current.getBoundingClientRect().height,
            );
            post({ type: PROMOTE, ...pending.current });
            armTimer.current = setTimeout(promote, ARM_TIMEOUT_MS);
        };
        const returnInline = () => {
            clearTimeout(armTimer.current);
            if (phase.current === "inline") return;
            phase.current = "inline";
            releaseScroll.current?.();
            releaseScroll.current = null;
            pending.current = null;
            setPromotion(null);
        };
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (!frame.current || event.source !== frame.current.contentWindow)
                return;
            const data = event.data as {
                type?: unknown;
                id?: unknown;
                height?: unknown;
                open?: unknown;
            } | null;
            if (data?.id !== id) return;
            if (data.type === OVERLAY) {
                if (data.open === true) askedToPromote();
                else if (data.open === false) returnInline();
            } else if (data.type === ARMED) {
                promote();
            } else if (data.type === READY) {
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
        return () => {
            window.removeEventListener("message", onMessage);
            // unmounted while promoted (Reset, another example, another page): the page's
            // scroll is the page's again
            clearTimeout(armTimer.current);
            releaseScroll.current?.();
            releaseScroll.current = null;
            phase.current = "inline";
        };
    }, [id, layout]);

    // the embed may ask for promotion once the site says it can (§5.4)
    useEffect(() => {
        if (!ready) return;
        frame.current?.contentWindow?.postMessage(
            { type: HOST, overlay: true },
            window.location.origin,
        );
    }, [ready]);

    // into the top layer and out of it, before the browser paints the new geometry
    useLayoutEffect(() => {
        const element = frame.current;
        if (!element) return;
        const open = element.matches(":popover-open");
        if (promotion) {
            if (!open) element.showPopover();
            element.contentWindow?.postMessage(
                { type: PROMOTED, ...promotion },
                window.location.origin,
            );
        } else if (open) {
            element.hidePopover();
        }
    }, [promotion]);

    // a resized viewport while promoted: new geometry, told again
    useEffect(() => {
        if (!promotion) return;
        const onResize = () => {
            if (phase.current !== "promoted" || !wrapper.current) return;
            setPromotion(
                measurePromotion(wrapper.current, promotion.rect.height),
            );
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [promotion]);

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
    const inline = fill
        ? layout === "flow"
            ? { height: size, minHeight: "100%" }
            : { height: "100%" }
        : { height: size };
    // promoted: the viewport from its top-left corner (§5.4), physical like the `rect` the
    // embed was given
    const style = promotion
        ? {
              position: "fixed" as const,
              top: 0,
              left: 0,
              width: promotion.viewport.width,
              height: promotion.viewport.height,
              minHeight: 0,
              colorScheme: scheme,
          }
        : { ...inline, colorScheme: scheme };

    return (
        <div
            ref={wrapper}
            data-testid="example-frame"
            data-example-id={id}
            data-framework={framework}
            data-layout={layout}
            data-ready={ready ? "" : undefined}
            data-promoted={promotion ? "" : undefined}
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
                    popover="manual"
                    data-theme={theme}
                    aria-hidden={ready ? undefined : true}
                    tabIndex={ready ? undefined : -1}
                    className={cn(
                        // a closed popover is display: none and position: fixed by default:
                        // this one stays an ordinary block in its place until promoted
                        "static inset-auto m-0 block w-full overflow-visible border-0 bg-transparent p-0 transition-opacity duration-150",
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
