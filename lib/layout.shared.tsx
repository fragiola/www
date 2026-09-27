import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { firstPageUrl, getProjects } from "@/lib/projects";

// The header every layout shares: the wordmark and one link per project.
// The links are Next links, so moving between projects is client-side.

export function baseOptions(): Pick<BaseLayoutProps, "nav" | "links"> {
    return {
        nav: { title: "Fragiola", url: "/" },
        links: getProjects().map((project) => ({
            text: project.title,
            url: firstPageUrl(project),
        })),
    };
}
