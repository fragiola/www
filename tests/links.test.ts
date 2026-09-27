import { describe, expect, test } from "vitest";
import { isAppRoute, parseLink, siteHref } from "../lib/contract/links.ts";

// §3.3: pages link base-free; the site serves them under /<slug>.

describe("siteHref", () => {
    test.each([
        ["/docs/guides/tabs#anchor", "/dockable/docs/guides/tabs/#anchor"],
        ["/docs/guides/tabs/", "/dockable/docs/guides/tabs/"],
        ["/examples/add-tabs", "/dockable/examples/add-tabs/"],
        ["/examples", "/dockable/examples/"],
        ["/", "/dockable/"],
        ["/#what-it-ships", "/dockable/#what-it-ships"],
        ["#anchor", "#anchor"],
        ["https://github.com/fragiola", "https://github.com/fragiola"],
        ["mailto:hello@fragiola.com", "mailto:hello@fragiola.com"],
    ])("%s → %s", (href, expected) => {
        expect(siteHref("dockable", href)).toBe(expected);
    });
});

describe("parseLink refuses what is not base-free", () => {
    test.each([
        "../x.mdx",
        "guides/tabs",
        "/dockable/docs/x",
        "/docs/x.mdx",
        "/r/cn.json",
        "/docs/x?tab=1",
    ])("%s", (href) => {
        expect(parseLink(href).kind).toBe("invalid");
    });
});

test("isAppRoute: files leave the Next app", () => {
    expect(isAppRoute("/dockable/docs/x/")).toBe(true);
    expect(isAppRoute("/dockable/examples/x/")).toBe(true);
    expect(isAppRoute("/r/cn.json")).toBe(false);
    expect(isAppRoute("/dockable/embed/react/index.html")).toBe(false);
    expect(isAppRoute("https://github.com")).toBe(false);
});
