"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
    type KeyboardEvent,
    type PointerEvent,
    useId,
    useRef,
    useState,
} from "react";
import { ExampleFrame } from "@/components/example-frame";
import { defaultTheme, useSiteScheme } from "@/components/example-theme";
import { ProjectProvider, useFramework } from "@/components/framework";
import { MissingFramework } from "@/components/missing-framework";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { FeaturedExample } from "@/lib/projects";

// "See it live" on the organization's landing: a carousel of every project's featured example
// (the one its own landing features, lib/projects.ts `featuredExamples`), after the APG's tabbed
// carousel pattern:
//
//   - a tab list (one tab per project: its title and one line of its description), arrows to
//     move between them (mirrored in RTL), Home and End, and previous/next buttons;
//   - no autoplay: a carousel that moves by itself fights a visitor reading a live example;
//   - only the active slide runs an embed: its ExampleFrame is created when the slide becomes
//     active (and only after hydration, AGENTS.md rule 3) and removed when another is chosen, so
//     the page never holds more than one example iframe;
//   - the stage keeps one height for every slide (the tallest manifest `height`), with a
//     placeholder under the frame until it says ready, so switching never jumps;
//   - the theme is the landing's `theme`, else the first theme of the site's scheme (rule 4);
//     the framework is the site-wide choice (rule 7), an example missing in it says so;
//   - a horizontal swipe on touch moves between slides; nothing animates, so reduced motion
//     needs nothing more.
//
// Fragiola UI's slide explains its demo beside it: styling is one class.

/** The height a slide's example asks for: the landing's, else its default framework's. */
function slideHeight(slide: FeaturedExample): number {
    const variant =
        slide.variants[slide.project.defaultFramework] ??
        Object.values(slide.variants)[0];
    return slide.height ?? variant?.height ?? 400;
}

const SWIPE_PX = 48;

const controlButton =
    "inline-flex size-9 items-center justify-center rounded-md border border-palette-line bg-palette-base text-palette-accent transition-colors hover:bg-palette-soft hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring motion-reduce:transition-none";

const slideLink =
    "inline-flex items-center gap-1 rounded-sm font-medium text-palette-contrast text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring";

export function LivePreview({ slides }: { slides: FeaturedExample[] }) {
    const [active, setActive] = useState(0);
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const swipe = useRef<number | null>(null);
    const base = useId();
    const stage = Math.max(...slides.map(slideHeight));
    if (slides.length === 0) return null;

    const count = slides.length;
    const select = (index: number, focus = false) => {
        const next = (index + count) % count;
        setActive(next);
        const tab = tabs.current[next];
        // the tab list scrolls sideways when the tabs do not fit: keep the chosen one in view
        tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
        if (focus) tab?.focus();
    };
    const isRtl = (element: Element) =>
        getComputedStyle(element).direction === "rtl";

    const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
        const forward = isRtl(event.currentTarget) ? "ArrowLeft" : "ArrowRight";
        const back = isRtl(event.currentTarget) ? "ArrowRight" : "ArrowLeft";
        const target =
            event.key === forward
                ? active + 1
                : event.key === back
                  ? active - 1
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? count - 1
                      : undefined;
        if (target === undefined) return;
        event.preventDefault();
        select(target, true);
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        swipe.current = event.pointerType === "touch" ? event.clientX : null;
    };
    const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (swipe.current === null) return;
        const dx = event.clientX - swipe.current;
        swipe.current = null;
        if (Math.abs(dx) < SWIPE_PX) return;
        // a swipe towards the start shows the next slide, mirrored in RTL
        const towardsStart = isRtl(event.currentTarget) ? dx > 0 : dx < 0;
        select(active + (towardsStart ? 1 : -1));
    };

    return (
        <section
            aria-roledescription="carousel"
            aria-label="Live examples of every project"
            data-testid="live-preview"
            className="not-prose flex flex-col gap-4"
        >
            <div className="flex items-center gap-3">
                <div
                    role="tablist"
                    aria-label="Projects"
                    className="-m-1 flex min-w-0 flex-1 gap-2 overflow-x-auto p-1"
                >
                    {slides.map((slide, index) => (
                        <button
                            key={slide.project.slug}
                            ref={(element) => {
                                tabs.current[index] = element;
                            }}
                            type="button"
                            role="tab"
                            id={`${base}-tab-${index}`}
                            aria-controls={`${base}-slide-${index}`}
                            aria-selected={index === active}
                            tabIndex={index === active ? 0 : -1}
                            data-slide={slide.project.slug}
                            onClick={() => select(index)}
                            onKeyDown={onTabKey}
                            className="flex w-48 shrink-0 flex-col gap-0.5 rounded-md border border-palette-line bg-palette-base px-3 py-2 text-start transition-colors hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring aria-selected:border-palette-ring/60 aria-selected:bg-palette-soft motion-reduce:transition-none"
                        >
                            <span className="font-medium text-palette-contrast text-sm">
                                {slide.project.title}
                            </span>
                            <span className="truncate text-palette-accent/85 text-xs">
                                {slide.project.description}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="flex shrink-0 gap-2">
                    <button
                        type="button"
                        aria-label="Previous project"
                        aria-controls={`${base}-slides`}
                        className={controlButton}
                        onClick={() => select(active - 1)}
                    >
                        <ChevronLeft
                            aria-hidden
                            className="size-4 rtl:rotate-180"
                        />
                    </button>
                    <button
                        type="button"
                        aria-label="Next project"
                        aria-controls={`${base}-slides`}
                        className={controlButton}
                        onClick={() => select(active + 1)}
                    >
                        <ChevronRight
                            aria-hidden
                            className="size-4 rtl:rotate-180"
                        />
                    </button>
                </div>
            </div>
            <div id={`${base}-slides`} aria-live="polite">
                {slides.map((slide, index) => (
                    <div
                        key={slide.project.slug}
                        id={`${base}-slide-${index}`}
                        role="tabpanel"
                        aria-roledescription="slide"
                        aria-label={`${index + 1} of ${count}: ${slide.project.title}`}
                        data-slide={slide.project.slug}
                        hidden={index !== active}
                        className="flex flex-col gap-4"
                    >
                        {index === active ? (
                            <ProjectProvider project={slide.project}>
                                <Slide
                                    slide={slide}
                                    stage={stage}
                                    onPointerDown={onPointerDown}
                                    onPointerUp={onPointerUp}
                                />
                            </ProjectProvider>
                        ) : null}
                    </div>
                ))}
            </div>
        </section>
    );
}

function Slide({
    slide,
    stage,
    onPointerDown,
    onPointerUp,
}: {
    slide: FeaturedExample;
    stage: number;
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
}) {
    const chosen = useFramework();
    const framework = slide.framework ?? chosen;
    const scheme = useSiteScheme();
    const variant = slide.variants[framework];
    const theme =
        slide.theme ??
        (scheme ? defaultTheme(slide.themes, scheme) : undefined);
    const palettes = slide.project.slug === "ui";
    const title = variant?.title ?? slide.project.title;

    return (
        <>
            <div
                data-testid="live-caption"
                className="flex touch-pan-y flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
            >
                <p className="text-palette-accent/85 text-sm">
                    <span className="font-semibold text-palette-contrast">
                        {slide.project.title}
                    </span>
                    {variant ? ` — ${variant.title}` : null}
                </p>
                <div className="flex flex-wrap gap-4">
                    <Link
                        href={slide.landing}
                        data-testid="live-landing"
                        className={slideLink}
                    >
                        {`Visit ${slide.project.title}`}
                        <ArrowRight
                            aria-hidden
                            className="size-3.5 rtl:rotate-180"
                        />
                    </Link>
                    <Link
                        href={slide.gallery}
                        data-testid="live-gallery"
                        className={slideLink}
                    >
                        Open in the gallery
                    </Link>
                </div>
            </div>
            <div
                className={cn(
                    "grid grid-cols-[minmax(0,1fr)] gap-6",
                    palettes && "lg:grid-cols-[minmax(0,1fr)_17rem]",
                )}
            >
                <div
                    data-testid="live-stage"
                    className="palette-surface relative overflow-y-auto overflow-x-hidden rounded-xl border border-palette-line bg-palette-base text-palette-contrast shadow-lg"
                    style={{ height: stage }}
                >
                    {variant ? (
                        <ExampleFrame
                            key={`${slide.project.slug}:${framework}`}
                            slug={slide.project.slug}
                            framework={framework}
                            id={slide.id}
                            title={title}
                            theme={theme}
                            scheme={
                                slide.themes.find((t) => t.name === theme)
                                    ?.scheme
                            }
                            layout={variant.layout}
                            height={stage}
                            fill
                            lazy
                            placeholder={
                                <div className="flex size-full flex-col gap-3 self-stretch p-6 text-start">
                                    <span className="font-medium text-palette-accent/85 text-sm">
                                        {title}
                                    </span>
                                    <span className="text-palette-accent/85 text-xs">
                                        {variant.description}
                                    </span>
                                    <Skeleton className="mt-2 min-h-0 w-full flex-1" />
                                </div>
                            }
                        />
                    ) : (
                        <MissingFramework
                            slug={slide.project.slug}
                            id={slide.id}
                            framework={framework}
                            variants={slide.variants}
                            className="m-6"
                        />
                    )}
                </div>
                {palettes ? <PalettesNote /> : null}
            </div>
        </>
    );
}

// Fragiola UI's demo, explained: the colour is one class on a scope, never a variant
function PalettesNote() {
    return (
        <aside
            data-testid="palettes-note"
            aria-label="One class, and the colour changes"
            className="flex min-w-0 flex-col gap-3 text-palette-accent/85 text-sm leading-relaxed"
        >
            <p className="font-semibold text-base text-palette-contrast">
                One class, and the colour changes
            </p>
            <p>
                Styling is one class. Swap the palette class on a scope — a
                page, a card, one button — and every component inside repaints.
            </p>
            <p>
                No component has a colour variant. A new colour is a new
                palette: add one, and the whole system reads it.
            </p>
            <pre className="overflow-x-auto rounded-md border border-palette-line bg-palette-soft/40 p-3 font-mono text-palette-contrast text-xs">
                <code>
                    {
                        '<Clickable.Button className="palette-blue">Save</Clickable.Button>\n<Clickable.Button className="palette-danger">Delete</Clickable.Button>'
                    }
                </code>
            </pre>
        </aside>
    );
}
