import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ProjectDocsLayout } from "@/components/project-docs-layout";
import { ProjectFooter } from "@/components/project-footer";
import { baseOptions, projectLinks } from "@/lib/layout.shared";
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
    const base = baseOptions();
    return (
        <ProjectDocsLayout
            project={{
                slug: project.slug,
                frameworks: project.frameworks,
                defaultFramework: project.defaultFramework,
            }}
            trees={trees}
            options={{
                nav: {
                    ...base.nav,
                    title: project.title,
                    url: `/${project.slug}/`,
                },
                links: [...projectLinks(project), ...(base.links ?? [])],
                githubUrl: project.repoUrl,
            }}
        >
            {children}
            {/* under the page and its table of contents: a fourth row of Fumadocs' docs grid,
                whose three named rows the sidebar, the header and the page take */}
            <ProjectFooter
                project={project}
                className="[grid-column:3/-1] [grid-row:4]"
            />
        </ProjectDocsLayout>
    );
}
