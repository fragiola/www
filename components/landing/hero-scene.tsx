"use client";

import { useEffect, useRef, useState } from "react";

// The organization landing's WebGL scene, behind its hero (the Hero's `backdrop`, over the CSS
// grid). three comes in its own chunk, requested only here and only once the page is hydrated
// (components/landing/hero-scene-gl.ts). The scene:
//
//   - pauses when the hero is off-screen and when the tab is hidden;
//   - renders one still frame, no loop, under prefers-reduced-motion;
//   - recolours itself when the site's theme changes (the class and data-theme on <html>);
//   - leaves the CSS grid alone when WebGL is unavailable (no canvas, no error);
//   - releases the renderer and its WebGL context when the page is left.
//
// `data-state` says which of these it is in: loading, running, paused, still, unavailable;
// `data-scheme` the site scheme it last read its colours in.

type State = "loading" | "running" | "paused" | "still" | "unavailable";

export function HeroScene() {
    const host = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const [state, setState] = useState<State>("loading");
    // the site scheme the scene last read its colours in
    const [scheme, setScheme] = useState<string | undefined>();

    useEffect(() => {
        const element = host.current;
        const surface = canvas.current;
        if (!element || !surface) return;
        let disposed = false;
        let cleanup = () => {};

        import("./hero-scene-gl")
            .then(({ createHeroScene }) => {
                if (disposed) return;
                let scene: ReturnType<typeof createHeroScene>;
                try {
                    scene = createHeroScene(element, surface);
                } catch {
                    // no WebGL: the CSS grid stays the hero's background
                    setState("unavailable");
                    return;
                }
                const still = window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                );
                let visible = true;
                const update = () => {
                    if (still.matches) {
                        scene.stop();
                        scene.frame();
                        setState("still");
                    } else if (visible && !document.hidden) {
                        scene.start();
                        setState("running");
                    } else {
                        scene.stop();
                        setState("paused");
                    }
                };
                const observer = new IntersectionObserver(([entry]) => {
                    visible = entry?.isIntersecting ?? true;
                    update();
                });
                observer.observe(element);
                const resize = new ResizeObserver(() => {
                    scene.resize();
                    if (still.matches) scene.frame();
                });
                resize.observe(element);
                const scheme = () =>
                    setScheme(document.documentElement.dataset.theme);
                scheme();
                const theme = new MutationObserver(() => {
                    scene.recolour();
                    scheme();
                });
                theme.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ["class", "data-theme"],
                });
                document.addEventListener("visibilitychange", update);
                still.addEventListener("change", update);
                update();
                cleanup = () => {
                    observer.disconnect();
                    resize.disconnect();
                    theme.disconnect();
                    document.removeEventListener("visibilitychange", update);
                    still.removeEventListener("change", update);
                    scene.dispose();
                };
            })
            .catch(() => {
                if (!disposed) setState("unavailable");
            });

        return () => {
            disposed = true;
            cleanup();
        };
    }, []);

    return (
        <div
            ref={host}
            aria-hidden
            data-testid="hero-scene"
            data-state={state}
            data-scheme={scheme}
            className="hero-scene absolute inset-0 max-sm:opacity-40"
        >
            <canvas
                ref={canvas}
                hidden={state === "unavailable"}
                className={
                    state === "loading"
                        ? "size-full opacity-0"
                        : "size-full opacity-100 transition-opacity duration-1000 motion-reduce:transition-none"
                }
            />
        </div>
    );
}
