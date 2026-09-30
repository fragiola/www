import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { getMDXComponents } from "@/components/mdx";
import { docsHref } from "@/lib/contract/links";
import {
    firstPageUrl,
    getProject,
    getProjects,
    pagePaths,
} from "@/lib/projects";
import {
    docsJsonLd,
    docsTitle,
    pageMetadata,
    REDIRECT_METADATA,
} from "@/lib/seo";
import { source } from "@/lib/source";

type Props = { params: Promise<{ project: string; slug?: string[] }> };

export const dynamicParams = false;

export function generateStaticParams() {
    return getProjects().flatMap((project) => [
        // /<slug>/docs/ has no page of its own: it redirects to the first one
        { project: project.slug, slug: [] },
        ...pagePaths(project).map((path) => ({
            project: project.slug,
            slug: path.split("/"),
        })),
    ]);
}

function getPage(project: string, slug: string[]) {
    return source.getPage([project, "docs", ...slug]);
}

export default async function Page({ params }: Props) {
    const { project: slug, slug: path = [] } = await params;
    const project = getProject(slug);
    if (!project) notFound();
    if (path.length === 0) redirect(firstPageUrl(project));
    const page = getPage(slug, path);
    if (!page) notFound();
    const MDX = page.data.body;

    return (
        <DocsPage toc={page.data.toc} full={page.data.full}>
            <JsonLd
                items={docsJsonLd(project, {
                    path: path.join("/"),
                    title: page.data.title,
                    description: page.data.description ?? "",
                })}
            />
            <DocsTitle>{page.data.title}</DocsTitle>
            <DocsDescription>{page.data.description}</DocsDescription>
            <DocsBody>
                <MDX components={getMDXComponents(slug)} />
            </DocsBody>
        </DocsPage>
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { project: slug, slug: path = [] } = await params;
    const project = getProject(slug);
    // /<slug>/docs/ only redirects to the first page: kept out of the index
    if (path.length === 0) return REDIRECT_METADATA;
    const page = getPage(slug, path);
    if (!project || !page) return {};
    return pageMetadata({
        title: docsTitle(page.data.title, project),
        description: page.data.description ?? "",
        path: docsHref(slug, path.join("/")),
        type: "article",
        project,
    });
}
