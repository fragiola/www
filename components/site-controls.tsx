"use client";

import { useSearchContext } from "fumadocs-ui/contexts/search";
import { Moon, Search, Sun } from "lucide-react";
import NextLink from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// The controls the site header and the docs' chrome share (rule 9): the wordmark (→ /), the
// search button (focus goes back to it when the dialog closes), the theme toggle, the GitHub mark.

export const iconButton =
    "inline-flex size-8 items-center justify-center rounded-md text-palette-accent/85 transition-colors hover:bg-palette-soft hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4";

export function GitHubIcon({ className }: { className?: string }) {
    return (
        <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3" />
        </svg>
    );
}

export function Wordmark() {
    return (
        <NextLink
            href="/"
            className="rounded-md font-semibold text-base text-palette-contrast tracking-tight focus-visible:outline-2 focus-visible:outline-palette-ring"
        >
            Fragiola
        </NextLink>
    );
}

/**
 * The search button. `responsive` (the header): a field from `lg`, an icon below. `field` (the
 * docs sidebar): always the field, full width. `icon` (the docs' small-screen bar): the icon.
 */
export function SearchButton({
    variant = "responsive",
}: {
    variant?: "responsive" | "field" | "icon";
}) {
    const { enabled, open, hotKey, setOpenSearch } = useSearchContext();
    // the dialog gives focus back to nothing when it closes: back to the button that opened it
    const opener = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        if (open || !opener.current) return;
        opener.current.focus();
        opener.current = null;
    }, [open]);
    if (!enabled) return null;
    const openFrom = (event: { currentTarget: HTMLButtonElement }) => {
        opener.current = event.currentTarget;
        setOpenSearch(true);
    };
    return (
        <>
            <button
                type="button"
                data-search-full=""
                onClick={openFrom}
                className={cn(
                    "h-8 items-center gap-2 rounded-md border border-palette-line bg-palette-soft/50 ps-2.5 pe-1.5 text-palette-accent/85 text-sm transition-colors hover:bg-palette-soft hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-palette-ring",
                    variant === "responsive" && "hidden w-52 lg:inline-flex",
                    variant === "field" && "flex w-full",
                    variant === "icon" && "hidden",
                )}
            >
                <Search aria-hidden className="size-4" />
                Search
                <span className="ms-auto inline-flex gap-0.5">
                    {hotKey.map((key, index) => (
                        <kbd
                            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of keys
                            key={index}
                            className="rounded-sm border border-palette-line bg-palette-base px-1.5 font-sans text-xs"
                        >
                            {key.display}
                        </kbd>
                    ))}
                </span>
            </button>
            <button
                type="button"
                data-search=""
                aria-label="Open search"
                onClick={openFrom}
                className={cn(
                    iconButton,
                    variant === "responsive" && "lg:hidden",
                    variant === "field" && "hidden",
                )}
            >
                <Search aria-hidden />
            </button>
        </>
    );
}

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const dark = mounted && resolvedTheme === "dark";
    return (
        <button
            type="button"
            data-theme-toggle=""
            aria-label="Toggle theme"
            onClick={() => setTheme(dark ? "light" : "dark")}
            className={iconButton}
        >
            {/* the theme is known once mounted: no icon flips from the server's guess */}
            {mounted ? (
                dark ? (
                    <Moon aria-hidden />
                ) : (
                    <Sun aria-hidden />
                )
            ) : (
                <span aria-hidden className="size-4" />
            )}
        </button>
    );
}
