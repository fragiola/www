import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests: the contract checks (lib/contract) against the fixtures and broken copies of them,
// the build failing on a broken export, the brand and the search metadata builders (lib/seo.ts,
// which imports through tsconfig's `@/` alias). The browser suite is Playwright (e2e/).
export default defineConfig({
    resolve: {
        alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
    },
    test: {
        include: ["tests/**/*.test.ts"],
        testTimeout: 60_000,
    },
});
