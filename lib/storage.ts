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
    /** set once the legacy keys have moved: the move never runs twice */
    migrated: "@fragiola:migrated",
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

// what could not be stored: kept for this page (and the client-side navigations from it)
const unstored = new Map<string, string>();

export function readStored(key: string): string | null {
    try {
        const value = window.localStorage.getItem(key);
        if (value !== null) return value;
    } catch {
        // storage unavailable: what this page kept, if anything
    }
    return unstored.get(key) ?? null;
}

export function writeStored(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
        unstored.delete(key);
    } catch {
        // storage unavailable: the value lasts for this page
        unstored.set(key, value);
    }
}

/**
 * The inline script that marks <html> when the reader collapsed the gallery's list
 * (`data-examples-list="collapsed"`), run by the gallery's layout before the list is parsed: the
 * static page paints the list collapsed before hydration, and the gallery takes the mark away once
 * React holds the state (components/gallery/gallery-chrome.tsx, app/globals.css).
 */
export function examplesListScript(): string {
    return `(function(){try{if(window.localStorage.getItem(${JSON.stringify(STORAGE_KEYS.examplesSidebar)})==="false")document.documentElement.dataset.examplesList="collapsed"}catch(e){}})();`;
}

/**
 * The inline script that moves each legacy key to its new one: copied when the new key is not
 * set (a newer choice wins), then removed. It runs once per browser (`@fragiola:migrated`): a
 * `theme` written later belongs to someone else on this origin (an embed), not to the site.
 * Silent when storage throws. Plain ES2015, written once here so the page and the tests run the
 * same text.
 */
export function storageMigrationScript(): string {
    return `(function(){try{var s=window.localStorage,f=${JSON.stringify(STORAGE_KEYS.migrated)},m=${JSON.stringify(LEGACY_KEYS)};if(s.getItem(f)!==null)return;for(var i=0;i<m.length;i++){var o=m[i][0],n=m[i][1],p=o.charAt(o.length-1)===":",ks=[];if(p){for(var j=0;j<s.length;j++){var k=s.key(j);if(k!==null&&k.indexOf(o)===0)ks.push(k)}}else if(s.getItem(o)!==null)ks.push(o);for(var j=0;j<ks.length;j++){var t=p?n+ks[j].slice(o.length):n,v=s.getItem(ks[j]);if(v!==null&&s.getItem(t)===null)s.setItem(t,v);s.removeItem(ks[j])}}s.setItem(f,"1")}catch(e){}})();`;
}
