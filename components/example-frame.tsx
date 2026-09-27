"use client";

import { useEffect, useRef, useState } from "react";

// The live half of <Example>: the project's examples app in an iframe.
//
// Height: the manifest's, when it fixes one; otherwise the app reports its
// document height with postMessage({ type: "fragiola:example:resize", id,
// height }, origin) and the frame follows.
//
// No flash: the frame stays invisible until the app's resize messages settle
// (it has applied the theme by then, and a lazy demo has mounted: the first
// message often measures an empty page) or, for an app that never sends
// one, a moment after `load`.

const MESSAGE = "fragiola:example:resize";
const FALLBACK_HEIGHT = 200;
const REVEAL_AFTER_LOAD_MS = 500;
const SETTLE_MS = 150;

export function ExampleFrame({
    id,
    src,
    title,
    height,
}: {
    id: string;
    src: string;
    title: string;
    height?: number;
}) {
    const ref = useRef<HTMLIFrameElement>(null);
    const [reported, setReported] = useState<number>();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let settle: ReturnType<typeof setTimeout> | undefined;
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== location.origin) return;
            if (event.source !== ref.current?.contentWindow) return;
            const data = event.data as {
                type?: unknown;
                id?: unknown;
                height?: unknown;
            };
            if (data?.type !== MESSAGE || data.id !== id) return;
            if (typeof data.height === "number" && data.height > 0) {
                setReported(Math.ceil(data.height));
            }
            clearTimeout(settle);
            settle = setTimeout(() => setReady(true), SETTLE_MS);
        };
        window.addEventListener("message", onMessage);
        return () => {
            clearTimeout(settle);
            window.removeEventListener("message", onMessage);
        };
    }, [id]);

    return (
        <iframe
            ref={ref}
            src={src}
            title={title}
            loading="lazy"
            data-example-id={id}
            data-ready={ready || undefined}
            onLoad={() =>
                setTimeout(() => setReady(true), REVEAL_AFTER_LOAD_MS)
            }
            className="block w-full border-0 transition-opacity duration-150"
            style={{
                height: height ?? reported ?? FALLBACK_HEIGHT,
                opacity: ready ? 1 : 0,
            }}
        />
    );
}
