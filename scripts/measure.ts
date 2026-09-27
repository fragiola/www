// `node scripts/measure.ts <origin> <path>… [--click <selector>] [--no-prefetch]`
//
// The weight of pages as a browser loads them: every response until the network is idle, raw and
// gzipped (GitHub Pages serves gzip), by category — the document, its JS and CSS, Next's
// prefetches of the pages it links to (RSC payloads), and what its iframes load (an example's
// embed app). `--click` clicks a selector once loaded and measures what that adds (e.g. the code
// panel: `--click '[data-testid=toggle-code]'`). `--no-prefetch` blocks Next's prefetches, so
// what is left is what the page itself needs (the JS of the routes it links to goes too).
//
//   node scripts/measure.ts http://localhost:4400 /dockable/examples/hello-layout/

import { gzipSync } from "node:zlib";
import { chromium, type Response } from "@playwright/test";

const argv = process.argv.slice(2);
const noPrefetch = argv.includes("--no-prefetch");
const args = argv.filter((arg) => arg !== "--no-prefetch");
const clickAt = args.indexOf("--click");
const click = clickAt >= 0 ? args[clickAt + 1] : undefined;
const [origin, ...paths] = args.filter(
    (_, index) => clickAt < 0 || (index !== clickAt && index !== clickAt + 1),
);
if (!origin || paths.length === 0) {
    console.error(
        "usage: node scripts/measure.ts <origin> <path>… [--click <selector>] [--no-prefetch]",
    );
    process.exit(1);
}

const CATEGORIES = [
    "document",
    "js",
    "css",
    "prefetch",
    "other",
    "iframes",
    "on click",
] as const;
type Category = (typeof CATEGORIES)[number];

interface Tally {
    raw: number;
    gzip: number;
    requests: number;
}

function categorize(response: Response, main: boolean): Category {
    if (!main) return "iframes";
    const url = response.url();
    const type = response.request().resourceType();
    if (url.includes("_rsc=") || /\.txt(\?|$)/.test(url)) return "prefetch";
    if (type === "document") return "document";
    if (type === "script") return "js";
    if (type === "stylesheet") return "css";
    return "other";
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const line = (label: string, tally: Tally) =>
    `  ${label.padEnd(9)} ${kb(tally.raw).padStart(11)} raw ${kb(tally.gzip).padStart(10)} gzip ${String(tally.requests).padStart(4)} req`;

const browser = await chromium.launch();
for (const path of paths) {
    const context = await browser.newContext();
    const page = await context.newPage();
    if (noPrefetch) {
        await page.route(/_rsc=|\.txt(\?|$)/, (route) => route.abort());
    }
    const tallies = new Map<Category, Tally>(
        CATEGORIES.map((category) => [
            category,
            { raw: 0, gzip: 0, requests: 0 },
        ]),
    );
    let clicked = false;
    const pending: Promise<void>[] = [];
    page.on("response", (response) => {
        const category = clicked
            ? "on click"
            : categorize(response, response.frame() === page.mainFrame());
        const tally = tallies.get(category);
        pending.push(
            response
                .body()
                .then((body) => {
                    if (!tally) return;
                    tally.raw += body.length;
                    tally.gzip += gzipSync(body).length;
                    tally.requests += 1;
                })
                .catch(() => {
                    // a redirect or an aborted request has no body
                }),
        );
    });
    await page.goto(new URL(path, origin).href, { waitUntil: "networkidle" });
    await Promise.all(pending);
    if (click) {
        clicked = true;
        await page.click(click);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);
        await Promise.all(pending);
    }
    console.log(path);
    const total: Tally = { raw: 0, gzip: 0, requests: 0 };
    const shell: Tally = { raw: 0, gzip: 0, requests: 0 };
    for (const [category, tally] of tallies) {
        if (tally.requests === 0) continue;
        console.log(line(category, tally));
        if (category === "on click") continue;
        for (const sum of category === "document" ||
        category === "js" ||
        category === "css"
            ? [total, shell]
            : [total]) {
            sum.raw += tally.raw;
            sum.gzip += tally.gzip;
            sum.requests += tally.requests;
        }
    }
    console.log(line("doc+js+css", shell));
    console.log(line("total", total));
    await context.close();
}
await browser.close();
