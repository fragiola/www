"use client";

import {
    ArrowRight,
    Code2,
    RotateCcw,
    SquareArrowOutUpRight,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ExampleFrame } from "@/components/example-frame";
import { defaultTheme, useSiteScheme } from "@/components/example-theme";
import { useFramework } from "@/components/framework";
import { cn } from "@/lib/cn";
import { frameworkName } from "@/lib/frameworks";
import type { ExampleVariant, ThemeSummary } from "@/lib/projects";

// the panel (and the code block it renders with) loads when it first opens
const CodePanel = dynamic(
    () => import("@/components/code-panel").then((module) => module.CodePanel),
    { ssr: false },
);

// <Example> in a page (§3.4), in its three variants:
//
//   inline (default)  the embed, a toolbar (reset, code, the gallery) and a toggleable code panel
//   bleed             the embed alone, full width, no chrome (landings)
//   card              a link card to the gallery
//
// The framework is the site's choice unless the page pins one; an example the chosen framework
// does not have says so. The theme is the page's `theme`, else the site scheme's default, and
// follows the site when it changes.

export interface ExampleBlockProps {
    slug: string;
    id: string;
    variants: Record<string, ExampleVariant>;
    themes: Pick<ThemeSummary, "name" | "scheme">[];
    /** `framework` on the tag: this framework only */
    framework?: string;
    theme?: string;
    height?: number;
    variant: "inline" | "bleed" | "card";
}

const toolButton =
    "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-palette-accent/85 outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring aria-expanded:bg-palette-soft aria-expanded:text-palette-contrast";

export function ExampleBlock({
    slug,
    id,
    variants,
    themes,
    framework: pinned,
    theme: fixedTheme,
    height,
    variant: kind,
}: ExampleBlockProps) {
    const chosen = useFramework();
    const framework = pinned ?? chosen;
    const scheme = useSiteScheme();
    const [code, setCode] = useState(false);
    const [resetKey, setResetKey] = useState(0);
    const gallery = `/${slug}/examples/${id}/`;
    const variant = variants[framework];
    const theme =
        fixedTheme ?? (scheme ? defaultTheme(themes, scheme) : undefined);

    if (kind === "card") {
        const shown = variant ?? Object.values(variants)[0];
        return (
            <Link
                href={gallery}
                data-example-link={id}
                className="not-prose my-6 flex flex-col gap-1 rounded-lg border border-palette-line bg-palette-base p-4 text-palette-contrast no-underline transition-colors hover:bg-palette-soft"
            >
                <span className="font-medium">{shown?.title}</span>
                <span className="text-palette-accent/85 text-sm">
                    {shown?.description}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-sm">
                    Open the live example
                    <ArrowRight aria-hidden className="size-3.5" />
                </span>
            </Link>
        );
    }

    if (!variant) {
        const other = Object.keys(variants)[0];
        return (
            <div
                role="status"
                data-testid="missing-framework"
                data-example={id}
                className="not-prose my-6 rounded-lg border border-palette-line border-dashed p-4 text-palette-accent/85 text-sm"
            >
                {`This example is not available for ${frameworkName(framework)} yet.`}{" "}
                {other ? (
                    <Link
                        href={`${gallery}?framework=${other}`}
                        className="underline"
                    >
                        {`See it in ${frameworkName(other)}`}
                    </Link>
                ) : null}
            </div>
        );
    }

    const frame = (
        <ExampleFrame
            key={`${framework}:${resetKey}`}
            slug={slug}
            framework={framework}
            id={id}
            title={variant.title}
            theme={theme}
            layout={variant.layout}
            height={height ?? variant.height}
            lazy
        />
    );

    if (kind === "bleed") {
        return (
            <div
                data-example={id}
                data-variant="bleed"
                className="not-prose palette-surface my-8 overflow-hidden rounded-xl border border-palette-line bg-palette-base"
            >
                {frame}
            </div>
        );
    }

    return (
        <div
            data-example={id}
            data-variant="inline"
            className="not-prose palette-surface my-6 overflow-hidden rounded-lg border border-palette-line bg-palette-base text-palette-contrast"
        >
            {frame}
            <div className="flex items-center gap-1 border-palette-line border-t px-2 py-1">
                <span className="truncate px-1 text-palette-accent/85 text-xs">
                    {variant.title}
                </span>
                <div className="ms-auto flex items-center gap-1">
                    <button
                        type="button"
                        data-testid="reset"
                        className={toolButton}
                        onClick={() => setResetKey((key) => key + 1)}
                    >
                        <RotateCcw aria-hidden className="size-3.5" />
                        Reset
                    </button>
                    <Link
                        href={`${gallery}${pinned ? `?framework=${pinned}` : ""}`}
                        className={toolButton}
                    >
                        <SquareArrowOutUpRight
                            aria-hidden
                            className="size-3.5"
                        />
                        Gallery
                    </Link>
                    <button
                        type="button"
                        data-testid="toggle-code"
                        aria-expanded={code}
                        className={toolButton}
                        onClick={() => setCode((open) => !open)}
                    >
                        <Code2 aria-hidden className="size-3.5" />
                        Code
                    </button>
                </div>
            </div>
            {code ? (
                <section
                    aria-label="Example code"
                    className={cn(
                        "h-[28rem] border-palette-line border-t",
                        "[&_[role=tabpanel]]:max-h-full",
                    )}
                >
                    <CodePanel
                        slug={slug}
                        framework={framework}
                        id={id}
                        setup={variant.setup}
                    />
                </section>
            ) : null}
        </div>
    );
}
