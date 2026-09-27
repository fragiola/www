"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import type { ThemeSummary } from "@/lib/projects";

// The example theme when none is chosen: the site resolves its own theme (including "system")
// and passes the first example theme of that scheme (§4, §5.1). Before hydration the scheme is
// unknown: `undefined`, and a frame waits for it rather than loading the wrong theme.

const subscribeNothing = () => () => {};

/** The site's resolved scheme, once mounted. */
export function useSiteScheme(): "light" | "dark" | undefined {
    const { resolvedTheme } = useTheme();
    const mounted = useSyncExternalStore(
        subscribeNothing,
        () => true,
        () => false,
    );
    if (!mounted || !resolvedTheme) return undefined;
    return resolvedTheme === "dark" ? "dark" : "light";
}

/** The first theme of a scheme: that scheme's default (§4). */
export function defaultTheme(
    themes: Pick<ThemeSummary, "name" | "scheme">[],
    scheme: "light" | "dark",
): string {
    return (
        themes.find((theme) => theme.scheme === scheme)?.name ??
        themes[0]?.name ??
        scheme
    );
}
