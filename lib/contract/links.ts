// Links (§3.3). Pages, manifests and sidebar entries link base-free, as if the project were at
// the root; the site serves them under /<slug>. Pure (no Node, no DOM): the validation, the MDX
// components and the gallery all read links through this module, so what is checked is what is
// rendered.
//
//   /docs/guides/tabs#anchor   → /<slug>/docs/guides/tabs/#anchor
//   /examples/add-tabs         → /<slug>/examples/add-tabs/
//   /examples                  → /<slug>/examples/
//   /                          → /<slug>/
//   #anchor                    → #anchor (this page)
//   https://…, mailto:…        → unchanged

/** A link target, classified. */
export type LinkTarget =
    | { kind: "external"; href: string }
    | { kind: "anchor"; hash: string }
    | { kind: "landing"; hash?: string }
    | { kind: "page"; path: string; hash?: string }
    | { kind: "gallery"; hash?: string }
    | { kind: "example"; id: string; hash?: string }
    | { kind: "invalid"; reason: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Classifies a base-free link as written in a page (§3.3). */
export function parseLink(href: string): LinkTarget {
    if (SCHEME.test(href) || href.startsWith("//")) {
        return { kind: "external", href };
    }
    const hashAt = href.indexOf("#");
    const rawPath = hashAt >= 0 ? href.slice(0, hashAt) : href;
    const hash = hashAt >= 0 ? href.slice(hashAt + 1) || undefined : undefined;
    const withHash = <T extends object>(target: T) =>
        hash === undefined ? target : { ...target, hash };
    if (rawPath === "") {
        return hash === undefined
            ? { kind: "invalid", reason: "an empty link" }
            : { kind: "anchor", hash };
    }
    if (rawPath.includes("?")) {
        return {
            kind: "invalid",
            reason: `"${href}" has a query string, which base-free links do not take`,
        };
    }
    if (!rawPath.startsWith("/")) {
        return {
            kind: "invalid",
            reason: `"${href}" is relative: write it base-free, from / (§3.3)`,
        };
    }
    const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
    if (path === "/") return withHash({ kind: "landing" as const });
    if (path === "/examples") return withHash({ kind: "gallery" as const });
    const example = /^\/examples\/([^/]+)$/.exec(path);
    if (example?.[1]) {
        return withHash({ kind: "example" as const, id: example[1] });
    }
    const page = /^\/docs\/(.+)$/.exec(path);
    if (page?.[1] && !page[1].endsWith(".mdx")) {
        return withHash({ kind: "page" as const, path: page[1] });
    }
    return {
        kind: "invalid",
        reason: `"${href}" is not a base-free link to a page (/docs/…), an example (/examples/…) or the landing (/)`,
    };
}

const suffix = (hash: string | undefined) =>
    hash === undefined ? "" : `#${hash}`;

/** Where the site serves a classified link of project `slug`. */
export function targetHref(slug: string, target: LinkTarget): string {
    switch (target.kind) {
        case "external":
            return target.href;
        case "anchor":
            return `#${target.hash}`;
        case "landing":
            return `/${slug}/${suffix(target.hash)}`;
        case "gallery":
            return `/${slug}/examples/${suffix(target.hash)}`;
        case "example":
            return `/${slug}/examples/${target.id}/${suffix(target.hash)}`;
        case "page":
            return `/${slug}/docs/${target.path}/${suffix(target.hash)}`;
        case "invalid":
            return "#";
    }
}

/**
 * The site URL of a base-free link of project `slug`. An invalid link cannot reach the site (the
 * build fails on it first); if it does anyway, it is left as written.
 */
export function siteHref(slug: string, href: string): string {
    const target = parseLink(href);
    return target.kind === "invalid" ? href : targetHref(slug, target);
}

/** Whether a site URL is served by the Next app (client-side navigation) rather than a file. */
export function isAppRoute(href: string): boolean {
    if (!href.startsWith("/") || href.startsWith("//")) return false;
    return !/^\/(r\/|api\/|[^/]+\/(embed|code)\/)/.test(href);
}

/** The docs URL of a page path of project `slug`. */
export function docsHref(slug: string, path: string): string {
    return `/${slug}/docs/${path}/`;
}

/** The gallery URL of an example of project `slug`. */
export function exampleHref(slug: string, id: string): string {
    return `/${slug}/examples/${id}/`;
}

/** The URL of a project's embed app for one example (§5.1). */
export function embedHref(
    slug: string,
    framework: string,
    id: string,
    theme: string,
): string {
    const query = new URLSearchParams({ id, theme });
    return `/${slug}/embed/${framework}/index.html?${query}`;
}
