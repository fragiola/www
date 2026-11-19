import type { ReactNode } from "react";
import { ProjectDocsLayout } from "@/components/project-docs-layout";
import { ProjectFooter } from "@/components/project-footer";
import { ORGANIZATION_URL, siteHeader } from "@/lib/layout.shared";
import { getPageTree, type Project } from "@/lib/projects";

// The docs' layout, for a project (app/[project]/docs/layout.tsx) or a docs space www writes itself
// (app/ai/docs/layout.tsx): the same sidebar, chrome, inset panel and footer, so going from one to
// the other only switches the "project".

export function DocsSpaceLayout({
    project,
    children,
}: {
    project: Project;
    children: ReactNode;
}) {
    const trees = Object.fromEntries(
        project.frameworks.map((fw) => [fw, getPageTree(project, fw)]),
    );
    // no site header in the docs (rule 9): what it shows is the sidebar's (components/docs-chrome)
    const { projects, current, repoUrl } = siteHeader(project.slug);
    if (!current) throw new Error(`no header context for "${project.slug}"`);
    return (
        <div className="site-docs">
            <ProjectDocsLayout
                chrome={{
                    projects,
                    current,
                    repoUrl,
                    organizationUrl: ORGANIZATION_URL,
                }}
                project={{
                    slug: project.slug,
                    frameworks: project.frameworks,
                    defaultFramework: project.defaultFramework,
                }}
                trees={trees}
            >
                {/* the inset panel the page sits on (.docs-inset-panel, app/globals.css): an empty
                    grid item behind the main column, the table of contents and the footer, first
                    in the grid so the page paints over it */}
                <div aria-hidden className="docs-inset-panel" />
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
