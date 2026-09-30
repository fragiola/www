import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { firstExampleUrl, getProject } from "@/lib/projects";
import { REDIRECT_METADATA } from "@/lib/seo";

// /<slug>/examples has no page of its own: it opens the first example (§4). A static export
// renders this as a redirect page, kept out of the index.
export const metadata: Metadata = REDIRECT_METADATA;
export default async function GalleryIndex({
    params,
}: {
    params: Promise<{ project: string }>;
}) {
    const project = getProject((await params).project);
    if (!project) notFound();
    redirect(firstExampleUrl(project) ?? `/${project.slug}/`);
}
