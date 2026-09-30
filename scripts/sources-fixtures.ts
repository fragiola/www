// `pnpm sources:fixtures`
//
// Fills .sources-fixtures/ from fixtures/: one minimal v1.2 export per project of projects.json
// (fixtures/README.md). The tests build the site from them (`pnpm e2e:build`), so they run
// without the projects' repos and against content they control. A folder of its own: the
// projects' exports in .sources/ are never overwritten, and `pnpm build` never publishes these.

import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { CONTRACT_REVISION } from "../lib/contract/types.ts";
import { validateAll } from "../lib/contract/validate.ts";
import {
    FIXTURE_SOURCES,
    label,
    ROOT,
    readProjects,
    writeOrigin,
} from "./projects.ts";

const FIXTURES = join(ROOT, "fixtures");

const projects = readProjects();
const missing = projects.filter(
    ({ slug }) => !existsSync(join(FIXTURES, slug, "project.json")),
);
if (missing.length > 0) {
    console.error(
        `sources:fixtures — no fixture for ${missing.map((p) => p.slug).join(", ")} in fixtures/`,
    );
    process.exit(1);
}
rmSync(FIXTURE_SOURCES, { recursive: true, force: true });
for (const { slug } of projects) {
    cpSync(join(FIXTURES, slug), join(FIXTURE_SOURCES, slug), {
        recursive: true,
    });
}
writeOrigin(FIXTURE_SOURCES, { origin: "fixtures", projects: {} });

const reads = validateAll(
    projects.map(({ slug }) => ({ slug, dir: join(FIXTURE_SOURCES, slug) })),
    label,
);
if (!reads) process.exit(1);
console.log(
    `sources:fixtures — ${projects.map((p) => p.slug).join(", ")} → ${label(FIXTURE_SOURCES)} (valid against contract v${CONTRACT_REVISION})`,
);
