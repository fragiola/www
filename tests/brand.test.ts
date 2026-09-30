import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { BRAND, faviconSvg, markSvg } from "../lib/brand.ts";

// The brand has no colour of its own: each value of lib/brand.ts is the sRGB of a token of
// Fragiola UI's theme as prepare:site vendors it (styles/fragiola/, so this runs after it, as
// `pnpm test` does in CI). When the palette moves in ../ui, this fails, and `pnpm brand:icons`
// draws the icons again. The icon files are the mark's vectors in those colours only, as
// lib/brand.ts draws them, and the rasters have the sizes the metadata declares.

const ROOT = join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf-8");

/** `--palette-<role>` of a palette in one theme, as written: `oklch(L C H)`. */
function token(
    palette: string,
    theme: "light" | "dark",
    role: string,
): [number, number, number] {
    const css = read(`styles/fragiola/palettes/${palette}.css`);
    const block = new RegExp(
        `:root\\[data-theme="${theme}"\\] \\.palette-${palette}\\s*\\{([^}]*)\\}`,
    ).exec(css)?.[1];
    const value = new RegExp(
        `--palette-${role}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`,
    ).exec(block ?? "");
    if (!value) throw new Error(`no ${palette} ${theme} ${role} token`);
    return [Number(value[1]), Number(value[2]), Number(value[3])];
}

/** OKLCH → sRGB, 0–255 per channel (Björn Ottosson's OKLab matrices, clipped to the gamut). */
function oklchToRgb([L, C, H]: [number, number, number]): number[] {
    const h = (H * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const linear = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    return linear.map((channel) => {
        const x = Math.min(1, Math.max(0, channel));
        const gamma =
            x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
        return Math.round(gamma * 255);
    });
}

const hexToRgb = (hex: string) =>
    [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));

/** Each brand colour and the token it is. */
const TOKENS: Record<
    keyof typeof BRAND,
    [palette: string, theme: "light" | "dark", role: string]
> = {
    purple: ["purple", "light", "base"],
    purpleDark: ["purple", "dark", "base"],
    surface: ["surface", "light", "base"],
    surfaceDark: ["surface", "dark", "base"],
    contrastDark: ["surface", "dark", "contrast"],
    accentDark: ["surface", "dark", "accent"],
    lineDark: ["surface", "dark", "line"],
};

describe("the brand's colours are Fragiola UI's tokens", () => {
    for (const [name, [palette, theme, role]] of Object.entries(TOKENS)) {
        test(`${name}: palette-${palette} --palette-${role} (${theme})`, () => {
            const expected = oklchToRgb(token(palette, theme, role));
            const actual = hexToRgb(BRAND[name as keyof typeof BRAND]);
            actual.forEach((channel, index) => {
                expect(
                    Math.abs(channel - (expected[index] ?? -9)),
                ).toBeLessThanOrEqual(1);
            });
        });
    }
});

describe("the icon files", () => {
    const svgs = ["public/brand/fragiola-mark.svg", "app/icon.svg"];

    test("are the mark as lib/brand.ts draws it (pnpm brand:icons)", () => {
        expect(read("public/brand/fragiola-mark.svg")).toBe(markSvg());
        expect(read("app/icon.svg")).toBe(faviconSvg());
    });

    test("are vectors only, in the brand's colours only", () => {
        const colours = new Set<string>(Object.values(BRAND));
        for (const file of svgs) {
            const svg = read(file);
            expect(svg, file).not.toMatch(
                /<image|base64|<filter|Gradient|stroke/,
            );
            for (const [hex] of svg.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
                expect(colours, `${file}: ${hex}`).toContain(hex);
            }
            expect(svg, file).not.toMatch(/rgb\(|hsl\(|oklch\(/);
        }
        // the favicon follows the browser's scheme: the light base, then the dark one
        expect(read("app/icon.svg")).toContain(
            `.mark{fill:${BRAND.purple}}@media (prefers-color-scheme:dark){.mark{fill:${BRAND.purpleDark}}}`,
        );
    });

    test("have the sizes the metadata and the manifest declare", () => {
        const png = (file: string) => {
            const bytes = readFileSync(join(ROOT, file));
            expect(bytes.subarray(1, 4).toString("latin1"), file).toBe("PNG");
            return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
        };
        expect(png("app/apple-icon.png")).toEqual([180, 180]);
        expect(png("public/brand/icon-192.png")).toEqual([192, 192]);
        expect(png("public/brand/icon-512.png")).toEqual([512, 512]);
        expect(png("public/brand/icon-maskable-512.png")).toEqual([512, 512]);
        expect(png("public/brand/fragiola-mark-512.png")).toEqual([512, 512]);

        const ico = readFileSync(join(ROOT, "app/favicon.ico"));
        expect(ico.readUInt16LE(2)).toBe(1);
        const count = ico.readUInt16LE(4);
        const sizes = Array.from({ length: count }, (_, index) =>
            ico.readUInt8(6 + 16 * index),
        );
        expect(sizes).toEqual([16, 32, 48]);
    });
});
