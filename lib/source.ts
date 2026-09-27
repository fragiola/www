import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";

// Every project's pages in one source: the slugs are
// [<slug>, "docs", …<path>], the URLs /<slug>/docs/<path>/. One source keeps
// the search index unified; each project's sidebar is built separately
// (lib/projects.ts).
export const source = loader({
    source: docs.toFumadocsSource(),
    baseUrl: "/",
});
