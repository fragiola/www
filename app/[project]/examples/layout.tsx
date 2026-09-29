import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { GalleryChrome } from "@/components/gallery/gallery-chrome";
import { siteHeader } from "@/lib/layout.shared";
import { getGallery, getProject } from "@/lib/projects";

// The gallery's chrome (the site header, the list, the shell state) is a layout: on navigation
// between examples it stays mounted, so the list keeps its scroll and its filter (§4).
export default async function GalleryLayout({
    params,
    children,
}: {
    params: Promise<{ project: string }>;
    children: ReactNode;
}) {
    const project = getProject((await params).project);
    if (!project) notFound();
    return (
        <GalleryChrome
            gallery={getGallery(project)}
            header={siteHeader(project.slug)}
        >
            {children}
        </GalleryChrome>
    );
}
