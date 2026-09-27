import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ProjectDocsLayout } from "@/components/project-docs-layout";
import { baseOptions } from "@/lib/layout.shared";
import { getPageTree, getProject, readRepoUrl } from "@/lib/projects";

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
    return (
        <ProjectDocsLayout
            project={{
                slug: project.slug,
                frameworks: project.frameworks,
                defaultFramework: project.defaultFramework,
            }}
            trees={trees}
            options={{ ...baseOptions(), githubUrl: readRepoUrl(project.slug) }}
        >
            {children}
        </ProjectDocsLayout>
    );
}
