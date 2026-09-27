// `node scripts/serve.ts [port]` — serves out/ the way GitHub Pages does: /ui/docs/x/ →
// out/ui/docs/x/index.html, /ui/docs/x → a redirect to /ui/docs/x/, a missing file → 404.html
// with a 404. No dependency: node:http is enough for a static folder. The e2e suite and
// `scripts/measure.ts` run against it, so they test what gets deployed rather than `next dev`.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "../out");
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4400);

const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".wasm": "application/wasm",
};

const isFile = (path: string) =>
    stat(path).then(
        (info) => info.isFile(),
        () => false,
    );
const isDirectory = (path: string) =>
    stat(path).then(
        (info) => info.isDirectory(),
        () => false,
    );

createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const safe = normalize(decodeURIComponent(url.pathname)).replace(
        /^(\.\.[/\\])+/,
        "",
    );
    const path = join(OUT, safe);
    let file: string | undefined;
    if (path.startsWith(OUT)) {
        if (await isFile(path)) file = path;
        else if (await isFile(join(path, "index.html"))) {
            if (!url.pathname.endsWith("/")) {
                response.writeHead(301, {
                    location: `${url.pathname}/${url.search}`,
                });
                response.end();
                return;
            }
            file = join(path, "index.html");
        } else if (
            !url.pathname.endsWith("/") &&
            (await isDirectory(path)) === false &&
            (await isFile(`${path}.html`))
        ) {
            file = `${path}.html`;
        }
    }
    const served = file ?? join(OUT, "404.html");
    response.writeHead(file ? 200 : 404, {
        "content-type": TYPES[extname(served)] ?? "application/octet-stream",
        "cache-control": "no-cache",
    });
    createReadStream(served).pipe(response);
}).listen(PORT, () => {
    console.log(`serving ${OUT} at http://localhost:${PORT}/`);
});
