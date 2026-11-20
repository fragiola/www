"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { ExampleFrame } from "@/components/example-frame";
import { defaultTheme, useSiteScheme } from "@/components/example-theme";
import { ProjectProvider, useFramework } from "@/components/framework";
import { MissingFramework } from "@/components/missing-framework";
import type { FeaturedExample } from "@/lib/projects";
import { LivePlaceholder } from "./live-placeholder";
import { claimLive, useLive, useLiveSection } from "./live-slot";

// "One class, one palette" on the organization's landing: Fragiola UI's palette example
// (lib/projects.ts `paletteExample`: `palette-maker`, else `palettes`) beside what it shows —
// styling is one class, no component has a colour variant, a new colour is a new palette the
// whole system reads. The frame shares the page's one example slot with "See it live"
// (live-slot.ts): it runs while this section is the one in view, or when the reader asks.

const DEFAULT_HEIGHT = 420;

const SNIPPETS = {
    "palette-maker":
        '<Clickable.Button className="palette-blue">Save</Clickable.Button>\n<Clickable.Button className="my-palette-1">Save</Clickable.Button>',
    palettes:
        '<Clickable.Button className="palette-blue">Save</Clickable.Button>\n<Clickable.Button className="palette-danger">Delete</Clickable.Button>',
} as const;

export function PaletteSection({ example }: { example: FeaturedExample }) {
    const region = useRef<HTMLDivElement>(null);
    useLiveSection(region, "palette");
    return (
        <ProjectProvider project={example.project}>
            <div
                ref={region}
                data-testid="palette-section"
                data-example={example.id}
                className="not-prose grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
            >
                <PaletteStage example={example} />
                <PaletteNote example={example} />
            </div>
        </ProjectProvider>
    );
}

function PaletteStage({ example }: { example: FeaturedExample }) {
    const live = useLive("palette");
    const chosen = useFramework();
    const framework = example.framework ?? chosen;
    const scheme = useSiteScheme();
    const variant = example.variants[framework];
    const theme =
        example.theme ??
        (scheme ? defaultTheme(example.themes, scheme) : undefined);
    const height = example.height ?? variant?.height ?? DEFAULT_HEIGHT;
    const title = variant?.title ?? example.project.title;
    return (
        <div
            data-testid="palette-stage"
            className="palette-surface relative overflow-y-auto overflow-x-hidden rounded-xl border border-palette-line bg-palette-base text-palette-contrast shadow-lg"
            style={{ height }}
        >
            {!variant ? (
                <MissingFramework
                    slug={example.project.slug}
                    id={example.id}
                    framework={framework}
                    variants={example.variants}
                    className="m-6"
                />
            ) : live ? (
                <ExampleFrame
                    key={framework}
                    slug={example.project.slug}
                    framework={framework}
                    id={example.id}
                    title={title}
                    theme={theme}
                    scheme={
                        example.themes.find((t) => t.name === theme)?.scheme
                    }
                    layout={variant.layout}
                    height={height}
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
                    onRun={() => claimLive("palette")}
                />
            )}
        </div>
    );
}

// The demo, explained: the colour is one class on a scope, never a variant
function PaletteNote({ example }: { example: FeaturedExample }) {
    const maker = example.id === "palette-maker";
    return (
        <aside
            data-testid="palettes-note"
            aria-label="One class, and the colour changes"
            className="flex min-w-0 flex-col gap-3 text-palette-accent/85 text-sm leading-relaxed"
        >
            <p className="font-semibold text-base text-palette-contrast">
                One class, and the colour changes
            </p>
            {maker ? (
                <p>
                    Pick a hue and add it: it becomes a new palette,{" "}
                    <code>my-palette-1</code>, then <code>my-palette-2</code>.
                    Put it on the button and its ring: the only code that
                    changes is the class.
                </p>
            ) : (
                <p>
                    Styling is one class. Swap the palette class on a scope — a
                    page, a card, one button — and every component inside
                    repaints.
                </p>
            )}
            <p>
                No component has a colour variant. A new colour is a new
                palette: add one, and the whole system reads it.
            </p>
            <pre className="whitespace-pre-wrap rounded-md [overflow-wrap:anywhere] border border-palette-line bg-palette-soft/40 p-3 font-mono text-palette-contrast text-xs">
                <code>{SNIPPETS[maker ? "palette-maker" : "palettes"]}</code>
            </pre>
            <Link
                href={example.gallery}
                className="inline-flex w-fit items-center gap-1 rounded-sm font-medium text-palette-contrast text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring"
            >
                Open in the gallery
                <ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />
            </Link>
        </aside>
    );
}
