// Reads one page of an export (§3) the way the site compiles it: MDX with GFM, parsed into a
// syntax tree with positions, so every finding carries its line. Nothing is compiled or run.
// What comes out is what the validation needs: the frontmatter, the JSX tags and their props, the
// links, the heading anchors (the ids Fumadocs gives them), the fenced code blocks, and anything
// the vocabulary does not allow (import/export, expressions).

import { createProcessor } from "@mdx-js/mdx";
import type * as Estree from "estree";
import GithubSlugger from "github-slugger";
import type { Heading, Nodes, Root } from "mdast";
// the MDX node types (mdxJsxFlowElement, mdxjsEsm, mdxFlowExpression…) in mdast's node maps
import type {} from "mdast-util-mdx";
import type {
    MdxJsxAttribute,
    MdxJsxExpressionAttribute,
    MdxJsxFlowElement,
    MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import { toString as textOf } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { parse as parseYaml } from "yaml";

export interface Place {
    line: number;
    column?: number;
}

/** A prop as written: a string, a bare boolean, or an expression (evaluated when static). */
export type PropValue =
    | { kind: "string"; value: string }
    | { kind: "boolean" }
    | { kind: "expression"; source: string; static: boolean; value: unknown };

export interface Tag extends Place {
    name: string;
    props: Map<string, PropValue & Place>;
    /** `{...spread}` props, which the vocabulary does not take */
    spreads: Place[];
}

export interface Link extends Place {
    href: string;
    /** where the link comes from: "markdown", "definition", "<Card href>", "<Hero actions>" */
    via: string;
}

export interface Fence extends Place {
    lang: string | null;
    meta: string | null;
}

export interface PageScan {
    /** undefined when the page has no frontmatter block */
    frontmatter: Record<string, unknown> | undefined;
    problems: (Place & { message: string })[];
    tags: Tag[];
    links: Link[];
    anchors: Set<string>;
    fences: Fence[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

const processor = createProcessor({ remarkPlugins: [remarkGfm] });

/** Replaces the frontmatter block with as many empty lines, so positions stay the file's. */
function splitFrontmatter(source: string): {
    yaml: string | undefined;
    body: string;
} {
    const match = FRONTMATTER.exec(source);
    if (!match) return { yaml: undefined, body: source };
    const blank = "\n".repeat(match[0].split("\n").length - 1);
    return {
        yaml: match[1] ?? "",
        body: blank + source.slice(match[0].length),
    };
}

/** A static value from an estree expression (literals, arrays, objects), or `undefined` + false. */
function evaluate(node: Estree.Node): { static: boolean; value: unknown } {
    const fail = { static: false, value: undefined };
    switch (node.type) {
        case "Literal":
            return { static: true, value: node.value };
        case "TemplateLiteral":
            return node.expressions.length === 0
                ? {
                      static: true,
                      value: node.quasis.map((q) => q.value.cooked).join(""),
                  }
                : fail;
        case "UnaryExpression": {
            const inner = evaluate(node.argument);
            if (!inner.static || typeof inner.value !== "number") return fail;
            if (node.operator === "-")
                return { static: true, value: -inner.value };
            if (node.operator === "+")
                return { static: true, value: inner.value };
            return fail;
        }
        case "ArrayExpression": {
            const items: unknown[] = [];
            for (const element of node.elements) {
                if (!element || element.type === "SpreadElement") return fail;
                const item = evaluate(element);
                if (!item.static) return fail;
                items.push(item.value);
            }
            return { static: true, value: items };
        }
        case "ObjectExpression": {
            const object: Record<string, unknown> = {};
            for (const property of node.properties) {
                if (property.type !== "Property" || property.computed)
                    return fail;
                const key =
                    property.key.type === "Identifier"
                        ? property.key.name
                        : property.key.type === "Literal"
                          ? String(property.key.value)
                          : undefined;
                if (key === undefined) return fail;
                const value = evaluate(property.value);
                if (!value.static) return fail;
                object[key] = value.value;
            }
            return { static: true, value: object };
        }
        default:
            return fail;
    }
}

/** The single expression of an attribute or a `{…}` block, from its estree program. */
function expressionOf(program: unknown): Estree.Expression | undefined {
    const body = (program as Estree.Program | undefined)?.body;
    const [statement] = body ?? [];
    return statement?.type === "ExpressionStatement"
        ? statement.expression
        : undefined;
}

function placeOf(node: { position?: Nodes["position"] }): Place {
    return {
        line: node.position?.start.line ?? 1,
        column: node.position?.start.column,
    };
}

/** Fumadocs' heading id: a trailing `[#id]`, else github-slugger over the heading's text. */
function headingId(heading: Heading, slugger: GithubSlugger): string {
    const text = textOf(heading);
    const custom = /\s*\[#([^\]]+)\]\s*$/.exec(text);
    if (custom?.[1]) return custom[1];
    return slugger.slug(text);
}

function readProps(
    element: MdxJsxFlowElement | MdxJsxTextElement,
): Pick<Tag, "props" | "spreads"> {
    const props = new Map<string, PropValue & Place>();
    const spreads: Place[] = [];
    for (const attribute of element.attributes as (
        | MdxJsxAttribute
        | MdxJsxExpressionAttribute
    )[]) {
        const place = attribute.position
            ? placeOf(attribute)
            : placeOf(element);
        if (attribute.type === "mdxJsxExpressionAttribute") {
            spreads.push(place);
            continue;
        }
        const { value } = attribute;
        if (value === null || value === undefined) {
            props.set(attribute.name, { kind: "boolean", ...place });
        } else if (typeof value === "string") {
            props.set(attribute.name, { kind: "string", value, ...place });
        } else {
            const expression = expressionOf(value.data?.estree);
            const result = expression
                ? evaluate(expression)
                : { static: false, value: undefined };
            props.set(attribute.name, {
                kind: "expression",
                source: value.value,
                ...result,
                ...place,
            });
        }
    }
    return { props, spreads };
}

/** Links inside a static `actions` array: `[{ label, href }]`, each with the line of its object. */
function actionLinks(
    element: MdxJsxFlowElement | MdxJsxTextElement,
    fallback: Place,
): Link[] {
    const links: Link[] = [];
    for (const attribute of element.attributes) {
        if (
            attribute.type !== "mdxJsxAttribute" ||
            attribute.name !== "actions" ||
            typeof attribute.value !== "object" ||
            attribute.value === null
        ) {
            continue;
        }
        const expression = expressionOf(attribute.value.data?.estree);
        if (expression?.type !== "ArrayExpression") continue;
        for (const element of expression.elements) {
            if (element?.type !== "ObjectExpression") continue;
            const value = evaluate(element);
            const href = (value.value as { href?: unknown } | undefined)?.href;
            if (typeof href !== "string") continue;
            links.push({
                href,
                via: "<Hero actions>",
                line: element.loc?.start.line ?? fallback.line,
                column:
                    element.loc?.start.column === undefined
                        ? undefined
                        : element.loc.start.column + 1,
            });
        }
    }
    return links;
}

/** Scans one page. Never throws: a syntax error is a problem with its line. */
export function scanPage(source: string): PageScan {
    const scan: PageScan = {
        frontmatter: undefined,
        problems: [],
        tags: [],
        links: [],
        anchors: new Set(),
        fences: [],
    };
    const { yaml, body } = splitFrontmatter(source);
    if (yaml !== undefined) {
        try {
            const data = parseYaml(yaml) as unknown;
            if (data === null || data === undefined) scan.frontmatter = {};
            else if (typeof data === "object" && !Array.isArray(data)) {
                scan.frontmatter = data as Record<string, unknown>;
            } else {
                scan.problems.push({
                    line: 1,
                    message: "the frontmatter is not a map of fields",
                });
                scan.frontmatter = {};
            }
        } catch (error) {
            const line =
                (error as { linePos?: { line: number }[] }).linePos?.[0]
                    ?.line ?? 0;
            scan.problems.push({
                line: line + 1,
                message: `the frontmatter is not valid YAML: ${(error as Error).message.split("\n")[0]}`,
            });
            scan.frontmatter = {};
        }
    }

    let tree: Root;
    try {
        tree = processor.parse(body) as Root;
    } catch (error) {
        // a VFileMessage: where micromark stopped, else the position its message names
        // ("Expected a closing tag for `<Callout>` (27:1-27:22)")
        const message = (error as Error).message;
        const named = /\((\d+):(\d+)(?:-\d+:\d+)?\)/.exec(message);
        const { line, column } = error as { line?: number; column?: number };
        scan.problems.push({
            line: line ?? (named ? Number(named[1]) : 1),
            column: column ?? (named ? Number(named[2]) : undefined),
            message: `MDX does not parse: ${(error as Error).message.split("\n")[0]}`,
        });
        return scan;
    }

    const slugger = new GithubSlugger();
    visit(tree, (node: Nodes) => {
        switch (node.type) {
            case "heading":
                scan.anchors.add(headingId(node, slugger));
                break;
            case "link":
                scan.links.push({
                    href: node.url,
                    via: "markdown",
                    ...placeOf(node),
                });
                break;
            case "definition":
                scan.links.push({
                    href: node.url,
                    via: "definition",
                    ...placeOf(node),
                });
                break;
            case "code":
                scan.fences.push({
                    lang: node.lang ?? null,
                    meta: node.meta ?? null,
                    ...placeOf(node),
                });
                break;
            case "mdxjsEsm":
                scan.problems.push({
                    ...placeOf(node),
                    message:
                        "import/export is not allowed: pages use the v1 vocabulary only (§3.4)",
                });
                break;
            case "mdxFlowExpression":
            case "mdxTextExpression": {
                const program = node.data?.estree as Estree.Program | undefined;
                if (program && program.body.length > 0) {
                    scan.problems.push({
                        ...placeOf(node),
                        message: `the expression {${node.value.trim()}} is not allowed: only {/* comments */}`,
                    });
                }
                break;
            }
            case "mdxJsxFlowElement":
            case "mdxJsxTextElement": {
                const place = placeOf(node);
                if (node.name === null) {
                    scan.problems.push({
                        ...place,
                        message: "fragments (<>…</>) are not allowed",
                    });
                    break;
                }
                scan.tags.push({
                    name: node.name,
                    ...place,
                    ...readProps(node),
                });
                if (node.name === "Card") {
                    const href = node.attributes.find(
                        (a): a is MdxJsxAttribute =>
                            a.type === "mdxJsxAttribute" && a.name === "href",
                    );
                    if (typeof href?.value === "string") {
                        scan.links.push({
                            href: href.value,
                            via: "<Card href>",
                            ...(href.position ? placeOf(href) : place),
                        });
                    }
                }
                if (node.name === "Hero") {
                    scan.links.push(...actionLinks(node, place));
                }
                break;
            }
        }
    });
    return scan;
}
