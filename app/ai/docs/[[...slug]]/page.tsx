import type { Metadata } from "next";
import { DocsSpacePage, docsPageMetadata } from "@/components/docs-space-page";
import { AI_SPACE, getDocsSpace, pagePaths } from "@/lib/projects";

type Props = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;

const space = () => {
    const found = getDocsSpace(AI_SPACE.slug);
    if (!found) throw new Error("content/ai is missing");
    return found;
};

export function generateStaticParams() {
    return [
        // /ai/docs/ has no page of its own: it redirects to the first one
        { slug: [] },
        ...pagePaths(space()).map((path) => ({ slug: path.split("/") })),
    ];
}

export default async function Page({ params }: Props) {
    const { slug: path = [] } = await params;
    return <DocsSpacePage project={space()} path={path} />;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug: path = [] } = await params;
    return docsPageMetadata(space(), path);
}
