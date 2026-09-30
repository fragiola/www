// The Fragiola mark and the few colours the brand needs outside CSS: the icons, the manifest,
// `theme-color` and the share images. There is no brand colour of its own: each one is the sRGB
// of a token of Fragiola UI's theme, as prepare:site vendors it (styles/fragiola/palettes/), and
// tests/brand.test.ts fails when the palette moves. `pnpm brand:icons` (scripts/brand-icons.ts)
// draws every icon file from what is here. Shared by the site and the scripts (erasable syntax).

export const BRAND = {
    /** palette-purple `--palette-base`, light: oklch(0.55 0.2 300) */
    purple: "#864ad2",
    /** palette-purple `--palette-base`, dark: oklch(0.7 0.18 300) */
    purpleDark: "#b180fc",
    /** palette-surface `--palette-base`, light: oklch(1 0 0) */
    surface: "#ffffff",
    /** palette-surface `--palette-base`, dark: oklch(0.15 0.01 250) */
    surfaceDark: "#080c0f",
    /** palette-surface `--palette-contrast`, dark: oklch(0.95 0.005 250) (the share cards' text) */
    contrastDark: "#eceff2",
    /** palette-surface `--palette-accent`, dark: oklch(0.88 0.005 250) (their secondary text) */
    accentDark: "#d5d8db",
    /** palette-surface `--palette-line`, dark: oklch(0.31 0.012 250) (their rules) */
    lineDark: "#2c3136",
} as const;

/**
 * The mark: three rounded bars, left-aligned and stacked like an "F", in the units of its own
 * box. Recreated from the original drawing (its alpha mask overlaps this one's with an IoU of
 * 0.983 at 200 px): the top bar is taller, the gaps are equal, one radius.
 */
export const MARK = {
    width: 67,
    height: 81,
    radius: 9.5,
    bars: [
        { y: 0, width: 67, height: 26 },
        { y: 30, width: 40, height: 23 },
        { y: 57, width: 25, height: 24 },
    ],
} as const;

/** The mark's bars as SVG `<rect>`s, in the mark's units, filled or not (a stylesheet fills). */
export function markRects(fill?: string): string {
    return MARK.bars
        .map(
            (bar) =>
                `<rect y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="${MARK.radius}"${fill ? ` fill="${fill}"` : ""}/>`,
        )
        .join("");
}

/** The mark alone, on a transparent background, its viewBox tight around it. */
export function markSvg(fill: string = BRAND.purple): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK.width} ${MARK.height}">${markRects(fill)}</svg>\n`;
}

/**
 * A square with the mark centred in it: `scale` is the share of the side the mark's height
 * takes. `background` fills the square (else transparent); `schemes` follows the browser's
 * colour scheme with a stylesheet (the favicon) instead of one fill.
 */
export function squareSvg({
    scale,
    fill = BRAND.purple,
    background,
    schemes = false,
}: {
    scale: number;
    fill?: string;
    background?: string;
    schemes?: boolean;
}): string {
    const side = MARK.height / scale;
    const x = (side - MARK.width) / 2;
    const y = (side - MARK.height) / 2;
    const round = (n: number) => Number(n.toFixed(3));
    // the bars sit in a group the fill (or the stylesheet) paints, apart from the backdrop
    const style = schemes
        ? `<style>.mark{fill:${BRAND.purple}}@media (prefers-color-scheme:dark){.mark{fill:${BRAND.purpleDark}}}</style>`
        : "";
    const back = background
        ? `<rect x="${round(-x)}" y="${round(-y)}" width="${round(side)}" height="${round(side)}" fill="${background}"/>`
        : "";
    const group = schemes ? '<g class="mark">' : `<g fill="${fill}">`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(-x)} ${round(-y)} ${round(side)} ${round(side)}">${style}${back}${group}${markRects()}</g></svg>\n`;
}

/** The favicon (app/icon.svg): 85 units for the mark's 81, a thin margin, so it reads at 16 px;
 * purple for the browser's colour scheme. */
export function faviconSvg(fill?: string): string {
    return squareSvg({
        scale: MARK.height / 85,
        ...(fill ? { fill } : { schemes: true }),
    });
}
