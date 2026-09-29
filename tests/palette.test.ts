import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vitest";

// The site is painted by Fragiola UI's palettes: every colour is a role (bg-palette-base,
// text-palette-accent/85, …), under a palette-* class when it must be chromatic. The theme resets
// --color-*, so a Tailwind default colour (bg-slate-900) renders nothing, silently, and a hex
// value ignores the theme. This walks the site's own code (not the components copied from ui's
// registry, which are ui's) for either, and for arbitrary colours in utilities (bg-[#…]).

const ROOT = join(import.meta.dirname, "..");
const COPIED = ["components/ui", "components/atoms", "components/families"];

function files(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(
        (entry) => {
            const path = `${dir}/${entry.name}`;
            if (COPIED.includes(path)) return [];
            if (entry.isDirectory()) return files(path);
            return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
        },
    );
}

const DEFAULT_COLOURS =
    "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";
const COLOUR_UTILITIES =
    "bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|from|via|to|fill|stroke|(?:inset-|text-|drop-)?shadow|decoration|divide|placeholder|caret|accent";
const DEFAULT_UTILITY = new RegExp(
    `(?<![\\w-])(?:[a-z-]+:)*(?:${COLOUR_UTILITIES})-(?:${DEFAULT_COLOURS})(?:-\\d{2,3})?(?![\\w-])`,
    "g",
);
/** an arbitrary colour in a utility: bg-[#…], text-[rgb(…)], border-[oklch(…)] */
const ARBITRARY = new RegExp(
    `(?<![\\w-])(?:[a-z-]+:)*(?:${COLOUR_UTILITIES})-\\[(?:#|rgba?\\(|hsla?\\(|oklch\\(|oklab\\(|lab\\(|lch\\(|color\\()`,
    "g",
);
// `_` may precede a colour inside an arbitrary value (shadow-[0_0_4px_#fff])
const HEX = /(?<![A-Za-z0-9&-])#[0-9a-fA-F]{3,8}(?![\w-])/g;
/** a colour function anywhere inside an arbitrary value: shadow-[0_8px_rgb(0,0,0)] */
const IN_ARBITRARY = /\[[^\]\s"]*?[_[(](?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g;

test("the site's own code paints with palette roles only", () => {
    const found: string[] = [];
    for (const file of [...files("app"), ...files("components")]) {
        const lines = readFileSync(join(ROOT, file), "utf-8").split("\n");
        lines.forEach((line, index) => {
            for (const match of [
                ...line.matchAll(DEFAULT_UTILITY),
                ...line.matchAll(ARBITRARY),
                ...(file.endsWith(".css") ? [] : line.matchAll(IN_ARBITRARY)),
                ...(file.endsWith(".css") ? [] : line.matchAll(HEX)),
            ]) {
                found.push(
                    `${relative(ROOT, join(ROOT, file))}:${index + 1}: ${match[0]}`,
                );
            }
        });
    }
    expect(found).toEqual([]);
});
