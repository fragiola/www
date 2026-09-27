// `pnpm sources:fixtures`
//
// Fills .sources/ from fixtures/ instead of running the projects' exports: one minimal v1
// export per project of projects.json (fixtures/README.md). The tests build the site from them,
// so they run without the projects' repos and against content they control.

import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateAll } from "../lib/contract/validate.ts";
import { label, ORIGIN_FILE, ROOT, readProjects, SOURCES } from "./projects.ts";

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
rmSync(SOURCES, { recursive: true, force: true });
for (const { slug } of projects) {
    cpSync(join(FIXTURES, slug), join(SOURCES, slug), { recursive: true });
}
writeFileSync(join(SOURCES, ORIGIN_FILE), "fixtures\n");

const reads = validateAll(
    projects.map(({ slug }) => ({ slug, dir: join(SOURCES, slug) })),
    label,
);
if (!reads) process.exit(1);
console.log(
    `sources:fixtures — ${projects.map((p) => p.slug).join(", ")} → ${label(SOURCES)} (valid against contract v1)`,
);
