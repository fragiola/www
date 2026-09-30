import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExampleView } from "@/components/gallery/example-view";
import { JsonLd } from "@/components/json-ld";
import { exampleHref } from "@/lib/contract/links";
import {
    firstExampleUrl,
    type GalleryExample,
    getExample,
    getGallery,
    getProject,
    getProjects,
    type Project,
} from "@/lib/projects";
import {
    exampleDescription,
    exampleJsonLd,
    exampleTitle,
    pageMetadata,
} from "@/lib/seo";

// One page per example, inside the gallery's layout (the list and the shell state, which stay
// mounted between examples). The page carries nothing but the id and its structured data: the
// gallery's data is in the layout, the example runs in the project's embed app, and its code is
// fetched when the panel opens.

type Props = { params: Promise<{ project: string; id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
    return getProjects().flatMap((project) =>
        getGallery(project).examples.map((example) => ({
            project: project.slug,
            id: example.id,
        })),
    );
}

export default async function ExamplePage({ params }: Props) {
    const { project: slug, id } = await params;
    const project = getProject(slug);
    const example = project && getExample(project, id);
    const variant = example && defaultVariant(project, example);
    if (!project || !variant) notFound();
    return (
        <>
            <JsonLd
                items={exampleJsonLd(
                    project,
                    { id, title: variant.title },
                    firstExampleUrl(project) ?? exampleHref(slug, id),
                )}
            />
            <ExampleView id={id} />
        </>
    );
}

/** The example as the default framework has it (else the first framework that does). */
function defaultVariant(project: Project, example: GalleryExample) {
    return (
        example.variants[project.defaultFramework] ??
        Object.values(example.variants)[0]
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { project: slug, id } = await params;
    const project = getProject(slug);
    const example = project && getExample(project, id);
    const variant = example && defaultVariant(project, example);
    if (!project || !variant) return {};
    // one URL whatever ?theme=, ?code= or ?framework= say (the canonical has no query)
    return pageMetadata({
        title: exampleTitle(variant.title, project),
        description: exampleDescription(variant.description, project),
        path: exampleHref(slug, id),
        project,
    });
}
