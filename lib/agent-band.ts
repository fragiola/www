import type { Root, RootContent } from "mdast";
// the MDX node types (mdxJsxFlowElement…) in mdast's node maps
import type {} from "mdast-util-mdx";

// A remark step of the site's MDX (source.config.ts): the agent band (CONTRACT.md §3.5, v1.7,
// components/landing/agent-band.tsx) on every project's landing, once, right after its showcase
// <Example> (a top-level one: inside a <Section> it would split the section), else right after
// its <Hero>. The vocabulary has no <AgentBand>: a project cannot write it (the checks read the
// page as written and refuse it); the step adds it after them, so every landing has the same one.

export const AGENT_BAND_TAG = "AgentBand";

function isElement(node: RootContent, name: string) {
    return node.type === "mdxJsxFlowElement" && node.name === name;
}

function isShowcase(node: RootContent) {
    return (
        node.type === "mdxJsxFlowElement" &&
        node.name === "Example" &&
        node.attributes.some(
            (attribute) =>
                attribute.type === "mdxJsxAttribute" &&
                attribute.name === "variant" &&
                attribute.value === "showcase",
        )
    );
}

/**
 * Where the band goes among a page's top-level nodes: the index it is inserted at, or undefined
 * on a page with no <Hero> (the vocabulary allows one on the landing only, §3.4, so a page with
 * one is a landing; fumadocs' frontmatter schema does not keep `layout`).
 */
export function agentBandIndex(children: RootContent[]): number | undefined {
    const hero = children.findIndex((node) => isElement(node, "Hero"));
    if (hero < 0) return undefined;
    const showcase = children.findIndex(isShowcase);
    return (showcase >= 0 ? showcase : hero) + 1;
}

export function remarkAgentBand() {
    return (tree: Root) => {
        const index = agentBandIndex(tree.children);
        if (index === undefined) return;
        tree.children.splice(index, 0, {
            type: "mdxJsxFlowElement",
            name: AGENT_BAND_TAG,
            attributes: [],
            children: [],
        });
    };
}
