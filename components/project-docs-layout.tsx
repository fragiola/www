"use client";

import type { Root } from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { docsSidebarComponents } from "@/components/docs-sidebar";
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
//
// Its rows are the site's own (components/docs-sidebar.tsx, the inset style). Its first row is
// the "Documentation" label and the collapse toggle: Fumadocs puts the toggle right after the
// row's content, at the top of the row, so the label takes the free width and centres itself
// on the toggle — the toggle ends the row, level with the label.

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
                    <span
                        data-sidebar-title=""
                        className="me-auto self-center ps-2.5 font-medium text-fd-foreground text-sm"
                    >
                        Documentation
                    </span>
                ),
            }}
            slots={{ navTitle: NoTitle }}
            searchToggle={{ enabled: false }}
            themeSwitch={{ enabled: false }}
            sidebar={{
                components: docsSidebarComponents,
                // inset (app/globals.css, .site-docs): while open, the sidebar is the frame
                // itself, no surface or edge of its own; collapsed, the sidebar that peeks on
                // hover keeps Fumadocs' card
                className:
                    "data-[collapsed=false]:border-e-0 data-[collapsed=false]:bg-transparent",
                ...(frameworks.length > 1
                    ? { banner: <FrameworkSelect frameworks={frameworks} /> }
                    : {}),
            }}
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
