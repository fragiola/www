import { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocsPageHeader } from "@/components/docs-page-header";
import { JsonLd } from "@/components/json-ld";
import { getMDXComponents } from "@/components/mdx";
import { docsHref } from "@/lib/contract/links";
import { firstPageUrl, type Project, pageSection } from "@/lib/projects";
import {
    docsJsonLd,
    docsTitle,
    pageMetadata,
    REDIRECT_METADATA,
} from "@/lib/seo";
import { source } from "@/lib/source";

// A docs page, for a project (app/[project]/docs/[[...slug]]) or a docs space
// (app/ai/docs/[[...slug]]). /<slug>/docs/ has no page of its own: it redirects to the first one.

function getPage(project: Project, path: string[]) {
    return source.getPage([project.slug, "docs", ...path]);
}

export function DocsSpacePage({
    project,
    path,
}: {
    project: Project;
    path: string[];
}) {
    if (path.length === 0) redirect(firstPageUrl(project));
    const page = getPage(project, path);
    if (!page) notFound();
    const MDX = page.data.body;

    return (
        // the page's own header names its section (DocsPageHeader), so no breadcrumb; the table of
        // contents draws the path of the headings read so far (Fumadocs' "clerk" style); the
        // previous and next pages follow the selected framework's sidebar (the layout's tree)
        <DocsPage
            toc={page.data.toc}
            full={page.data.full}
            breadcrumb={{ enabled: false }}
            tableOfContent={{ style: "clerk" }}
            tableOfContentPopover={{ style: "clerk" }}
            footer={{ className: "docs-page-footer" }}
            className="docs-page"
        >
            <JsonLd
                items={docsJsonLd(project, {
                    path: path.join("/"),
                    title: page.data.title,
                    description: page.data.description ?? "",
                })}
            />
            <DocsPageHeader
                section={pageSection(project, path.join("/"))}
                title={page.data.title}
                description={page.data.description}
            />
            <DocsBody className="docs-body">
                <MDX components={getMDXComponents(project.slug)} />
            </DocsBody>
        </DocsPage>
    );
}

export function docsPageMetadata(
    project: Project | undefined,
    path: string[],
): Metadata {
    // /<slug>/docs/ only redirects to the first page: kept out of the index
    if (path.length === 0) return REDIRECT_METADATA;
    if (!project) return {};
    const page = getPage(project, path);
    if (!page) return {};
    return pageMetadata({
        title: docsTitle(page.data.title, project),
        description: page.data.description ?? "",
        path: docsHref(project.slug, path.join("/")),
        type: "article",
        project,
    });
}
