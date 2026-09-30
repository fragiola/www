import type { Metadata } from "next";
import { docsHref, exampleHref } from "@/lib/contract/links";
import { LIMITS } from "@/lib/contract/types";
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

/**
 * `<head> · <project>`, then ` · Fragiola` when the project's title does not already say it; a
 * suffix is left out when the whole would pass 60 characters (CONTRACT.md §3.6).
 */
export function withProject(head: string, project: string): string {
    const candidates = [
        ...(project.includes(SITE_NAME)
            ? []
            : [`${head} · ${project} · ${SITE_NAME}`]),
        `${head} · ${project}`,
        head,
    ];
    return (
        candidates.find((title) => [...title].length <= LIMITS.title) ?? head
    );
}

/**
 * A page's meta description, as plain text of at most 160 characters: Markdown code marks
 * dropped (`Button` → Button), and a longer text (an example's manifest description, which the
 * contract does not limit) cut at its last sentence that fits, else at a word, with an
 * ellipsis. The page still shows its description whole.
 */
export function metaDescription(text: string): string {
    const { min, max } = LIMITS.description;
    const chars = [...text.replace(/`([^`]*)`/g, "$1").trim()];
    if (chars.length <= max) return chars.join("");
    const head = chars.slice(0, max).join("");
    const sentence = /^.*[.!?](?=\s)/s.exec(head)?.[0];
    if (sentence && [...sentence].length >= min) return sentence;
    const words = chars
        .slice(0, max - 1)
        .join("")
        .replace(/\s+\S*$/, "")
        .replace(/[\s,;:—–-]+$/, "");
    return `${words}…`;
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

export function organizationJsonLd(): Thing[] {
    return [
        {
            "@type": "Organization",
            "@id": ORGANIZATION_ID,
            name: SITE_NAME,
            url: absoluteUrl("/"),
            logo: absoluteUrl("/brand/fragiola-mark-512.png"),
            description: SITE_DESCRIPTION,
            sameAs: [ORGANIZATION_URL],
        },
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

function breadcrumbs(items: { name: string; path?: string }[]): Thing {
    return {
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            ...(item.path ? { item: absoluteUrl(item.path) } : {}),
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
            description,
            url: absoluteUrl(`/${project.slug}/`),
            ...(project.repoUrl ? { codeRepository: project.repoUrl } : {}),
            programmingLanguage: "TypeScript",
            ...(project.keywords?.length
                ? { keywords: project.keywords.join(", ") }
                : {}),
            publisher: { "@id": ORGANIZATION_ID },
        },
        breadcrumbs([home, landingCrumb(project)]),
    ];
}

function sectionCrumb(
    project: Project,
    section: Project["docs"]["sections"][number],
): { name: string; path?: string } {
    const first = section.pages.find((entry) => "path" in entry);
    return {
        name: section.label,
        ...(first && "path" in first
            ? { path: docsHref(project.slug, first.path) }
            : {}),
    };
}

/** A docs page: an article of the project, in its sidebar section. */
export function docsJsonLd(
    project: Project,
    page: { path: string; title: string; description: string },
): Thing[] {
    const url = absoluteUrl(docsHref(project.slug, page.path));
    const section = project.docs.sections.find((s) =>
        s.pages.some((entry) => "path" in entry && entry.path === page.path),
    );
    return [
        {
            "@type": "TechArticle",
            headline: page.title,
            description: page.description,
            url,
            inLanguage: "en",
            isPartOf: { "@id": projectId(project) },
            publisher: { "@id": ORGANIZATION_ID },
        },
        breadcrumbs([
            home,
            landingCrumb(project),
            // a section has no page of its own: its crumb leads to its first page
            ...(section ? [sectionCrumb(project, section)] : []),
            { name: page.title, path: docsHref(project.slug, page.path) },
        ]),
    ];
}

/** An example page: where it sits in the gallery. */
export function exampleJsonLd(
    project: Project,
    example: { id: string; title: string },
    galleryPath: string,
): Thing[] {
    return [
        breadcrumbs([
            home,
            landingCrumb(project),
            { name: "Examples", path: galleryPath },
            {
                name: example.title,
                path: exampleHref(project.slug, example.id),
            },
        ]),
    ];
}
