import type { ReactNode } from "react";
import { Reveal } from "./reveal";

// <Section title eyebrow? description?> (§3.4): a landing section as on the ui landing — a rule
// above, an eyebrow, a heading, a lead, then its children (prose, <Features>, <Example>, code…).
// The header enters on scroll; the children keep the page's prose styles.

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
            className="landing-band border-palette-line border-t py-20 sm:py-28"
        >
            <div className="mx-auto w-full max-w-5xl px-6">
                <Reveal className="not-prose flex max-w-2xl flex-col gap-4">
                    {eyebrow ? (
                        <p
                            data-testid="eyebrow"
                            className="font-semibold text-palette-accent/85 text-xs uppercase tracking-wide"
                        >
                            {eyebrow}
                        </p>
                    ) : null}
                    <h2 className="text-balance font-semibold text-2xl text-palette-contrast tracking-tight sm:text-3xl">
                        {title}
                    </h2>
                    {description ? (
                        <p className="text-pretty text-base text-palette-accent/85">
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
