import type { SiteHeaderProps } from "@/components/site-header";
import {
    firstExampleUrl,
    firstPageUrl,
    getProject,
    getProjects,
} from "@/lib/projects";

// What the site header (components/site-header.tsx) shows, computed at build time: every project
// for the Projects menu and, under /<slug>/**, the project's own context (its landing, its docs,
// its gallery and its repository). The header is the same on every page: the organization's
// landing, a project's landing, its docs and its gallery.

const ORGANIZATION_URL = "https://github.com/fragiola";

export function siteHeader(slug?: string): SiteHeaderProps {
    const projects = getProjects().map((project) => ({
        slug: project.slug,
        title: project.title,
        description: project.description,
    }));
    const project = slug ? getProject(slug) : undefined;
    if (!project) return { projects, repoUrl: ORGANIZATION_URL };
    // the gallery's first example, not /<slug>/examples/: that is only a redirect to it
    const examplesUrl = firstExampleUrl(project);
    return {
        projects,
        current: {
            slug: project.slug,
            title: project.title,
            docsUrl: firstPageUrl(project),
            ...(examplesUrl ? { examplesUrl } : {}),
        },
        repoUrl: project.repoUrl ?? ORGANIZATION_URL,
    };
}
