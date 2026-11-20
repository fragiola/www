"use client";

import { useRef } from "react";
import { ExampleFrame } from "@/components/example-frame";
import { defaultTheme, useSiteScheme } from "@/components/example-theme";
import { ProjectProvider, useFramework } from "@/components/framework";
import { MissingFramework } from "@/components/missing-framework";
import type { FeaturedExample } from "@/lib/projects";
import { LivePlaceholder } from "./live-placeholder";
import { claimLive, useLive, useLiveSection } from "./live-slot";

// "One class, one palette" on the organization's landing: Fragiola UI's `palettes` example
// (lib/projects.ts `paletteExample`), alone and full width, at the height its meta declares; the
// section's heading says what it shows. The frame shares the page's one example slot with "See it
// live" (live-slot.ts): it runs while this section is the one in view, or when the reader asks.

const DEFAULT_HEIGHT = 420;

export function PaletteSection({ example }: { example: FeaturedExample }) {
    const region = useRef<HTMLDivElement>(null);
    useLiveSection(region, "palette");
    return (
        <ProjectProvider project={example.project}>
            <div
                ref={region}
                data-testid="palette-section"
                data-example={example.id}
                className="not-prose"
            >
                <PaletteStage example={example} />
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
