import type { SiteHeaderProps } from "@/components/site-header";
import { createHref } from "@/lib/contract/links";
import {
    firstExampleUrl,
    firstPageUrl,
    getDocsSpace,
    getProjects,
} from "@/lib/projects";

// What the site header (components/site-header.tsx) and the docs' chrome (the sidebar's top and
// footer, components/docs-chrome.tsx) show, computed at build time: every project for the Projects
// menu and the project switcher and, under /<slug>/**, the project's own context (its landing,
// its docs, its gallery, its Create page when it declares one (v1.6) and its repository). Rule 9: the header on the landings and the gallery,
// the same navigation in the docs' sidebar.

export const ORGANIZATION_URL = "https://github.com/fragiola";

export function siteHeader(slug?: string): SiteHeaderProps {
    const projects = getProjects().map((project) => ({
        slug: project.slug,
        title: project.title,
        description: project.description,
        docsUrl: firstPageUrl(project),
    }));
    // a project, or a docs space (the AI agents docs): a space has no gallery
    const project = slug ? getDocsSpace(slug) : undefined;
    if (!project) return { projects, repoUrl: ORGANIZATION_URL };
    // the gallery's first example, not /<slug>/examples/: that is only a redirect to it
    const examplesUrl = project.space ? undefined : firstExampleUrl(project);
    const createUrl = project.create ? createHref(project.slug) : undefined;
    return {
        projects,
        current: {
            slug: project.slug,
            title: project.title,
            docsUrl: firstPageUrl(project),
            ...(examplesUrl ? { examplesUrl } : {}),
            ...(createUrl ? { createUrl } : {}),
        },
        repoUrl: project.repoUrl ?? ORGANIZATION_URL,
    };
}
