// Structured data (JSON-LD) in a page's static HTML: a server component, so the script is in the
// page's own output even inside the client-heavy docs and gallery layouts. The builders are in
// lib/seo.ts. `<` is escaped, so no text of a page (a title, a description) can close the tag.

export function JsonLd({ items }: { items: Record<string, unknown>[] }) {
    const json = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": items,
    }).replace(/</g, "\\u003c");
    return (
        <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON, escaped above
            dangerouslySetInnerHTML={{ __html: json }}
        />
    );
}
