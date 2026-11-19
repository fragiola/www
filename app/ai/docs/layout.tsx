import type { ReactNode } from "react";
import { DocsSpaceLayout } from "@/components/docs-space-layout";
import { AI_SPACE, getDocsSpace } from "@/lib/projects";

// /ai/docs/**: the AI agents space (content/ai/, lib/projects.ts), in the docs' own layout. A
// static segment, so it is not one of app/[project]'s: no landing, no gallery.

export default function Layout({ children }: { children: ReactNode }) {
    const space = getDocsSpace(AI_SPACE.slug);
    if (!space) throw new Error("content/ai is missing");
    return <DocsSpaceLayout project={space}>{children}</DocsSpaceLayout>;
}
