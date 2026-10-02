import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { GalleryChrome } from "@/components/gallery/gallery-chrome";
import { siteHeader } from "@/lib/layout.shared";
import { getGallery, getProject } from "@/lib/projects";
import { examplesListScript } from "@/lib/storage";

// The gallery's chrome (the site header, the list, the shell state) is a layout: on navigation
// between examples it stays mounted, so the list keeps its scroll and its filter (§4). The script
// before it marks a list the reader collapsed, so the static page paints it collapsed
// (lib/storage.ts); React never runs a script it renders, so only a full load sees it.
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
        <>
            <script
                // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of lib/storage.ts, no input
                dangerouslySetInnerHTML={{ __html: examplesListScript() }}
            />
            <GalleryChrome
                gallery={getGallery(project)}
                header={siteHeader(project.slug)}
            >
                {children}
            </GalleryChrome>
        </>
    );
}
