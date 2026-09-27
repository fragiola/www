import { createFromSource } from "fumadocs-core/search/server";
import { getProjects } from "@/lib/projects";
import { source } from "@/lib/source";

// One index for every project, exported as a file at build time and queried in the browser.
// Each entry is tagged with its project's slug and breadcrumbed with the project's title and the
// config.json section. A project's landing (docs/index.mdx) is indexed at /<slug>/.
export const revalidate = false;

const projects = getProjects();

export const { staticGET: GET } = createFromSource(source, {
    buildIndex(page) {
        const [slug = "", , ...path] = page.slugs;
        const project = projects.find((p) => p.slug === slug);
        const section = project?.docs.sections.find((s) =>
            s.pages.some((p) => "path" in p && p.path === path.join("/")),
        );
        const url = path.length === 0 ? `/${slug}/` : `${page.url}/`;
        return {
            id: url,
            url,
            title: page.data.title ?? path.join("/"),
            description: page.data.description,
            structuredData: page.data.structuredData,
            tag: slug,
            breadcrumbs: [project?.title ?? slug, section?.label].filter(
                (crumb): crumb is string => Boolean(crumb),
            ),
        };
    },
});
