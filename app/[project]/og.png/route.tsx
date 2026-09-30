import { shareImage } from "@/components/share-image";
import { getProject, getProjects } from "@/lib/projects";
import { SITE_NAME } from "@/lib/seo";

// /<slug>/og.png, one share image per project, written at build time from project.json's title
// and description: its landing's, and its docs' and examples' (lib/seo.ts). A route handler,
// for the .png extension (app/og.png/route.tsx).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
    return getProjects().map((project) => ({ project: project.slug }));
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ project: string }> },
) {
    const project = getProject((await params).project);
    if (!project) return new Response(null, { status: 404 });
    return shareImage({
        title: project.title,
        description: project.description,
        eyebrow: SITE_NAME,
    });
}
