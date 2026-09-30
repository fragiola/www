import { shareImage } from "@/components/share-image";
import { SITE_NAME } from "@/lib/seo";

// /og.png, the share image of `/`, written at build time. A route handler rather than Next's
// opengraph-image convention, which exports a file with no extension: a static host serves that
// as application/octet-stream, and link previews want an image. lib/seo.ts points the Open Graph
// and Twitter cards here.
export const dynamic = "force-static";

export function GET() {
    return shareImage({
        title: SITE_NAME,
        description:
            "Headless React components, and a design system when you want one.",
    });
}
