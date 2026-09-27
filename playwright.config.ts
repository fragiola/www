import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);

/**
 * What serves out/:
 *   pages   scripts/serve.ts, the way GitHub Pages serves it (the default)
 *   serve   `serve out` (vercel/serve, what `npx serve out` runs): "clean URLs", so /x/index.html
 *           redirects to /x/index and loses its query string — the site must never depend on
 *           such a URL (§5.1). `pnpm e2e:serve`.
 */
const SERVER = process.env.WWW_E2E_SERVER === "serve" ? "serve" : "pages";
const PORT = Number(
    process.env.WWW_E2E_PORT ?? (SERVER === "serve" ? 4401 : 4400),
);

// The browser suite runs against the static export (out/), served like a static host serves it:
// what gets deployed, not `next dev`. It needs out/ built from the fixtures: `pnpm e2e:build`
// (sources:fixtures + build --fixtures) first; e2e/global-setup.ts checks.
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
        command:
            SERVER === "serve"
                ? `pnpm exec serve out --listen ${PORT} --no-clipboard --no-request-logging`
                : `node scripts/serve.ts ${PORT}`,
        url: `http://localhost:${PORT}/`,
        reuseExistingServer: !CI,
    },
});
