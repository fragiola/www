"use client";

import type { Root } from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import {
    DocsBarControls,
    type DocsChromeProps,
    DocsCorner,
    DocsNavTitle,
    DocsSidebarFooter,
    DocsSidebarTop,
} from "@/components/docs-chrome";
import { docsSidebarComponents } from "@/components/docs-sidebar";
import {
    type ProjectFrameworks,
    ProjectProvider,
    useFramework,
} from "@/components/framework";

// A project's docs layout. The sidebar is pre-built once per framework on the server (a
// config.json section can be framework-specific); the framework choice, which only the browser
// knows, picks one. The framework select shows only for a project with more than one.
//
// The docs have no site header (rule 9): its navigation is the sidebar's, the same for every
// project (components/docs-chrome.tsx): the wordmark and the collapse toggle in the first row,
// the project switcher, search, Docs | Examples and the framework select at the top, the GitHub
// links at the bottom. Below `md` Fumadocs' bar carries the wordmark, search, the theme and the
// drawer's toggle; the drawer has the same top and bottom.
//
// Its rows are the site's own (components/docs-sidebar.tsx, the inset style).

function Layout({
    trees,
    chrome,
    children,
}: {
    trees: Record<string, Root>;
    chrome: DocsChromeProps;
    children: ReactNode;
}) {
    const framework = useFramework();
    const tree = trees[framework] ?? Object.values(trees)[0];
    if (!tree) throw new Error("ProjectDocsLayout: no page tree");
    return (
        <DocsLayout
            tree={tree}
            nav={{ children: <DocsBarControls /> }}
            slots={{ navTitle: DocsNavTitle }}
            // the site's own search button and theme toggle (components/site-controls.tsx):
            // the search gives focus back to the button that opened it
            searchToggle={{ enabled: false }}
            themeSwitch={{ enabled: false }}
            sidebar={{
                components: docsSidebarComponents,
                // inset (app/globals.css, .site-docs): while open, the sidebar is the frame
                // itself, no surface or edge of its own; collapsed, the sidebar that peeks on
                // hover keeps Fumadocs' card
                className:
                    "data-[collapsed=false]:border-e-0 data-[collapsed=false]:bg-transparent",
                banner: <DocsSidebarTop {...chrome} />,
                footer: <DocsSidebarFooter {...chrome} />,
            }}
        >
            <DocsCorner />
            {children}
        </DocsLayout>
    );
}

export function ProjectDocsLayout({
    project,
    trees,
    chrome,
    children,
}: {
    project: ProjectFrameworks;
    trees: Record<string, Root>;
    chrome: Omit<DocsChromeProps, "frameworks">;
    children: ReactNode;
}) {
    return (
        <ProjectProvider project={project}>
            <Layout
                trees={trees}
                chrome={{ ...chrome, frameworks: project.frameworks }}
            >
                {children}
            </Layout>
        </ProjectProvider>
    );
}
