import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/seo";
import "./globals.css";

// No title template: every page's title is whole, built by lib/seo.ts (a template would double
// a suffix, "Tabs · Fragiola UI · Fragiola"). The icons are Next's file conventions (favicon.ico,
// icon.svg, apple-icon.png, manifest.ts), drawn by `pnpm brand:icons`.
export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: BRAND.surface },
        { media: "(prefers-color-scheme: dark)", color: BRAND.surfaceDark },
    ],
};

// Theme: next-themes, key localStorage["theme"], emitted as both the .dark class (Fumadocs UI)
// and data-theme (Fragiola's palettes). The embeds never read it: the site resolves its theme
// (including "system") and passes each embed an explicit example theme (CONTRACT.md §5.1).
//
// Search is static: app/api/search is exported as a file and queried in the browser.
export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="palette-surface flex min-h-screen flex-col">
                <RootProvider
                    search={{
                        // the dialog (and Orama) load when it opens, not with every page
                        preload: false,
                        options: { type: "static", api: "/api/search" },
                    }}
                    theme={{
                        attribute: ["class", "data-theme"],
                        defaultTheme: "dark",
                        enableSystem: true,
                    }}
                >
                    {children}
                </RootProvider>
            </body>
        </html>
    );
}
