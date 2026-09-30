// `pnpm brand:icons` — draws every icon of the site from the mark in lib/brand.ts, and writes
// them where Next's metadata conventions and the manifest look for them (committed files):
//
//   public/brand/fragiola-mark.svg        the mark, tight, light purple: the canonical asset
//   app/icon.svg                          the favicon: square, purple for the browser's scheme
//   app/favicon.ico                       16, 32 and 48 px, light purple, transparent
//   app/apple-icon.png                    180 px, the dark purple on the dark surface
//   public/brand/icon-192.png, -512.png   the manifest's `any` icons, transparent
//   public/brand/icon-maskable-512.png    the manifest's `maskable` icon, full bleed
//   public/brand/fragiola-mark-512.png    the Organization logo of the structured data
//
// The rasters come from Playwright's Chromium (already the e2e suite's browser): each SVG is
// drawn at its exact size and screenshotted with a transparent background. The ICO is a
// container of PNG payloads, packed here. The same machine gives the same bytes.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";
import { BRAND, faviconSvg, markSvg, squareSvg } from "../lib/brand.ts";

const ROOT = join(import.meta.dirname, "..");

function write(file: string, content: string | Uint8Array) {
    const path = join(ROOT, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`  ${file}`);
}

/** An ICO file holding PNG images (each entry: its size, 32 bpp, then the PNG as is). */
function ico(images: { size: number; png: Uint8Array }[]): Uint8Array {
    const header = Buffer.alloc(6 + 16 * images.length);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);
    let offset = header.length;
    images.forEach(({ size, png }, index) => {
        const entry = 6 + 16 * index;
        header.writeUInt8(size >= 256 ? 0 : size, entry);
        header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
        header.writeUInt8(0, entry + 2);
        header.writeUInt8(0, entry + 3);
        header.writeUInt16LE(1, entry + 4);
        header.writeUInt16LE(32, entry + 6);
        header.writeUInt32LE(png.length, entry + 8);
        header.writeUInt32LE(offset, entry + 12);
        offset += png.length;
    });
    return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

console.log("brand:icons");
write("public/brand/fragiola-mark.svg", markSvg(BRAND.purple));
write("app/icon.svg", faviconSvg());

const browser = await chromium.launch();
try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const raster = async (svg: string, size: number): Promise<Uint8Array> => {
        await page.setViewportSize({ width: size, height: size });
        const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
        await page.setContent(
            `<!doctype html><html><body style="margin:0;background:transparent"><img src="${src}" width="${size}" height="${size}" style="display:block"></body></html>`,
        );
        await page
            .locator("img")
            .evaluate((img) => (img as HTMLImageElement).decode());
        return page.screenshot({
            type: "png",
            omitBackground: true,
            clip: { x: 0, y: 0, width: size, height: size },
        });
    };

    const favicon = faviconSvg(BRAND.purple);
    const sizes: { size: number; png: Uint8Array }[] = [];
    // one after the other: every raster draws in the same page
    for (const size of [16, 32, 48]) {
        sizes.push({ size, png: await raster(favicon, size) });
    }
    write("app/favicon.ico", ico(sizes));
    const onDark = (scale: number) =>
        squareSvg({
            scale,
            fill: BRAND.purpleDark,
            background: BRAND.surfaceDark,
        });
    write("app/apple-icon.png", await raster(onDark(0.6), 180));
    const any = squareSvg({ scale: 0.85 });
    write("public/brand/icon-192.png", await raster(any, 192));
    write("public/brand/icon-512.png", await raster(any, 512));
    // the mark's box stays inside the maskable safe zone, a circle of 80% of the side
    write("public/brand/icon-maskable-512.png", await raster(onDark(0.5), 512));
    write(
        "public/brand/fragiola-mark-512.png",
        await raster(squareSvg({ scale: 0.8 }), 512),
    );
} finally {
    await browser.close();
}
