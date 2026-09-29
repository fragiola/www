import type { ReactNode } from "react";
import type { ActionIcon, ActionVariant } from "@/lib/contract/types";
import { ActionLink } from "./action";
import { Reveal } from "./reveal";

// <Hero title description? eyebrow? background? actions?> (§3.4): the landing's first screen.
// The project owns the words and the links (already site URLs, the {examples} token already
// replaced); the site owns the look, the same for every project.
//
// The decorative layer sits behind the content inside the band, not escaping the column: a grid
// drawn with var(--palette-line) and faded out towards the edges (`background="grid"`), two glows
// painted by chromatic palettes (the palette goes on the element), and a fade into `base` at the
// bottom, so the hero meets the next section without a seam. `backdrop` is the site's own slot,
// not the vocabulary's: the organization's landing puts its scene there, over the grid.

export interface HeroAction {
    label: string;
    href: string;
    variant?: ActionVariant;
    icon?: ActionIcon;
}

export function Hero({
    title,
    description,
    eyebrow,
    background = "none",
    actions = [],
    backdrop,
    children,
}: {
    title: string;
    description?: string;
    eyebrow?: string;
    background?: "none" | "grid";
    actions?: HeroAction[];
    backdrop?: ReactNode;
    children?: ReactNode;
}) {
    const grid = background === "grid";
    return (
        <header
            data-testid="hero"
            data-background={background}
            className="landing-band not-prose relative isolate overflow-hidden"
        >
            {grid ? (
                <div
                    aria-hidden
                    data-testid="hero-grid"
                    className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
                >
                    <div className="landing-grid landing-grid-fade absolute inset-0 opacity-70" />
                    <div className="palette-purple absolute inset-x-0 -top-56 mx-auto h-112 w-[min(56rem,100%)] rounded-full bg-palette-base opacity-25 blur-[120px]" />
                    <div className="palette-blue absolute -end-40 top-24 h-80 w-120 rounded-full bg-palette-base opacity-15 blur-[120px]" />
                    {backdrop}
                    <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-b from-transparent to-palette-base" />
                </div>
            ) : null}
            <div
                className={
                    grid
                        ? "mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-24 sm:min-h-[38rem] sm:justify-center sm:py-32"
                        : "mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 pt-16 pb-12 sm:pt-24"
                }
            >
                <Reveal className="flex flex-col items-start gap-6">
                    {eyebrow ? (
                        <p
                            data-testid="eyebrow"
                            className="inline-flex items-center gap-2 rounded-full border border-palette-line bg-palette-soft/40 px-3 py-1 font-mono text-[0.6875rem] text-palette-accent/85 uppercase tracking-widest backdrop-blur-sm"
                        >
                            <span
                                aria-hidden
                                className="palette-green size-1.5 rounded-full bg-palette-base"
                            />
                            {eyebrow}
                        </p>
                    ) : null}
                    <h1 className="landing-title max-w-4xl text-balance font-semibold text-4xl tracking-tighter sm:text-6xl lg:text-7xl">
                        {title}
                    </h1>
                    {description ? (
                        <p className="max-w-2xl text-pretty text-base text-palette-accent/85 leading-relaxed sm:text-lg">
                            {description}
                        </p>
                    ) : null}
                    {actions.length > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            {actions.map((action, index) => (
                                <ActionLink
                                    key={`${action.href}:${action.label}`}
                                    label={action.label}
                                    href={action.href}
                                    // unset: the first is the primary one, the rest secondary
                                    variant={
                                        action.variant ??
                                        (index === 0 ? "primary" : "secondary")
                                    }
                                    {...(action.icon
                                        ? { icon: action.icon }
                                        : {})}
                                />
                            ))}
                        </div>
                    ) : null}
                    {children}
                </Reveal>
            </div>
        </header>
    );
}
