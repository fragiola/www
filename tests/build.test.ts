import { spawnSync } from "node:child_process";
import {
    appendFileSync,
    cpSync,
    mkdtempSync,
    readFileSync,
    rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";

// `pnpm build` is `prepare:site && next build`: a broken export stops it at prepare:site, before
// Next compiles anything, with the file and the line. Run against a broken copy of the fixtures
// (FRAGIOLA_SOURCES); prepare:site checks before it writes anything, so .sources/ and public/
// are left alone.

const ROOT = join(import.meta.dirname, "..");
let sources: string;

beforeAll(() => {
    sources = mkdtempSync(join(tmpdir(), "www-build-"));
    for (const slug of ["ui", "dockable"]) {
        cpSync(join(ROOT, "fixtures", slug), join(sources, slug), {
            recursive: true,
        });
    }
});
afterAll(() => rmSync(sources, { recursive: true, force: true }));

test("a broken link fails the build, naming the file and the line", () => {
    const page = join(sources, "dockable/docs/guides/popouts.mdx");
    const line = readFileSync(page, "utf-8").split("\n").length;
    appendFileSync(page, "See [the reference](/docs/api/root#props).\n");
    const run = spawnSync("node", [join(ROOT, "scripts/prepare-site.ts")], {
        cwd: ROOT,
        env: { ...process.env, FRAGIOLA_SOURCES: sources },
        encoding: "utf-8",
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(
        `dockable/docs/guides/popouts.mdx:${line}:5: broken link (markdown) "/docs/api/root#props": /docs/api/root: no such page`,
    );
    expect(run.stderr).toContain(
        "1 problem(s) against the site export contract v1",
    );
});
