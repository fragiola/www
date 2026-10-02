import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
    type APIRequestContext,
    expect,
    type Page,
    test,
} from "@playwright/test";
import { PROJECTS } from "./helpers";

// Search and sharing (AGENTS.md, "Search and sharing"; CONTRACT.md §3.6), on the static HTML a
// crawler reads: JavaScript off. For every URL of the sitemap: one title of at most 60
// characters, a meta description of 50–160, a canonical to itself, the Open Graph and Twitter
// cards with an image that exists, one h1, no skipped heading level, and structured data of its
// kind. Then what stays out of the index (the redirect pages, the 404, the search index, the
// embeds), robots.txt, a crawl from / that reaches every sitemap URL, and the icons.

test.use({ javaScriptEnabled: false });

const SITE = "https://fragiola.com";

async function sitemap(request: APIRequestContext): Promise<string[]> {
    const response = await request.get("sitemap.xml");
    expect(response.ok()).toBe(true);
    const xml = await response.text();
    return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1] ?? "");
}

/** The site path of a sitemap URL. */
const pathOf = (url: string) => new URL(url).pathname;

/** A meta tag's content by name or property, or null when the page has none. */
async function meta(page: Page, key: string): Promise<string | null> {
    const tag = page.locator(
        `head meta[name="${key}"], head meta[property="${key}"]`,
    );
    return (await tag.count()) === 0
        ? null
        : tag.first().getAttribute("content");
}

const chars = (text: string | null) => [...(text ?? "")].length;

function kindOf(path: string): "home" | "landing" | "docs" | "example" {
    if (path === "/") return "home";
    if (/^\/[^/]+\/$/.test(path)) return "landing";
    return path.includes("/docs/") ? "docs" : "example";
}

// every page carries the organization it names as publisher: a page is read on its own
const EXPECTED_TYPES = {
    home: ["Organization", "WebSite"],
    landing: ["SoftwareSourceCode", "BreadcrumbList", "Organization"],
    docs: ["TechArticle", "BreadcrumbList", "Organization"],
    example: ["BreadcrumbList", "Organization"],
};

/** The fixtures' pages, as the sitemap must list them: every .mdx but the landing. */
function docsPaths(slug: string): string[] {
    const docs = join(import.meta.dirname, "..", "fixtures", slug, "docs");
    return readdirSync(docs, { recursive: true, encoding: "utf-8" })
        .filter((file) => file.endsWith(".mdx") && file !== "index.mdx")
        .map((file) => `/${slug}/docs/${file.replace(/\.mdx$/, "")}/`);
}

test("the sitemap lists every indexable page and nothing else", {
    tag: "@serve",
}, async ({ request }) => {
    const urls = await sitemap(request);
    const paths = urls.map(pathOf);
    for (const url of urls) {
        expect(url.startsWith(`${SITE}/`)).toBe(true);
        expect(url.endsWith("/")).toBe(true);
        expect(url).not.toContain("?");
        expect(url).not.toMatch(/\/(api|r|_next)\/|\/embed\/|\/code\//);
    }
    const expected = [
        "/",
        ...PROJECTS.flatMap(({ project, manifests }) => [
            `/${project.slug}/`,
            ...docsPaths(project.slug),
            ...[
                ...new Set(
                    Object.values(manifests).flatMap((manifest) =>
                        manifest.examples.map((example) => example.id),
                    ),
                ),
            ].map((id) => `/${project.slug}/examples/${id}/`),
        ]),
    ];
    expect([...paths].sort()).toEqual([...expected].sort());
    // the redirect pages are not indexable pages
    for (const { project } of PROJECTS) {
        const { slug } = project;
        expect(paths).not.toContain(`/${slug}/docs/`);
        expect(paths).not.toContain(`/${slug}/examples/`);
    }
    // no lastmod: the site does not know when a page changed
    expect(await (await request.get("sitemap.xml")).text()).not.toContain(
        "lastmod",
    );
});

/** What a crawler reads of a page's static HTML: its head, its headings, its structured data. */
async function readPage(page: Page) {
    return page.evaluate(() => {
        const metas: Record<string, string[]> = {};
        for (const tag of document.head.querySelectorAll(
            "meta[name], meta[property]",
        )) {
            for (const key of new Set([
                tag.getAttribute("name"),
                tag.getAttribute("property"),
            ])) {
                if (key) {
                    metas[key] ??= [];
                    metas[key].push(tag.getAttribute("content") ?? "");
                }
            }
        }
        return {
            titles: [...document.head.querySelectorAll("title")].map(
                (title) => title.textContent ?? "",
            ),
            metas,
            canonicals: [
                ...document.head.querySelectorAll('link[rel="canonical"]'),
            ].map((link) => link.getAttribute("href")),
            levels: [
                ...document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
            ].map((heading) => Number(heading.tagName.slice(1))),
            graphs: [
                ...document.querySelectorAll(
                    'script[type="application/ld+json"]',
                ),
            ].map((script) => script.textContent ?? ""),
        };
    });
}

// titles: the landing's own, then · project, then · Fragiola when it fits
const TITLES: Record<string, string> = {
    "/": "Fragiola — headless React components and a design system",
    "/ui/": "Fragiola UI — React components on Base UI and Tailwind",
    "/dockable/": "Dockable — headless dockable panel layouts for React",
    "/ui/docs/atoms/clickable/": "Clickable · Fragiola UI",
    "/dockable/docs/guides/popouts/": "Popouts · Dockable · Fragiola",
    "/ui/examples/text/": "Text · Fragiola UI examples",
    "/dockable/examples/add-tabs/": "Add tabs · Dockable examples · Fragiola",
};

test("every sitemap URL: title, description, canonical, cards, one h1, headings, JSON-LD", async ({
    page,
    request,
}) => {
    test.setTimeout(120_000);
    const images = new Map<string, boolean>();
    const titled: string[] = [];
    for (const url of await sitemap(request)) {
        const path = pathOf(url);
        const where = `${path}:`;
        // the static HTML: its head and its headings are there once it is parsed
        await page.goto(path.slice(1), { waitUntil: "domcontentloaded" });
        const read = await readPage(page);
        const content = (key: string) => read.metas[key]?.[0] ?? null;

        expect(read.titles, where).toHaveLength(1);
        const title = read.titles[0] ?? "";
        expect(chars(title), `${where} title "${title}"`).toBeLessThanOrEqual(
            60,
        );
        const expectedTitle = TITLES[path];
        if (expectedTitle !== undefined) {
            expect(title, where).toBe(expectedTitle);
            titled.push(path);
        }
        const description = content("description");
        expect(
            chars(description),
            `${where} description "${description}"`,
        ).toBeGreaterThanOrEqual(50);
        expect(chars(description), where).toBeLessThanOrEqual(160);
        expect(description, where).not.toContain("`");

        expect(read.canonicals, where).toEqual([url]);
        expect(content("robots"), where).toBeNull();

        expect(content("og:title"), where).toBe(title);
        expect(content("og:description"), where).toBe(description);
        expect(content("og:url"), where).toBe(url);
        expect(content("og:site_name"), where).toBe("Fragiola");
        expect(content("og:type"), where).toBe(
            kindOf(path) === "docs" ? "article" : "website",
        );
        expect(content("twitter:card"), where).toBe("summary_large_image");
        const image = content("og:image") ?? "";
        expect(content("twitter:image"), where).toBe(image);
        expect(content("og:image:alt"), where).toBeTruthy();
        expect(image.startsWith(`${SITE}/`), where).toBe(true);
        if (!images.has(image)) {
            const response = await request.get(pathOf(image).slice(1));
            images.set(
                image,
                response.ok() &&
                    (await response.body())
                        .subarray(1, 4)
                        .toString("latin1") === "PNG",
            );
        }
        expect(images.get(image), `${where} ${image} is a PNG`).toBe(true);

        const { levels, graphs } = read;
        expect(
            levels.filter((level) => level === 1),
            where,
        ).toHaveLength(1);
        // from the page's h1: the gallery's list (its levels' h2s) comes before the example's h1
        let previous = 1;
        for (const level of levels) {
            expect(
                level,
                `${where} an h${level} after an h${previous}`,
            ).toBeLessThanOrEqual(previous + 1);
            previous = level;
        }

        expect(graphs, where).toHaveLength(1);
        const data = JSON.parse(graphs[0] ?? "{}") as {
            "@context": string;
            "@graph": Record<string, unknown>[];
        };
        expect(data["@context"]).toBe("https://schema.org");
        expect(
            data["@graph"].map((item) => item["@type"]),
            where,
        ).toEqual(EXPECTED_TYPES[kindOf(path)]);
        for (const item of data["@graph"]) checkEntity(item, url, where);
    }
    expect(titled.sort()).toEqual(Object.keys(TITLES).sort());
});

/** The fields each type needs, and breadcrumbs that end on the page itself. */
function checkEntity(
    item: Record<string, unknown>,
    url: string,
    where: string,
) {
    const required: Record<string, string[]> = {
        Organization: ["@id", "name", "url", "logo", "sameAs"],
        WebSite: ["@id", "name", "url", "publisher"],
        SoftwareSourceCode: [
            "@id",
            "name",
            "description",
            "url",
            "codeRepository",
            "programmingLanguage",
            "publisher",
        ],
        TechArticle: [
            "headline",
            "description",
            "url",
            "inLanguage",
            "isPartOf",
            "publisher",
        ],
        BreadcrumbList: ["itemListElement"],
    };
    for (const key of required[item["@type"] as string] ?? []) {
        expect(item[key], `${where} ${item["@type"]}.${key}`).toBeTruthy();
    }
    if (item["@type"] === "TechArticle") {
        expect(item.url, where).toBe(url);
        expect(item.isPartOf, where).toMatchObject({
            "@type": "SoftwareSourceCode",
            name: expect.any(String),
            url: expect.stringMatching(/^https:\/\/fragiola\.com\/[^/]+\/$/),
        });
    }
    for (const key of ["description", "headline", "name"]) {
        if (typeof item[key] === "string") {
            expect(item[key], `${where} ${key}: plain text`).not.toContain("`");
        }
    }
    if (item["@type"] === "BreadcrumbList") {
        const list = item.itemListElement as {
            position: number;
            name: string;
            item?: string;
        }[];
        expect(list.map((entry) => entry.position)).toEqual(
            list.map((_, index) => index + 1),
        );
        expect(list[0]?.item, where).toBe(`${SITE}/`);
        // every crumb but the last links somewhere; the last is the page
        for (const entry of list.slice(0, -1)) {
            expect(entry.item, `${where} crumb "${entry.name}"`).toMatch(
                /^https:\/\/fragiola\.com\/.*\/$|^https:\/\/fragiola\.com\/$/,
            );
        }
        expect(list.at(-1)?.item ?? url, where).toBe(url);
        // no crumb leads to the page it is on but the last
        const items = list.slice(0, -1).map((entry) => entry.item);
        expect(items, where).not.toContain(url);
    }
}

test("the gallery's query strings are one page: the canonical has none", async ({
    page,
}) => {
    await page.goto(
        "dockable/examples/add-tabs/?theme=paper&code=1&framework=vue",
    );
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
        "href",
        `${SITE}/dockable/examples/add-tabs/`,
    );
});

test("redirect pages and the 404 are noindex; the embeds say noindex themselves", {
    tag: "@serve",
}, async ({ page, request }) => {
    for (const path of [
        "ui/docs/",
        "ui/examples/",
        "dockable/docs/",
        "dockable/examples/",
    ]) {
        await page.goto(path);
        expect(await meta(page, "robots"), path).toMatch(/\bnoindex\b/);
        await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
    }
    const missing = await page.goto("no/such/page/");
    expect(missing?.status()).toBe(404);
    expect(await meta(page, "robots")).toMatch(/\bnoindex\b/);
    for (const path of [
        "ui/embed/react/",
        "dockable/embed/react/",
        "dockable/embed/vue/popout/",
    ]) {
        const html = await (await request.get(path)).text();
        expect(html, path).toMatch(
            /<meta name="robots" content="noindex"\s*\/?>/,
        );
    }
});

test("robots.txt allows everything but the search index, and names the sitemap", {
    tag: "@serve",
}, async ({ request }) => {
    const response = await request.get("robots.txt");
    expect(response.ok()).toBe(true);
    const robots = await response.text();
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    const disallowed = [...robots.matchAll(/^Disallow:\s*(\S*)/gm)].map(
        (m) => m[1],
    );
    // the embeds carry noindex, which a crawler reads only when it may fetch them
    expect(disallowed).toEqual(["/api/"]);
});

test("following links in the static HTML from / reaches every sitemap URL", async ({
    request,
}) => {
    test.setTimeout(120_000);
    const wanted = (await sitemap(request)).map(pathOf);
    const seen = new Set(["/"]);
    const queue = ["/"];
    while (queue.length > 0) {
        const path = queue.shift() ?? "/";
        const response = await request.get(path.slice(1));
        if (!response.ok()) continue;
        if (!(response.headers()["content-type"] ?? "").includes("text/html")) {
            continue;
        }
        const html = await response.text();
        for (const [, href = ""] of html.matchAll(
            /<a\b[^>]*\bhref="([^"]*)"/g,
        )) {
            if (!href.startsWith("/") || href.startsWith("//")) continue;
            const target = href.replace(/[?#].*$/, "");
            if (!target.endsWith("/") || seen.has(target)) continue;
            seen.add(target);
            queue.push(target);
        }
    }
    expect(wanted.filter((path) => !seen.has(path))).toEqual([]);
});

test("the icons and the manifest are served", { tag: "@serve" }, async ({
    page,
    request,
}) => {
    for (const [path, type] of [
        ["favicon.ico", "image/x-icon"],
        ["icon.svg", "image/svg+xml"],
        ["apple-icon.png", "image/png"],
        ["brand/icon-192.png", "image/png"],
        ["brand/icon-512.png", "image/png"],
        ["brand/icon-maskable-512.png", "image/png"],
        ["brand/fragiola-mark.svg", "image/svg+xml"],
        ["brand/fragiola-mark-512.png", "image/png"],
    ] as const) {
        const response = await request.get(path);
        expect(response.ok(), path).toBe(true);
        expect(response.headers()["content-type"], path).toContain(type);
    }
    const manifest = await (await request.get("manifest.webmanifest")).json();
    expect(manifest).toMatchObject({
        name: "Fragiola",
        start_url: "/",
        display: "standalone",
    });
    expect(
        (manifest.icons as { purpose: string; sizes: string }[]).map(
            (icon) => `${icon.purpose} ${icon.sizes}`,
        ),
    ).toEqual(["any 192x192", "any 512x512", "maskable 512x512"]);
    await page.goto("");
    for (const selector of [
        'link[rel="icon"][href^="/favicon.ico"]',
        'link[rel="icon"][href^="/icon.svg"]',
        'link[rel="apple-touch-icon"][href^="/apple-icon.png"]',
        'link[rel="manifest"][href="/manifest.webmanifest"]',
        'meta[name="theme-color"][media="(prefers-color-scheme: light)"]',
        'meta[name="theme-color"][media="(prefers-color-scheme: dark)"]',
    ]) {
        await expect(page.locator(`head ${selector}`), selector).toHaveCount(1);
    }
});
