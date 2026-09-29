"use client";

import type { Root } from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import {
    FrameworkSelect,
    type ProjectFrameworks,
    ProjectProvider,
    useFramework,
} from "@/components/framework";

// A project's docs layout. The sidebar is pre-built once per framework on the server (a
// config.json section can be framework-specific); the framework choice, which only the browser
// knows, picks one. The framework select shows only for a project with more than one.
//
// The site header (components/site-header.tsx, above this layout) carries the project's title,
// its links, search, the theme and GitHub, so the sidebar carries none of them: no title, no
// links, no search field, no theme switch. Below `md` Fumadocs' bar keeps the sidebar's toggle.

const NoTitle = () => null;

function Layout({
    trees,
    frameworks,
    children,
}: {
    trees: Record<string, Root>;
    frameworks: string[];
    children: ReactNode;
}) {
    const framework = useFramework();
    const tree = trees[framework] ?? Object.values(trees)[0];
    if (!tree) throw new Error("ProjectDocsLayout: no page tree");
    return (
        <DocsLayout
            tree={tree}
            nav={{
                children: (
                    <span className="font-medium text-palette-accent/85 text-sm">
                        Documentation
                    </span>
                ),
            }}
            slots={{ navTitle: NoTitle }}
            searchToggle={{ enabled: false }}
            themeSwitch={{ enabled: false }}
            sidebar={
                frameworks.length > 1
                    ? { banner: <FrameworkSelect frameworks={frameworks} /> }
                    : {}
            }
        >
            {children}
        </DocsLayout>
    );
}

export function ProjectDocsLayout({
    project,
    trees,
    children,
}: {
    project: ProjectFrameworks;
    trees: Record<string, Root>;
    children: ReactNode;
}) {
    return (
        <ProjectProvider project={project}>
            <Layout trees={trees} frameworks={project.frameworks}>
                {children}
            </Layout>
        </ProjectProvider>
    );
}
