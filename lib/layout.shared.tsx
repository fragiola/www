import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import {
    firstExampleUrl,
    firstPageUrl,
    getProjects,
    type Project,
} from "@/lib/projects";

// The header every layout shares: the wordmark (the organization's landing) and one link per
// project (its landing). Next links: moving between projects is client-side.

export function baseOptions(): Pick<BaseLayoutProps, "nav" | "links"> {
    return {
        nav: { title: "Fragiola", url: "/" },
        links: getProjects().map((project) => ({
            text: project.title,
            url: `/${project.slug}/`,
            active: "nested-url" as const,
        })),
    };
}

/** A project's own links: its docs and its gallery. */
export function projectLinks(
    project: Project,
): NonNullable<BaseLayoutProps["links"]> {
    const examples = firstExampleUrl(project);
    return [
        { text: "Docs", url: firstPageUrl(project), active: "none" as const },
        ...(examples
            ? [
                  {
                      text: "Examples",
                      url: `/${project.slug}/examples/`,
                      active: "none" as const,
                  },
              ]
            : []),
    ];
}
