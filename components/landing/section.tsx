import type { ReactNode } from "react";
import { Reveal } from "./reveal";

// <Section title eyebrow? description?> (§3.4): a landing section — a hairline above that fades
// out at both ends, an eyebrow (a monospace label in a chromatic palette), a heading, a lead,
// then its children (prose, <Features>, <Example>, code…). The header enters on scroll; the
// children keep the page's prose styles.

export function Section({
    title,
    eyebrow,
    description,
    children,
}: {
    title: string;
    eyebrow?: string;
    description?: string;
    children?: ReactNode;
}) {
    return (
        <section
            data-testid="landing-section"
            className="landing-band relative py-20 sm:py-28"
        >
            <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-palette-line to-transparent"
            />
            <div className="mx-auto w-full max-w-5xl px-6">
                <Reveal className="not-prose flex max-w-2xl flex-col gap-4">
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
