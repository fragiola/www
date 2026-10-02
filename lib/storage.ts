// The site's localStorage: every key it writes, all under `@fragiola:`, and the one-time move of
// the keys it wrote before the prefix. Each value is a per-reader convenience (a choice to
// remember), so storage that is unavailable (a private window, blocked site data) is never an
// error: a read gives null, a write is dropped.
//
// The move runs as an inline script in the <head> of every page (app/layout.tsx), before
// next-themes' own script reads the site theme: a reader who chose light before the prefix keeps
// light on the very first paint.

export const STORAGE_KEYS = {
    /** the site theme (light, dark, system): next-themes' storageKey */
    theme: "@fragiola:theme",
    /** the framework choice, site-wide (components/framework.tsx) */
    framework: "@fragiola:framework",
    /** the example theme chosen in a project's gallery */
    exampleTheme: (slug: string) => `@fragiola:example-theme:${slug}`,
    /** the gallery's examples list, open or collapsed on desktop: "true" / "false" */
    examplesSidebar: "@fragiola:examples-sidebar",
    /** the gallery's code panel, its share of the desktop row in % */
    codePanelWidth: "@fragiola:code-panel-width",
} as const;

/**
 * The keys written before the prefix and where each moved: `[old, new]`, a prefix pair when both
 * end in ":" (`fragiola:example-theme:<slug>`, one key per project).
 */
export const LEGACY_KEYS: readonly (readonly [string, string])[] = [
    ["theme", STORAGE_KEYS.theme],
    ["fragiola:framework", STORAGE_KEYS.framework],
    ["fragiola:example-theme:", STORAGE_KEYS.exampleTheme("")],
];

export function readStored(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeStored(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // storage unavailable: the value lasts for this page
    }
}

/**
 * The inline script that moves each legacy key to its new one: copied when the new key is not
 * set (a newer choice wins), then removed. Idempotent, and silent when storage throws. Plain
 * ES2015, written once here so the page and the tests run the same text.
 */
export function storageMigrationScript(): string {
    return `(function(){try{var s=window.localStorage,m=${JSON.stringify(LEGACY_KEYS)};for(var i=0;i<m.length;i++){var o=m[i][0],n=m[i][1],p=o.charAt(o.length-1)===":",ks=[];if(p){for(var j=0;j<s.length;j++){var k=s.key(j);if(k!==null&&k.indexOf(o)===0)ks.push(k)}}else if(s.getItem(o)!==null)ks.push(o);for(var j=0;j<ks.length;j++){var t=p?n+ks[j].slice(o.length):n,v=s.getItem(ks[j]);if(v!==null&&s.getItem(t)===null)s.setItem(t,v);s.removeItem(ks[j])}}}catch(e){}})();`;
}
