import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf-8");
const WORKFLOW = ".github/workflows/deploy-pages.yml";

// The Playwright jobs (checks, e2e) run in Playwright's image instead of installing Chromium
// (Epic #69, as fragiola/data-grid Epic #162): its browsers are the ones of its version, so the
// tag follows @playwright/test. Upgrading Playwright changes both in the same PR.
describe("the deploy workflow", () => {
    test("runs the Playwright jobs in the image of the pinned @playwright/test", () => {
        const version = JSON.parse(read("package.json")).devDependencies[
            "@playwright/test"
        ];
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);
        const images = [
            ...read(WORKFLOW).matchAll(
                /mcr\.microsoft\.com\/playwright:v([^\s"']+?)-noble/g,
            ),
        ].map((match) => match[1]);
        expect(images).toHaveLength(2);
        expect(new Set(images)).toEqual(new Set([version]));
    });

    test("installs no browser", () => {
        expect(read(WORKFLOW)).not.toContain("playwright install");
    });
});
