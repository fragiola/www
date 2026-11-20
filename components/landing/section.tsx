import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "./reveal";

// <Section title eyebrow? description?> (§3.4): a landing section — a hairline above that fades
// out at both ends, an eyebrow (a monospace label in a chromatic palette), a heading, a lead,
// then its children (prose, <Features>, <Example>, code…). The header enters on scroll; the
// children keep the page's prose styles.

export function Section({
    id,
    testId = "landing-section",
    wide = false,
    title,
    eyebrow,
    description,
    children,
}: {
    /** the site's, not the vocabulary's: an anchor on the organization's landing */
    id?: string;
    /** the site's too: a www-owned band (the agent band) is not one of the page's sections */
    testId?: string;
    /** the site's too: the content wider than the prose column (a live example's room) */
    wide?: boolean;
    title: string;
    eyebrow?: string;
    description?: string;
    children?: ReactNode;
}) {
    return (
        <section
            id={id}
            data-testid={testId}
            className="landing-band relative py-20 sm:py-28"
        >
            <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-palette-line to-transparent"
            />
            <div
                className={cn(
                    "mx-auto w-full px-6",
                    wide ? "max-w-7xl" : "max-w-5xl",
                )}
            >
                {/* a wide section's header stays in the prose column, like every other one */}
                <Reveal
                    className={cn(
                        "not-prose flex flex-col gap-4",
                        wide
                            ? "mx-auto w-full max-w-[61rem] [&>*]:max-w-2xl"
                            : "max-w-2xl",
                    )}
                >
                    {eyebrow ? (
                        <p
                            data-testid="eyebrow"
                            className="palette-purple flex items-center gap-3 font-mono text-palette-accent text-xs uppercase tracking-widest"
                        >
                            <span
                                aria-hidden
                                className="h-px w-6 bg-palette-base"
                            />
                            {eyebrow}
                        </p>
                    ) : null}
                    <h2 className="landing-title text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
                        {title}
                    </h2>
                    {description ? (
                        <p className="text-pretty text-base text-palette-accent/85 leading-relaxed sm:text-lg">
                            {description}
                        </p>
                    ) : null}
                </Reveal>
                {children ? (
                    <div className="mt-12 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                        {children}
                    </div>
                ) : null}
            </div>
        </section>
    );
}
