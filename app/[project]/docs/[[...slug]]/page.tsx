import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import {
    firstPageUrl,
    getProject,
    getProjects,
    pagePaths,
} from "@/lib/projects";
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
    const page = path.length > 0 ? getPage(slug, path) : undefined;
    if (!project || !page) return {};
    return {
        title: `${page.data.title} · ${project.title}`,
        description: page.data.description,
    };
}
