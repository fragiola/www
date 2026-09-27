import type { ReactNode } from "react";
import { getProjects } from "@/lib/projects";

// Every route under /<slug> (the landing, the docs, the gallery) exists once per project of
// projects.json, and for nothing else.
export const dynamicParams = false;

export function generateStaticParams() {
    return getProjects().map((project) => ({ project: project.slug }));
}

export default function ProjectLayout({ children }: { children: ReactNode }) {
    return children;
}
