import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

// /manifest.webmanifest, written at build time. The icons are drawn by `pnpm brand:icons`.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: SITE_NAME,
        short_name: SITE_NAME,
        description: SITE_DESCRIPTION,
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: BRAND.surfaceDark,
        theme_color: BRAND.surfaceDark,
        icons: [
            {
                src: "/brand/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/brand/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/brand/icon-maskable-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
