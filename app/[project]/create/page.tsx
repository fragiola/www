import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateFrame } from "@/components/create-frame";
import { JsonLd } from "@/components/json-ld";
import { createHref } from "@/lib/contract/links";
import { getProject, themeSummaries } from "@/lib/projects";
import { createJsonLd, createTitle, pageMetadata } from "@/lib/seo";

// A project's Create page (v1.6, §5.5): its full-page tool, `embed/<framework>/create.html`, in
// one frame at 100% × 100%. The page carries the frame's props and its structured data, nothing
// else; its title, description and canonical URL come from lib/seo.ts.

type Props = { params: Promise<{ project: string }> };

export default async function CreatePage({ params }: Props) {
    const project = getProject((await params).project);
    const create = project?.create;
    if (!project || !create) notFound();
    return (
        <>
            <JsonLd items={createJsonLd(project, create)} />
            {/* the page's one h1, for readers of its static HTML: the app's is in its frame */}
            <h1 className="sr-only">{create.title}</h1>
            <CreateFrame
                slug={project.slug}
                framework={create.framework}
                title={createTitle(create, project)}
                themes={themeSummaries(project).map(({ name, scheme }) => ({
                    name,
                    scheme,
                }))}
            />
        </>
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const project = getProject((await params).project);
    const create = project?.create;
    if (!project || !create) return {};
    return pageMetadata({
        title: createTitle(create, project),
        description: create.description,
        path: createHref(project.slug),
        project,
    });
}
