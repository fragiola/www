import type { ReactNode } from "react";

// /<slug>/create/ (contract v1.6, §5.5) exists for the projects whose project.json declares
// `create`, and for nothing else. The segment takes the projects of app/[project]/layout.tsx:
// every one, because `output: "export"` refuses a route whose generateStaticParams is empty (no
// project declares one until its export does). A project without `create` renders notFound()
// here, and scripts/build.ts removes that page from out/: it has no route, and no link to one.

/**
 * The whole viewport, and nothing scrolls the page: the project's app scrolls inside its frame.
 * No site header or footer: the app draws its own chrome, with its way back to the docs.
 */
export default function CreateLayout({ children }: { children: ReactNode }) {
    return <main className="h-dvh overflow-hidden">{children}</main>;
}
