// `pnpm build [--fixtures]` — prepare:site, then `next build` → out/.
//
//   (default)    from the projects' exports in .sources/, which prepare:site refuses when empty,
//                filled from the fixtures, or stale (scripts/projects.ts, unpublishable)
//   --fixtures   from .sources-fixtures/ (`pnpm e2e:build`): what the browser suite runs against
//
// Both steps read the same folder: FRAGIOLA_SOURCES is set for them (lib/projects.ts,
// source.config.ts).

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { FIXTURE_SOURCES, ROOT } from "./projects.ts";

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
