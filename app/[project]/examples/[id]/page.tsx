import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExampleView } from "@/components/gallery/example-view";
import {
    getExample,
    getGallery,
    getProject,
    getProjects,
} from "@/lib/projects";

// One page per example, inside the gallery's layout (the list and the shell state, which stay
// mounted between examples). The page carries nothing but the id: the metadata is in the layout,
// the example runs in the project's embed app, and its code is fetched when the panel opens.

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
    if (!project || !getExample(project, id)) notFound();
    return <ExampleView id={id} />;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { project: slug, id } = await params;
    const project = getProject(slug);
    const example = project && getExample(project, id);
    const variant =
        example &&
        (example.variants[project.defaultFramework] ??
            Object.values(example.variants)[0]);
    if (!project || !variant) return {};
    return {
        title: `${variant.title} · ${project.title} examples`,
        description: variant.description,
    };
}
