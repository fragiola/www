// `pnpm build [--fixtures]` — prepare:site, then `next build` → out/.
//
//   (default)    from the projects' exports in .sources/, which prepare:site refuses when empty,
//                filled from the fixtures, or stale (scripts/projects.ts, unpublishable)
//   --fixtures   from .sources-fixtures/ (`pnpm e2e:build`): what the browser suite runs against
//
// Both steps read the same folder: FRAGIOLA_SOURCES is set for them (lib/projects.ts,
// source.config.ts). Then out/<slug>/create/ goes for every project whose project.json declares
// no `create` (v1.6, §5.5): Next renders it there as a 404 (`output: "export"` refuses a route
// with no params, app/[project]/create/layout.tsx), which a static host would serve with a 200.

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { ProjectInfo } from "../lib/contract/types.ts";
import {
    FIXTURE_SOURCES,
    ROOT,
    readJson,
    readProjects,
    SOURCES,
} from "./projects.ts";

const { values } = parseArgs({
    options: { fixtures: { type: "boolean", default: false } },
});

const env = values.fixtures
    ? { ...process.env, FRAGIOLA_SOURCES: FIXTURE_SOURCES }
    : process.env;

function run(command: string, args: string[]) {
    const { status } = spawnSync(command, args, {
        cwd: ROOT,
        env,
        stdio: "inherit",
    });
    if (status !== 0) process.exit(status ?? 1);
}

run("node", [
    join(ROOT, "scripts", "prepare-site.ts"),
    ...(values.fixtures ? ["--fixtures"] : []),
]);
run("pnpm", ["exec", "next", "build"]);

const sources = values.fixtures ? FIXTURE_SOURCES : SOURCES;
for (const { slug } of readProjects()) {
    const info = readJson<ProjectInfo>(join(sources, slug, "project.json"));
    if (!info.create) {
        rmSync(join(ROOT, "out", slug, "create"), {
            recursive: true,
            force: true,
        });
    }
}
