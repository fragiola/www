import type { Nodes, Root } from "mdast";
// the MDX node types (mdxJsxFlowElement…) in mdast's node maps
import type {} from "mdast-util-mdx";

// A remark step of the site's MDX (source.config.ts): the heading level of a <Feature>'s title
// (§3.4). Under a <Section> it is an h3, below the section's h2; outside one (dockable's
// landing puts its Features right under the Hero) it is an h2, so the page's outline does not
// jump from the Hero's h1 to an h3. The vocabulary has no such prop: the step adds it after the
// checks, which read the page as written.

export function remarkFeatureHeadings() {
    return (tree: Root) => {
        const walk = (node: Nodes, inSection: boolean) => {
            if (!("children" in node)) return;
            for (const child of node.children as Nodes[]) {
                const name =
                    child.type === "mdxJsxFlowElement" ||
                    child.type === "mdxJsxTextElement"
                        ? child.name
                        : undefined;
                if (
                    name === "Feature" &&
                    !inSection &&
                    (child.type === "mdxJsxFlowElement" ||
                        child.type === "mdxJsxTextElement")
                ) {
                    child.attributes.push({
                        type: "mdxJsxAttribute",
                        name: "level",
                        value: "2",
                    });
                }
                walk(child, inSection || name === "Section");
            }
        };
        walk(tree, false);
    };
}
