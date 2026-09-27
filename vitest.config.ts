import { defineConfig } from "vitest/config";

// Unit tests: the contract checks (lib/contract) against the fixtures and broken copies of them,
// and the build failing on a broken export. The browser suite is Playwright (e2e/).
export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        testTimeout: 60_000,
    },
});
