import type { ActionIcon, ActionVariant } from "@/lib/contract/types";
import { ActionLink } from "./action";
import { Reveal } from "./reveal";

// <Hero title description? eyebrow? background? actions?> (§3.4): the landing's first screen,
// as on the ui landing. The project owns the words and the links (already site URLs, the
// {examples} token already replaced); the site owns the look.
//
// The decorative layer sits behind the content inside the band, not escaping the column: a
// grid drawn with var(--palette-line) (`background="grid"`), a glow from `soft`, and a gradient
// that fades both into `base`, so the hero meets the next section without a seam.

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
}: {
    title: string;
    description?: string;
    eyebrow?: string;
    background?: "none" | "grid";
    actions?: HeroAction[];
}) {
    return (
        <header
            data-testid="hero"
            data-background={background}
            className="landing-band not-prose relative isolate overflow-hidden"
        >
            {background === "grid" ? (
                <div
                    aria-hidden
                    data-testid="hero-grid"
                    className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
                >
                    <div className="landing-grid absolute inset-0 opacity-50" />
                    <div className="absolute inset-x-0 -top-40 mx-auto h-96 w-full max-w-4xl rounded-full bg-radial from-palette-soft to-transparent blur-3xl" />
                    <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-palette-base" />
                </div>
            ) : null}
            <div
                className={
                    background === "grid"
                        ? "mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-24 sm:min-h-[34rem] sm:justify-center sm:py-32"
                        : "mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 pt-16 pb-12 sm:pt-24"
                }
            >
                <Reveal className="flex flex-col items-start gap-6">
                    {eyebrow ? (
                        <p
                            data-testid="eyebrow"
                            className="font-semibold text-palette-accent/85 text-xs uppercase tracking-wide"
                        >
                            {eyebrow}
                        </p>
                    ) : null}
                    <h1 className="max-w-3xl text-balance font-semibold text-4xl text-palette-contrast tracking-tight sm:text-5xl lg:text-6xl">
                        {title}
                    </h1>
                    {description ? (
                        <p className="max-w-2xl text-pretty text-base text-palette-accent/85 sm:text-lg">
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
                </Reveal>
            </div>
        </header>
    );
}
