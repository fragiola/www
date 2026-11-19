import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { REDIRECT_METADATA } from "@/lib/seo";
import { SKILLS_PATH } from "@/lib/site-paths";

// /skills/: the page moved into the AI agents docs (SKILLS_PATH, content/ai/). Old links keep working:
// the static export renders this as a redirect page, kept out of the index.
export const metadata: Metadata = REDIRECT_METADATA;

export default function Moved() {
    redirect(SKILLS_PATH);
}
