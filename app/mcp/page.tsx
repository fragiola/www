import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { REDIRECT_METADATA } from "@/lib/seo";
import { MCP_PATH } from "@/lib/site-paths";

// /mcp/: the page moved into the AI agents docs (MCP_PATH, content/ai/). Old links keep working:
// the static export renders this as a redirect page, kept out of the index.
export const metadata: Metadata = REDIRECT_METADATA;

export default function Moved() {
    redirect(MCP_PATH);
}
