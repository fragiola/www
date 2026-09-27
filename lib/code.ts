// The code panel's files, served as static JSON next to the site and fetched only when a panel
// opens (scripts/prepare-site.ts writes them, highlighted at build time):
//
//   /<slug>/code/<fw>/<id>.json    { files: [path…] (entry first), own: { path: CodeFile } }
//   /<slug>/code/<fw>/shared.json  { path: CodeFile }   the manifest's `shared` files, once
//   /<slug>/code/themes.json       { theme: CodeFile }  the example themes' CSS
//
// A page never carries code: an example page stays small, and the shared files are fetched once
// per project and framework, however many examples are opened.

/** A file, highlighted: `html` is the inside of Shiki's `<code>`, `pre` its `<pre>`. */
export interface CodeFile {
    path: string;
    lang: string;
    code: string;
    html: string;
    pre: { className: string; style: string };
}

export interface ExampleCode {
    files: string[];
    own: Record<string, CodeFile>;
}

export const codeUrls = {
    example: (slug: string, framework: string, id: string) =>
        `/${slug}/code/${framework}/${id}.json`,
    shared: (slug: string, framework: string) =>
        `/${slug}/code/${framework}/shared.json`,
    themes: (slug: string) => `/${slug}/code/themes.json`,
};

const cache = new Map<string, Promise<unknown>>();

/** Fetches a JSON file once per page load; a failed fetch is forgotten, so it can be retried. */
function fetchOnce<T>(url: string): Promise<T> {
    let pending = cache.get(url);
    if (!pending) {
        pending = fetch(url).then((response) => {
            if (!response.ok) throw new Error(`${url}: ${response.status}`);
            return response.json();
        });
        pending.catch(() => cache.delete(url));
        cache.set(url, pending);
    }
    return pending as Promise<T>;
}

/** An example's files in order (entry first), and its theme's CSS when the theme has one. */
export async function loadExampleCode(
    slug: string,
    framework: string,
    id: string,
): Promise<CodeFile[]> {
    const example = await fetchOnce<ExampleCode>(
        codeUrls.example(slug, framework, id),
    );
    const needsShared = example.files.some((path) => !example.own[path]);
    const shared = needsShared
        ? await fetchOnce<Record<string, CodeFile>>(
              codeUrls.shared(slug, framework),
          )
        : {};
    return example.files.flatMap((path) => {
        const file = example.own[path] ?? shared[path];
        return file ? [file] : [];
    });
}

export function loadThemeFiles(
    slug: string,
): Promise<Record<string, CodeFile>> {
    return fetchOnce(codeUrls.themes(slug));
}
