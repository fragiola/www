import { Callout as FumadocsCallout } from "fumadocs-ui/components/callout";
import { Cards, Card as FumadocsCard } from "fumadocs-ui/components/card";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Example } from "@/components/example";
import { Framework } from "@/components/framework";
import { InstallCommand } from "@/components/install-command";
import { Feature, Features } from "@/components/landing/features";
import { Hero, type HeroAction } from "@/components/landing/hero";
import { Pills } from "@/components/landing/pills";
import { Section } from "@/components/landing/section";
import { isAppRoute, siteHref } from "@/lib/contract/links";
import { LABEL_TOKEN } from "@/lib/contract/types";
import { getGallery, getProject, installCommand } from "@/lib/projects";

// The vocabulary (§3.4, v1.1), and nothing else: Example, Callout, Tabs/Tab, Steps/Step,
// Cards/Card, InstallCommand, Framework, and for the landing Hero, Section, Features/Feature,
// Pills; plus Markdown with GFM and titled code blocks. The build checks every page against the
// same list before it compiles one (lib/contract/validate.ts), so a component outside it never
// reaches the site.
//
// Links are written base-free (§3.3) and served under /<slug>: every href goes through
// siteHref(). A link inside the Next app navigates client-side; a file (the registry, an embed)
// is a plain <a>. An action label's {examples} is the project's example count.

const CALLOUT_TYPES = { info: "info", warn: "warn", danger: "error" } as const;

function Callout({
    type = "info",
    title,
    children,
}: {
    type?: keyof typeof CALLOUT_TYPES;
    title?: string;
    children?: ReactNode;
}) {
    return (
        <FumadocsCallout type={CALLOUT_TYPES[type]} title={title}>
            {children}
        </FumadocsCallout>
    );
}

export function getMDXComponents(slug?: string, components?: MDXComponents) {
    const href = (value: string | undefined) =>
        value === undefined || slug === undefined
            ? value
            : siteHref(slug, value);

    const withTokens = (label: string) =>
        label.replace(LABEL_TOKEN, (token, name: string) => {
            const project = slug === undefined ? undefined : getProject(slug);
            return name === "examples" && project
                ? String(getGallery(project).examples.length)
                : token;
        });

    function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
        const target = href(props.href);
        if (target && !isAppRoute(target) && !target.startsWith("#")) {
            return <a {...props} href={target} />;
        }
        return <defaultMdxComponents.a {...props} href={target} />;
    }

    return {
        ...defaultMdxComponents,
        a: Link,
        Callout,
        Tabs,
        Tab,
        Steps,
        Step,
        Cards,
        Card: ({ href: to, ...props }: ComponentProps<typeof FumadocsCard>) => (
            <FumadocsCard {...props} href={href(to)} />
        ),
        Framework,
        Hero: ({ actions, ...props }: ComponentProps<typeof Hero>) => (
            <Hero
                {...props}
                actions={actions?.map(
                    (action): HeroAction => ({
                        ...action,
                        label: withTokens(action.label),
                        href: href(action.href) ?? action.href,
                    }),
                )}
            />
        ),
        Section,
        Features,
        Feature,
        Pills,
        InstallCommand: ({ item }: { item: string }) => (
            <InstallCommand command={installCommand([item])} />
        ),
        Example: (props: Omit<ComponentProps<typeof Example>, "project">) => {
            if (!slug) throw new Error("<Example> outside a project page");
            return <Example project={slug} {...props} />;
        },
        ...components,
    } satisfies MDXComponents;
}

export function useMDXComponents(components?: MDXComponents) {
    return getMDXComponents(undefined, components);
}
