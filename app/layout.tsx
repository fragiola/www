import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
    title: { default: "Fragiola", template: "%s · Fragiola" },
    description: "Fragiola: a component library, a layout manager, and more.",
};

// Theme: next-themes, key localStorage["theme"], emitted as both the .dark
// class (Fumadocs UI) and data-theme (Fragiola's palettes). The examples
// apps in the iframes read the same key and follow the `storage` event —
// that is the "site export" contract's theme half.
//
// Search is static: app/api/search is exported as a file and queried in the
// browser.
export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="palette-surface flex min-h-screen flex-col">
                <RootProvider
                    search={{ options: { type: "static", api: "/api/search" } }}
                    theme={{
                        attribute: ["class", "data-theme"],
                        defaultTheme: "light",
                        enableSystem: true,
                    }}
                >
                    {children}
                </RootProvider>
            </body>
        </html>
    );
}
