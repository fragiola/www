import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vitest";

// The site is painted by Fragiola UI's palettes: every colour is a role (bg-palette-base,
// text-palette-accent/85, …), under a palette-* class when it must be chromatic. The theme resets
// --color-*, so a Tailwind default colour (bg-slate-900) renders nothing, silently, and a hex
// value ignores the theme. This walks the site's own code (not the components copied from ui's
// registry, which are ui's) for either.

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
const DEFAULT_UTILITY = new RegExp(
    `(?<![\\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|decoration|divide|placeholder|caret|accent)-(?:${DEFAULT_COLOURS})(?:-\\d{2,3})?(?![\\w-])`,
    "g",
);
const HEX = /(?<![\w&])#[0-9a-fA-F]{3,8}(?![\w-])/g;

test("the site's own code paints with palette roles only", () => {
    const found: string[] = [];
    for (const file of [...files("app"), ...files("components")]) {
        const lines = readFileSync(join(ROOT, file), "utf-8").split("\n");
        lines.forEach((line, index) => {
            for (const match of [
                ...line.matchAll(DEFAULT_UTILITY),
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
