import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

// /robots.txt, written at build time. Everything may be crawled but the search index (/api/).
// The embed apps are not disallowed: they carry `noindex` (CONTRACT.md §5.1), which a crawler
// only reads when it may fetch them.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: "*", allow: "/", disallow: "/api/" },
        sitemap: absoluteUrl("/sitemap.xml"),
    };
}
