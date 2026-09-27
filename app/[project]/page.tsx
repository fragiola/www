import { DocsBody } from "fumadocs-ui/layouts/docs/page";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectProvider } from "@/components/framework";
import { getMDXComponents } from "@/components/mdx";
import { baseOptions, projectLinks } from "@/lib/layout.shared";
import { getProject } from "@/lib/projects";
import { source } from "@/lib/source";

// /<slug>: the project's landing (§3.5), its docs/index.mdx in the vocabulary (typically a
// <Hero> and an <Example variant="bleed">). The project owns the content; the site the layout.

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
    const base = baseOptions();
    return (
        <HomeLayout
            {...base}
            links={[...projectLinks(project), ...(base.links ?? [])]}
            githubUrl={project.repoUrl}
        >
            <ProjectProvider
                project={{
                    slug: project.slug,
                    frameworks: project.frameworks,
                    defaultFramework: project.defaultFramework,
                }}
            >
                <main
                    data-testid="landing"
                    className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6"
                >
                    <DocsBody className="max-w-none">
                        <MDX components={getMDXComponents(slug)} />
                    </DocsBody>
                </main>
            </ProjectProvider>
        </HomeLayout>
    );
}
