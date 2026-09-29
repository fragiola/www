import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
    title: { default: "Fragiola", template: "%s · Fragiola" },
    description:
        "Fragiola: headless components, and Fragiola UI, an optional design system.",
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
