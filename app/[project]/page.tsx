import { DocsBody } from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectProvider } from "@/components/framework";
import { getMDXComponents } from "@/components/mdx";
import { ProjectFooter } from "@/components/project-footer";
import { SiteHeader } from "@/components/site-header";
import { siteHeader } from "@/lib/layout.shared";
import { getProject } from "@/lib/projects";
import { source } from "@/lib/source";

// /<slug>: the project's landing (§3.5), its docs/index.mdx in the vocabulary (typically a
// <Hero>, an <Example variant="showcase"> and <Section>s), then the project's footer. The
// project owns the content; the site the look of each piece. The page is full width: Hero and
// Section are bands that centre their own content, everything else takes the landing's column
// (.landing in app/globals.css).

type Props = { params: Promise<{ project: string }> };

function getLanding(slug: string) {
    return source.getPage([slug, "docs"]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { project: slug } = await params;
    const project = getProject(slug);
    const page = getLanding(slug);
    if (!project) return {};
    return {
        title: { absolute: `${project.title} · Fragiola` },
        description: page?.data.description ?? project.description,
    };
}

export default async function ProjectLanding({ params }: Props) {
    const { project: slug } = await params;
    const project = getProject(slug);
    const page = getLanding(slug);
    if (!project || !page) notFound();
    const MDX = page.data.body;
    return (
        <>
            <SiteHeader {...siteHeader(slug)} />
            <ProjectProvider
                project={{
                    slug: project.slug,
                    frameworks: project.frameworks,
                    defaultFramework: project.defaultFramework,
                }}
            >
                <main data-testid="landing" className="flex flex-1 flex-col">
                    <DocsBody className="landing max-w-none pb-24">
                        <MDX components={getMDXComponents(slug)} />
                    </DocsBody>
                </main>
                <ProjectFooter project={project} />
            </ProjectProvider>
        </>
    );
}
