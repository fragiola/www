import type { ReactNode } from "react";
import { getProjects } from "@/lib/projects";

// /<slug>/create/ (contract v1.6, §5.5) exists for the projects whose project.json declares
// `create`, and for nothing else: another project has no such route (and no link to one).
export const dynamicParams = false;

export function generateStaticParams() {
    return getProjects()
        .filter((project) => project.create)
        .map((project) => ({ project: project.slug }));
}

/**
 * The whole viewport, and nothing scrolls the page: the project's app scrolls inside its frame.
 * No site header or footer: the app draws its own chrome, with its way back to the docs.
 */
export default function CreateLayout({ children }: { children: ReactNode }) {
    return <main className="h-dvh overflow-hidden">{children}</main>;
}
