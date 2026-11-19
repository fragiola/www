import type { MetadataRoute } from "next";
import { docsHref, exampleHref } from "@/lib/contract/links";
import { getGallery, getProjects, getSpaces, pagePaths } from "@/lib/projects";
import { absoluteUrl } from "@/lib/seo";

// /sitemap.xml, written at build time: every indexable page and nothing else — `/`, each
// project's landing, every docs page and every example, then the docs spaces' pages (the AI
// agents docs, /ai/docs/**). Not the redirect pages (/<slug>/docs/, /<slug>/examples/, /ai/,
// /mcp/, /skills/), the search index, the registry or the embeds. No lastmod:
// the site does not know when a page's content changed, and a wrong date is worse than none.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
    const paths = [
        "/",
        ...getProjects().flatMap((project) => [
            `/${project.slug}/`,
            ...pagePaths(project)
                .sort()
                .map((path) => docsHref(project.slug, path)),
            ...getGallery(project).examples.map((example) =>
                exampleHref(project.slug, example.id),
            ),
        ]),
        ...getSpaces().flatMap((space) =>
            pagePaths(space)
                .sort()
                .map((path) => docsHref(space.slug, path)),
        ),
    ];
    return paths.map((path) => ({ url: absoluteUrl(path) }));
}
