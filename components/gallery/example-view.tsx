"use client";

import { BookOpen, Code2, Maximize, Minimize, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExampleFrame } from "@/components/example-frame";
import { setFramework } from "@/components/framework";
import { cn } from "@/lib/cn";
import { frameworkName } from "@/lib/frameworks";
import type { ThemeSummary } from "@/lib/projects";
import { iconButton, useShell, variantFor } from "./gallery-chrome";

// the panel (and the code block it renders with) loads when it first opens
const CodePanel = dynamic(
    () => import("@/components/code-panel").then((module) => module.CodePanel),
    { ssr: false },
);

// One example in the gallery (§4), ported from dockable's docs (components/site/
// examples-shell.tsx): its title, level, description and features, the toolbar (theme, framework,
// reset, fullscreen, code), the live example in the centre (the project's embed app in an iframe,
// §5) and the code on the right. The list around it is the gallery's layout (gallery-chrome.tsx),
// which stays mounted between examples.

function ThemeSwitcher({
    themes,
    value,
    onChange,
}: {
    themes: ThemeSummary[];
    value: string | undefined;
    onChange: (theme: string) => void;
}) {
    return (
        <fieldset className="flex flex-wrap items-center gap-1">
            <legend className="sr-only">Theme</legend>
            {themes.map((theme) => (
                <button
                    key={theme.name}
                    type="button"
                    aria-pressed={value === theme.name}
                    title={theme.description}
                    data-theme-option={theme.name}
                    className={cn(iconButton, "h-7 px-2 text-xs")}
                    onClick={() => onChange(theme.name)}
                >
                    <span aria-hidden className="flex -space-x-1">
                        {theme.swatch.map((color) => (
                            <span
                                key={color}
                                className="size-3 rounded-full border border-palette-line"
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </span>
                    {theme.title}
                </button>
            ))}
        </fieldset>
    );
}

function FrameworkSwitcher({
    frameworks,
    value,
}: {
    frameworks: string[];
    value: string;
}) {
    return (
        <fieldset className="flex items-center gap-1">
            <legend className="sr-only">Framework</legend>
            {frameworks.map((framework) => (
                <button
                    key={framework}
                    type="button"
                    aria-pressed={value === framework}
                    data-framework-option={framework}
                    className={cn(iconButton, "h-7 px-2 text-xs")}
                    onClick={() => setFramework(framework)}
                >
                    {frameworkName(framework)}
                </button>
            ))}
        </fieldset>
    );
}

export function ExampleView({ id }: { id: string }) {
    const { gallery, state, setState, framework, theme, ready } = useShell();
    const { project } = gallery;
    const [resetKey, setResetKey] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);

    // Fullscreen puts the whole page in fullscreen and lays the stage over it, rather than
    // making the stage the fullscreen element: what an example portals into its own <body>
    // stays inside the frame either way, and the page's own overlays keep painting. Escape (or
    // leaving fullscreen) restores the page.
    useEffect(() => {
        const onChange = () => {
            if (!document.fullscreenElement) setFullscreen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !event.defaultPrevented)
                setFullscreen(false);
        };
        document.addEventListener("fullscreenchange", onChange);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("fullscreenchange", onChange);
            document.removeEventListener("keydown", onKey);
        };
    }, []);

    const toggleFullscreen = () => {
        if (fullscreen) {
            setFullscreen(false);
            if (document.fullscreenElement) void document.exitFullscreen();
        } else {
            setFullscreen(true);
            void document.documentElement.requestFullscreen?.().catch(() => {
                // not allowed (an iframe, a browser setting): the overlay still works
            });
        }
    };

    const example = gallery.examples.find((entry) => entry.id === id);
    if (!example) return null;
    const { variant, available } = variantFor(example, framework);
    const level = gallery.levels.find((entry) => entry.id === example.level);
    const elsewhere = project.frameworks.filter((f) => example.variants[f]);
    const selectedTheme = gallery.themes.find((t) => t.name === theme);

    return (
        <>
            <main className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-palette-line border-b px-4 py-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-palette-soft px-2 py-0.5 text-palette-accent text-xs">
                                {level?.title ?? example.level}
                            </span>
                            <h1 className="text-lg">{variant.title}</h1>
                        </div>
                        <p className="mt-1 max-w-3xl text-palette-accent/85 text-sm">
                            {variant.description}
                        </p>
                        <ul
                            aria-label="Features"
                            className="mt-2 flex flex-wrap gap-1"
                        >
                            {variant.features.map((feature) => (
                                <li
                                    key={feature}
                                    className="rounded border border-palette-line px-1.5 py-0.5 font-mono text-[11px] text-palette-accent/85"
                                >
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>
                    {variant.docs ? (
                        <Link href={variant.docs} className={iconButton}>
                            <BookOpen aria-hidden className="size-4" />
                            Read the guide
                        </Link>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-palette-line border-b px-3 py-1.5">
                    <ThemeSwitcher
                        themes={gallery.themes}
                        value={theme}
                        onChange={(value) =>
                            setState((s) => ({ ...s, theme: value }))
                        }
                    />
                    {project.frameworks.length > 1 ? (
                        <FrameworkSwitcher
                            frameworks={project.frameworks}
                            value={framework}
                        />
                    ) : null}
                    <div className="ms-auto flex items-center gap-1">
                        <button
                            type="button"
                            data-testid="reset"
                            disabled={!available}
                            className={iconButton}
                            onClick={() => setResetKey((key) => key + 1)}
                        >
                            <RotateCcw aria-hidden className="size-4" />
                            Reset
                        </button>
                        <button
                            type="button"
                            aria-pressed={fullscreen}
                            className={iconButton}
                            onClick={toggleFullscreen}
                        >
                            {fullscreen ? (
                                <Minimize aria-hidden className="size-4" />
                            ) : (
                                <Maximize aria-hidden className="size-4" />
                            )}
                            Fullscreen
                        </button>
                        <button
                            type="button"
                            data-testid="toggle-code"
                            aria-pressed={state.code}
                            aria-controls="example-code"
                            className={iconButton}
                            onClick={() =>
                                setState((s) => ({ ...s, code: !s.code }))
                            }
                        >
                            <Code2 aria-hidden className="size-4" />
                            Code
                        </button>
                    </div>
                </div>

                <div
                    data-fullscreen={fullscreen ? "" : undefined}
                    className="flex min-h-0 flex-1 bg-palette-soft p-2 data-fullscreen:fixed data-fullscreen:inset-0 data-fullscreen:z-40 md:p-3"
                >
                    <div
                        data-testid="stage"
                        data-example-theme={theme}
                        data-scheme={selectedTheme?.scheme}
                        className="palette-surface grid min-h-0 flex-1 overflow-auto rounded-lg border border-palette-line bg-palette-base text-palette-contrast [grid-template:minmax(0,1fr)/minmax(0,1fr)]"
                    >
                        {!ready ? null : available ? (
                            <ExampleFrame
                                key={`${project.slug}:${framework}:${id}:${resetKey}`}
                                slug={project.slug}
                                framework={framework}
                                id={id}
                                title={variant.title}
                                theme={theme}
                                layout={variant.layout}
                                height={variant.height}
                                fill
                            />
                        ) : (
                            <div
                                role="status"
                                data-testid="missing-framework"
                                className="m-auto flex max-w-sm flex-col items-center gap-3 p-6 text-center text-sm"
                            >
                                <p>
                                    {`“${variant.title}” is not available for ${frameworkName(framework)} yet.`}
                                </p>
                                <div className="flex flex-wrap justify-center gap-1">
                                    {elsewhere.map((other) => (
                                        <button
                                            key={other}
                                            type="button"
                                            className={cn(
                                                iconButton,
                                                "border border-palette-line",
                                            )}
                                            onClick={() => setFramework(other)}
                                        >
                                            {`Show it in ${frameworkName(other)}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <aside
                id="example-code"
                aria-label="Example code"
                data-open={state.code ? "" : undefined}
                className="palette-surface absolute inset-0 z-40 hidden bg-palette-base data-open:block md:static md:w-[min(46rem,46%)] md:shrink-0 md:border-palette-line md:border-s"
            >
                {state.code && ready ? (
                    available ? (
                        <CodePanel
                            key={`${framework}:${id}`}
                            slug={project.slug}
                            framework={framework}
                            id={id}
                            theme={selectedTheme?.hasFile ? theme : undefined}
                            setup={variant.setup}
                            onClose={() =>
                                setState((s) => ({ ...s, code: false }))
                            }
                        />
                    ) : (
                        <p className="p-4 text-sm">
                            {`No ${frameworkName(framework)} code for this example yet.`}
                        </p>
                    )
                ) : null}
            </aside>
        </>
    );
}
