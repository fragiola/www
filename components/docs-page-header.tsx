import { DocsDescription, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { docsIcon } from "@/components/docs-icon";

// The top of a docs page: the sidebar section it is in as an eyebrow (with the section's icon,
// §3.1 v1.4), the title (the page's h1, §3.2) and the description as its lead, over a soft glow
// of the accent role. It replaces Fumadocs' breadcrumb, which only named the section.

export function DocsPageHeader({
    section,
    title,
    description,
}: {
    section?: { label: string; icon?: string };
    title: string;
    description?: string;
}) {
    return (
        <header data-docs-header="" className="docs-header relative isolate">
            <div aria-hidden className="docs-header-glow" />
            {section ? (
                <p
                    data-docs-eyebrow=""
                    className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-fd-primary/20 bg-fd-primary/8 px-2.5 py-0.5 font-medium text-fd-primary text-xs [&_svg]:size-3.5 [&_svg]:shrink-0"
                >
                    {docsIcon(section.icon)}
                    {section.label}
                </p>
            ) : null}
            <DocsTitle className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
                {title}
            </DocsTitle>
            <DocsDescription className="mt-3 mb-0 text-pretty text-lg leading-relaxed">
                {description}
            </DocsDescription>
            <div
                aria-hidden
                className="mt-8 h-px bg-linear-to-r from-fd-border via-fd-border to-transparent rtl:bg-linear-to-l"
            />
        </header>
    );
}
