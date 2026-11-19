import { loader, multiple } from "fumadocs-core/source";
import { docs, spaces } from "@/.source/server";

// Every project's pages, and the docs spaces www writes itself (content/, the AI agents space),
// in one source: the slugs are
// [<slug>, "docs", …<path>], the URLs /<slug>/docs/<path>/. One source keeps
// the search index unified; each project's sidebar is built separately
// (lib/projects.ts).
export const source = loader({
    source: multiple({
        projects: docs.toFumadocsSource(),
        spaces: spaces.toFumadocsSource(),
    }),
    baseUrl: "/",
});
