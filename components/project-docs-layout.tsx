"use client";

import type { Root } from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import type { ReactNode } from "react";
import {
    FrameworkSelect,
    type ProjectFrameworks,
    ProjectProvider,
    useFramework,
} from "@/components/framework";

// A project's docs layout. The sidebar is pre-built once per framework on
// the server (a config.json section can be framework-specific); the
// framework choice, which only the browser knows, picks one.

type Options = Pick<BaseLayoutProps, "nav" | "links" | "githubUrl">;

function Layout({
    trees,
    options,
    frameworks,
    children,
}: {
    trees: Record<string, Root>;
    options: Options;
    frameworks: string[];
    children: ReactNode;
}) {
    const framework = useFramework();
    const tree = trees[framework] ?? Object.values(trees)[0];
    if (!tree) throw new Error("ProjectDocsLayout: no page tree");
    return (
        <DocsLayout
            tree={tree}
            {...options}
            sidebar={{ banner: <FrameworkSelect frameworks={frameworks} /> }}
        >
            {children}
        </DocsLayout>
    );
}

export function ProjectDocsLayout({
    project,
    trees,
    options,
    children,
}: {
    project: ProjectFrameworks;
    trees: Record<string, Root>;
    options: Options;
    children: ReactNode;
}) {
    return (
        <ProjectProvider project={project}>
            <Layout
                trees={trees}
                options={options}
                frameworks={project.frameworks}
            >
                {children}
            </Layout>
        </ProjectProvider>
    );
}
