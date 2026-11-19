"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { setFramework } from "@/components/framework";
import { FrameworkLogo } from "@/components/framework-logo";
import { frameworkName } from "@/lib/frameworks";

// The adapters row above a landing's showcase (CONTRACT.md §2, v1.5): what the project ships a
// package for, in its order, each with its mark. A framework the docs cover is a link to them that
// picks it first; the rest (the vanilla core, a package without docs yet) is a plain item.

const PILL =
    "inline-flex h-8 items-center gap-2 rounded-lg border border-palette-line bg-palette-soft/40 px-3 font-medium text-palette-contrast text-sm";

export interface AdapterRowProps {
    slug: string;
    adapters: string[];
    /** the frameworks the docs cover (project.json's `frameworks`) */
    frameworks: string[];
}

export function AdapterRow({ slug, adapters, frameworks }: AdapterRowProps) {
    if (adapters.length === 0) return null;
    return (
        <ul
            aria-label="Available for"
            data-testid="adapters"
            className="flex list-none flex-wrap gap-2 p-0"
        >
            {adapters.map((adapter) => {
                const content = (
                    <>
                        <FrameworkLogo name={adapter} />
                        {frameworkName(adapter)}
                    </>
                );
                return (
                    <li key={adapter} data-adapter={adapter}>
                        {frameworks.includes(adapter) ? (
                            <Link
                                href={`/${slug}/docs/`}
                                onClick={() => setFramework(adapter)}
                                aria-label={`${frameworkName(adapter)} docs`}
                                className={`${PILL} outline-none transition-colors hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring`}
                            >
                                {content}
                                <ChevronRight
                                    aria-hidden
                                    className="-me-1 size-3.5 text-palette-accent/85"
                                />
                            </Link>
                        ) : (
                            <span className={PILL}>{content}</span>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
