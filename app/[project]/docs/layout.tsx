import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ProjectDocsLayout } from "@/components/project-docs-layout";
import { ProjectFooter } from "@/components/project-footer";
import { SiteHeader } from "@/components/site-header";
import { siteHeader } from "@/lib/layout.shared";
import { getPageTree, getProject } from "@/lib/projects";

export default async function Layout({
    params,
    children,
}: {
    params: Promise<{ project: string }>;
    children: ReactNode;
}) {
    const project = getProject((await params).project);
    if (!project) notFound();
    const trees = Object.fromEntries(
        project.frameworks.map((fw) => [fw, getPageTree(project, fw)]),
    );
    // the site header above Fumadocs' docs grid, which it pushes down the way Fumadocs' own
    // banner does (--fd-banner-height, .site-docs in app/globals.css): the sidebar and the table
    // of contents stick under it
    return (
        <div className="site-docs">
            <SiteHeader {...siteHeader(project.slug)} />
            <ProjectDocsLayout
                project={{
                    slug: project.slug,
                    frameworks: project.frameworks,
                    defaultFramework: project.defaultFramework,
                }}
                trees={trees}
            >
                {children}
                {/* under the page and its table of contents: a fourth row of Fumadocs' docs grid,
                    whose three named rows the sidebar, the header and the page take. Its width
                    must not size the grid: without `contain: inline-size` its min-content width
                    lands in the last (min-content) column and squeezes the page on small
                    screens. */}
                <ProjectFooter
                    project={project}
                    className="[contain:inline-size] [grid-column:3/-1] [grid-row:4]"
                />
            </ProjectDocsLayout>
        </div>
    );
}
