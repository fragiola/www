import { notFound, redirect } from "next/navigation";
import { firstExampleUrl, getProject } from "@/lib/projects";

// /<slug>/examples has no page of its own: it opens the first example (§4). A static export
// renders this as a redirect page.
export default async function GalleryIndex({
    params,
}: {
    params: Promise<{ project: string }>;
}) {
    const project = getProject((await params).project);
    if (!project) notFound();
    redirect(firstExampleUrl(project) ?? `/${project.slug}/`);
}
