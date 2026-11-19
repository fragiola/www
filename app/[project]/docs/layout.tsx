import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DocsSpaceLayout } from "@/components/docs-space-layout";
import { getProject } from "@/lib/projects";

export default async function Layout({
    params,
    children,
}: {
    params: Promise<{ project: string }>;
    children: ReactNode;
}) {
    const project = getProject((await params).project);
    if (!project) notFound();
    return <DocsSpaceLayout project={project}>{children}</DocsSpaceLayout>;
}
