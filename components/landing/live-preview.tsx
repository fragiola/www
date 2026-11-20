"use client";

import { ArrowRight } from "lucide-react";
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
import type { FeaturedExample } from "@/lib/projects";
import { LivePlaceholder } from "./live-placeholder";
import { claimLive, useLive, useLiveSection } from "./live-slot";

// "See it live" on the organization's landing: every project's featured example (the one its own
// landing features, lib/projects.ts `featuredExamples`), after the APG's tabbed carousel pattern:
//
//   - a tab list of small chips, one per project, its name only, wrapping on a narrow screen;
//     arrows move between them (mirrored in RTL), Home and End too. No previous/next buttons:
//     every chip is in view;
//   - above the stage, the active project's description and two links: its landing and the
//     example in its gallery;
//   - no autoplay: a carousel that moves by itself fights a visitor reading a live example;
//   - only the active slide runs an embed: its ExampleFrame is created when the slide becomes
//     active (and only after hydration, AGENTS.md rule 3) and removed when another is chosen. The
//     page's palette section runs one too: they share one slot (live-slot.ts), so the page never
//     holds more than one example iframe;
//   - the stage keeps one height for every slide (the tallest manifest `height`), with a
//     placeholder under the frame until it says ready, so switching never jumps;
//   - the theme is the landing's `theme`, else the first theme of the site's scheme (rule 4);
//     the framework is the site-wide choice (rule 7), an example missing in it says so;
//   - a horizontal swipe on touch moves between slides; nothing animates, so reduced motion
//     needs nothing more.

/** The height a slide's example asks for: the landing's, else its default framework's. */
function slideHeight(slide: FeaturedExample): number {
    const variant =
        slide.variants[slide.project.defaultFramework] ??
        Object.values(slide.variants)[0];
    return slide.height ?? variant?.height ?? 400;
}

const SWIPE_PX = 48;

const slideLink =
    "inline-flex items-center gap-1 rounded-sm font-medium text-palette-contrast text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring";

export function LivePreview({ slides }: { slides: FeaturedExample[] }) {
    const [active, setActive] = useState(0);
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const swipe = useRef<number | null>(null);
    const base = useId();
    const region = useRef<HTMLElement>(null);
    useLiveSection(region, "preview");
    const live = useLive("preview");
    const stage = Math.max(...slides.map(slideHeight));
    if (slides.length === 0) return null;

    const count = slides.length;
    const select = (index: number, focus = false) => {
        const next = (index + count) % count;
        setActive(next);
        // a reader's choice: this section's example runs, not the palette section's
        claimLive("preview");
        if (focus) tabs.current[next]?.focus();
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
            ref={region}
            aria-roledescription="carousel"
            aria-label="Live examples of every project"
            data-testid="live-preview"
            className="not-prose flex flex-col gap-4"
        >
            <div
                role="tablist"
                aria-label="Projects"
                className="flex flex-wrap gap-2"
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
                        className="inline-flex h-8 items-center rounded-full border border-palette-line bg-palette-base px-3.5 font-medium text-palette-accent text-sm transition-colors hover:bg-palette-soft hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring aria-selected:border-palette-ring/60 aria-selected:bg-palette-soft aria-selected:text-palette-contrast motion-reduce:transition-none"
                    >
                        {slide.project.title}
                    </button>
                ))}
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
                                    live={live}
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
    live,
    onPointerDown,
    onPointerUp,
}: {
    slide: FeaturedExample;
    stage: number;
    /** whether this section holds the page's one example slot (live-slot.ts) */
    live: boolean;
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
    const title = variant?.title ?? slide.project.title;

    return (
        <>
            <div
                data-testid="live-caption"
                className="flex touch-pan-y flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
            >
                <p
                    data-testid="live-description"
                    className="min-w-0 max-w-2xl text-palette-accent/85 text-sm"
                >
                    {slide.project.description}
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
                data-testid="live-stage"
                className="palette-surface relative overflow-y-auto overflow-x-hidden rounded-xl border border-palette-line bg-palette-base text-palette-contrast shadow-lg"
                style={{ height: stage }}
            >
                {!variant ? (
                    <MissingFramework
                        slug={slide.project.slug}
                        id={slide.id}
                        framework={framework}
                        variants={slide.variants}
                        className="m-6"
                    />
                ) : live ? (
                    <ExampleFrame
                        key={`${slide.project.slug}:${framework}`}
                        slug={slide.project.slug}
                        framework={framework}
                        id={slide.id}
                        title={title}
                        theme={theme}
                        scheme={
                            slide.themes.find((t) => t.name === theme)?.scheme
                        }
                        layout={variant.layout}
                        height={stage}
                        fill
                        lazy
                        placeholder={
                            <LivePlaceholder
                                title={title}
                                description={variant.description}
                            />
                        }
                    />
                ) : (
                    <LivePlaceholder
                        title={title}
                        description={variant.description}
                        onRun={() => claimLive("preview")}
                    />
                )}
            </div>
        </>
    );
}
