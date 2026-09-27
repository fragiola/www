import { Callout as FumadocsCallout } from "fumadocs-ui/components/callout";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Example } from "@/components/example";
import { Framework } from "@/components/framework";
import { InstallCommand } from "@/components/install-command";

// The v0 MDX vocabulary, and nothing else: Example, Callout, Tabs/Tab,
// InstallCommand, Framework. The exports check their pages against the same
// list, so a component outside it never reaches the site.

const CALLOUT_TYPES = { info: "info", warn: "warn", danger: "error" } as const;

function Callout({
    type = "info",
    children,
    ...props
}: Omit<ComponentProps<typeof FumadocsCallout>, "type"> & {
    type?: keyof typeof CALLOUT_TYPES;
    children?: ReactNode;
}) {
    return (
        <FumadocsCallout type={CALLOUT_TYPES[type]} {...props}>
            {children}
        </FumadocsCallout>
    );
}

// Links to a project's examples app or to the registry leave the Next app:
// a plain <a>, or the router would prefetch and client-navigate a route
// that does not exist.
const OUTSIDE_APP = /^\/(r\/|[^/]+\/examples\/)/;

function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
    if (props.href && OUTSIDE_APP.test(props.href)) return <a {...props} />;
    return <defaultMdxComponents.a {...props} />;
}

export function getMDXComponents(project?: string, components?: MDXComponents) {
    return {
        ...defaultMdxComponents,
        a: Link,
        Callout,
        Tabs,
        Tab,
        InstallCommand,
        Framework,
        Example: (props: Omit<ComponentProps<typeof Example>, "project">) => {
            if (!project) throw new Error("<Example> outside a project page");
            return <Example project={project} {...props} />;
        },
        ...components,
    } satisfies MDXComponents;
}

export function useMDXComponents(components?: MDXComponents) {
    return getMDXComponents(undefined, components);
}
