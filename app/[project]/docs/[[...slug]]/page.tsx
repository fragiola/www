import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsSpacePage, docsPageMetadata } from "@/components/docs-space-page";
import { getProject, getProjects, pagePaths } from "@/lib/projects";

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

export default async function Page({ params }: Props) {
    const { project: slug, slug: path = [] } = await params;
    const project = getProject(slug);
    if (!project) notFound();
    return <DocsSpacePage project={project} path={path} />;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { project: slug, slug: path = [] } = await params;
    return docsPageMetadata(getProject(slug), path);
}
