import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);
const PORT = Number(process.env.WWW_E2E_PORT ?? 4400);

// The browser suite runs against the static export (out/), served the way GitHub Pages serves it
// (scripts/serve.ts): what gets deployed, not `next dev`. It needs out/ built from the fixtures:
// `pnpm e2e:build` (sources:fixtures + build) first; e2e/global-setup.ts checks.
export default defineConfig({
    testDir: "e2e",
    globalSetup: "./e2e/global-setup.ts",
    fullyParallel: true,
    forbidOnly: CI,
    retries: CI ? 2 : 0,
    workers: CI ? 2 : 4,
    reporter: CI ? [["line"], ["html", { open: "never" }]] : "line",
    use: {
        baseURL: `http://localhost:${PORT}/`,
        trace: "on-first-retry",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: `node scripts/serve.ts ${PORT}`,
        url: `http://localhost:${PORT}/`,
        reuseExistingServer: !CI,
    },
});
