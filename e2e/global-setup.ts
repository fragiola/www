import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Fails early, with the fix, when out/ is missing or was built from the projects' exports
// rather than the fixtures the specs are written against.
export default function globalSetup() {
    const sources = join(import.meta.dirname, "../out/_sources.json");
    if (!existsSync(sources)) {
        throw new Error("out/ is missing: run `pnpm e2e:build` first");
    }
    const { origin } = JSON.parse(readFileSync(sources, "utf-8")) as {
        origin: string;
    };
    if (origin !== "fixtures") {
        throw new Error(
            `out/ was built from "${origin}", not the fixtures: run \`pnpm e2e:build\` first`,
        );
    }
}
