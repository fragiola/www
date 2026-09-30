import type { Metadata } from "next";
import { docsHref, exampleHref } from "@/lib/contract/links";
import { LIMITS, plainText } from "@/lib/contract/types";
import { ORGANIZATION_URL } from "@/lib/layout.shared";
import type { Project } from "@/lib/projects";

// What search engines and link previews read, built in one place (AGENTS.md, "Search and
// sharing"): the titles, the canonical URLs, the Open Graph and Twitter cards and the JSON-LD.
// Pages call these builders; nothing else writes them. What a project's export provides for it,
// and what www derives, is CONTRACT.md §3.6.

/** The site's domain (README.md): canonical URLs, the sitemap and the structured data. */
export const SITE_URL = "https://fragiola.com";
export const SITE_NAME = "Fragiola";
/** The `<title>` of `/`, written for search. */
export const SITE_TITLE =
    "Fragiola — headless React components and a design system";
/** The meta description of `/`, and the manifest's description. */
export const SITE_DESCRIPTION =
    "Fragiola: headless React components that own behaviour, state and accessibility, and Fragiola UI, an optional design system of copy-paste components.";

/** The share images' size (next/og, app/**\/og.png/route.tsx). */
export const SHARE_IMAGE = { width: 1200, height: 630 } as const;

/** An absolute URL of the site, from a site path (`/ui/docs/tabs/`). */
export function absoluteUrl(path: string): string {
    return new URL(path, SITE_URL).toString();
}

/** A page's canonical path: its own, with the trailing slash and without a query or a hash. */
function canonicalPath(path: string): string {
    const bare = path.replace(/[?#].*$/, "");
    return bare.endsWith("/") ? bare : `${bare}/`;
}

/** The share image of `/`, or of a project (its docs and examples use it too): app/**\/og.png. */
export function shareImagePath(slug?: string): string {
    return slug ? `/${slug}/og.png` : "/og.png";
}

/** A text cut to `max` characters with an ellipsis, when it is longer. */
function cut(text: string, max: number): string {
    const chars = [...text];
    return chars.length <= max
        ? text
        : `${chars
              .slice(0, max - 1)
              .join("")
              .trimEnd()}…`;
}

/**
 * `<head> · <project>`, then ` · Fragiola` when the project's title does not already say it; a
 * suffix is left out when the whole would pass 60 characters (CONTRACT.md §3.6), and a head
 * longer than 60 on its own (an example's title, which the contract does not limit) is cut.
 */
export function withProject(head: string, project: string): string {
    const candidates = [
        ...(project.includes(SITE_NAME)
            ? []
            : [`${head} · ${project} · ${SITE_NAME}`]),
        `${head} · ${project}`,
    ];
    return (
        candidates.find((title) => [...title].length <= LIMITS.title) ??
        cut(head, LIMITS.title)
    );
}

/**
 * A page's meta description, as plain text of at most 160 characters: Markdown code marks
 * dropped (`Button` → Button), and a longer text (an example's manifest description, which the
 * contract does not limit) cut at its last sentence that fits, else at a word, else anywhere,
 * never under 50 characters. The page still shows its description whole.
 */
export function metaDescription(text: string): string {
    const { min, max } = LIMITS.description;
    const plain = plainText(text).trim();
    const chars = [...plain];
    if (chars.length <= max) return plain;
    // a sentence may end right at the limit: what follows it decides
    const head = chars.slice(0, max).join("");
    const after = /\s/.test(chars[max] ?? "") ? " " : "x";
    const sentence = /^.*[.!?](?=\s)/s.exec(head + after)?.[0];
    if (sentence && [...sentence].length >= min) return sentence;
    const words = chars
        .slice(0, max - 1)
        .join("")
        .replace(/\s+\S*$/, "")
        .replace(/[\s,;:—–-]+$/, "");
    return [...words].length + 1 >= min ? `${words}…` : cut(plain, max);
}

/**
 * An example's meta description: its manifest description, which the contract does not limit,
 * followed by what the page is when it is too short to stand alone in a search result.
 */
export function exampleDescription(text: string, project: Project): string {
    const plain = plainText(text).trim();
    return [...plain].length >= LIMITS.description.min
        ? plain
        : `${plain} A live ${project.title} example in the Fragiola gallery, with its source code.`.trim();
}

export const docsTitle = (page: string, project: Project) =>
    withProject(page, project.title);

export const exampleTitle = (example: string, project: Project) =>
    withProject(example, `${project.title} examples`);

/**
 * A page's metadata: its title as is, its description, its canonical URL, and the Open Graph and
 * Twitter cards with its project's share image (or the site's).
 */
export function pageMetadata({
    title,
    description,
    path,
    type = "website",
    project,
}: {
    title: string;
    description: string;
    /** the page's site path; its canonical URL drops any query */
    path: string;
    type?: "website" | "article";
    project?: Project;
}): Metadata {
    const url = absoluteUrl(canonicalPath(path));
    const text = metaDescription(description);
    const image = {
        url: absoluteUrl(shareImagePath(project?.slug)),
        ...SHARE_IMAGE,
        alt: project ? `${project.title}. ${project.description}` : SITE_TITLE,
    };
    return {
        title: { absolute: title },
        description: text,
        alternates: { canonical: url },
        openGraph: {
            siteName: SITE_NAME,
            title,
            description: text,
            url,
            type,
            locale: "en_US",
            images: [image],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description: text,
            images: [image],
        },
    };
}

/** What a redirect page (`/<slug>/docs/`, `/<slug>/examples/`) says to search engines. */
export const REDIRECT_METADATA: Metadata = {
    robots: { index: false, follow: true },
};

// ─── structured data (JSON-LD, components/json-ld.tsx) ───────────────────────

type Thing = Record<string, unknown>;

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const projectId = (project: Project) =>
    `${absoluteUrl(`/${project.slug}/`)}#software`;

/**
 * The organization, in every page's graph: the pages that name it as their publisher are read
 * one at a time, so each carries it whole rather than a reference to `/`.
 */
const organization = (): Thing => ({
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/fragiola-mark-512.png"),
    description: SITE_DESCRIPTION,
    sameAs: [ORGANIZATION_URL],
});

/** The project a docs page belongs to, as its `isPartOf`. */
const projectRef = (project: Project): Thing => ({
    "@type": "SoftwareSourceCode",
    "@id": projectId(project),
    name: project.title,
    url: absoluteUrl(`/${project.slug}/`),
});

export function organizationJsonLd(): Thing[] {
    return [
        organization(),
        {
            "@type": "WebSite",
            "@id": WEBSITE_ID,
            name: SITE_NAME,
            url: absoluteUrl("/"),
            description: SITE_DESCRIPTION,
            inLanguage: "en",
            publisher: { "@id": ORGANIZATION_ID },
        },
    ];
}

function breadcrumbs(items: { name: string; path: string }[]): Thing {
    return {
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.path),
        })),
    };
}

const home = { name: SITE_NAME, path: "/" };
const landingCrumb = (project: Project) => ({
    name: project.title,
    path: `/${project.slug}/`,
});

/** A project's landing: the software, and where it sits. */
export function projectJsonLd(project: Project, description: string): Thing[] {
    return [
        {
            "@type": "SoftwareSourceCode",
            "@id": projectId(project),
            name: project.title,
            description: plainText(description),
            url: absoluteUrl(`/${project.slug}/`),
            ...(project.repoUrl ? { codeRepository: project.repoUrl } : {}),
            programmingLanguage: "TypeScript",
            ...(project.keywords?.length
                ? { keywords: project.keywords.join(", ") }
                : {}),
            publisher: { "@id": ORGANIZATION_ID },
        },
        breadcrumbs([home, landingCrumb(project)]),
        organization(),
    ];
}

/** A sidebar section's crumb: it has no page of its own, so it leads to its first page. */
function sectionCrumb(
    project: Project,
    section: Project["docs"]["sections"][number],
): { name: string; path: string } | undefined {
    for (const entry of section.pages) {
        if ("path" in entry) {
            return {
                name: section.label,
                path: docsHref(project.slug, entry.path),
            };
        }
    }
    return undefined;
}

/** A docs page: an article of the project, in its sidebar section. */
export function docsJsonLd(
    project: Project,
    page: { path: string; title: string; description: string },
): Thing[] {
    const path = docsHref(project.slug, page.path);
    const section = project.docs.sections.find((s) =>
        s.pages.some((entry) => "path" in entry && entry.path === page.path),
    );
    // the section's crumb is left out on its first page, where it would lead to the page itself
    const sectionItem = section && sectionCrumb(project, section);
    return [
        {
            "@type": "TechArticle",
            headline: page.title,
            description: plainText(page.description),
            url: absoluteUrl(path),
            inLanguage: "en",
            isPartOf: projectRef(project),
            publisher: { "@id": ORGANIZATION_ID },
        },
        breadcrumbs([
            home,
            landingCrumb(project),
            ...(sectionItem && sectionItem.path !== path ? [sectionItem] : []),
            { name: page.title, path },
        ]),
        organization(),
    ];
}

/** An example page: where it sits in the gallery. */
export function exampleJsonLd(
    project: Project,
    example: { id: string; title: string },
    galleryPath: string,
): Thing[] {
    const path = exampleHref(project.slug, example.id);
    return [
        breadcrumbs([
            home,
            landingCrumb(project),
            // the gallery opens on its first example: no crumb to the page itself
            ...(galleryPath !== path
                ? [{ name: "Examples", path: galleryPath }]
                : []),
            { name: example.title, path },
        ]),
        organization(),
    ];
}
