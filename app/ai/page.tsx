import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AI_SPACE, firstPageUrl, getDocsSpace } from "@/lib/projects";
import { REDIRECT_METADATA } from "@/lib/seo";

// /ai/: the AI agents space has no landing (lib/projects.ts): it goes to its first page. The
// static export renders this as a redirect page, kept out of the index.
export const metadata: Metadata = REDIRECT_METADATA;

export default function AiSpace() {
    const space = getDocsSpace(AI_SPACE.slug);
    redirect(space ? firstPageUrl(space) : "/");
}
