import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { remarkFeatureHeadings } from "./lib/feature-headings.ts";

// One collection over every project's export: .sources/<slug>/docs/**/*.mdx (or
// $FRAGIOLA_SOURCES/<slug>/…: .sources-fixtures/ for the tests' build, scripts/build.ts).
// A new project in projects.json needs no change here. The page's path
// inside the collection is `<slug>/docs/<path>`, which is also its URL.
//
// No meta files: the sidebar comes from each export's docs/config.json
// (lib/projects.ts), not from fumadocs' meta.json convention.
export const docs = defineDocs({
    dir: process.env.FRAGIOLA_SOURCES ?? ".sources",
    docs: { files: ["*/docs/**/*.mdx"] },
    meta: { files: ["*/docs/**/meta.json"] },
});

export default defineConfig({
    mdxOptions: {
        providerImportSource: "@/components/mdx",
        remarkPlugins: [remarkFeatureHeadings],
    },
});
