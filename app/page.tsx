import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionLink } from "@/components/landing/action";
import { Feature, Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { Pills } from "@/components/landing/pills";
import { Section } from "@/components/landing/section";
import { SiteHeader } from "@/components/site-header";
import { frameworkName } from "@/lib/frameworks";
import { ORGANIZATION_URL, siteHeader } from "@/lib/layout.shared";
import {
    firstExampleUrl,
    firstPageUrl,
    getProject,
    getProjects,
    type Project,
} from "@/lib/projects";

// The organization's landing: what Fragiola is (headless components, and Fragiola UI, an
// optional design system), bringing your own styles, Fragiola UI itself, then every project of
// projects.json, from its own project.json. Built from the landing pieces every project's
// landing uses (components/landing/).
//
// The copy says only what exists today: the projects are read, never listed by hand, and no
// project is said to be styled by Fragiola UI unless it is.

const POSITIONING =
    "Fragiola is an ecosystem of headless components: primitives that own behaviour, state and accessibility, and ship no styles. Fragiola UI, an optional and malleable design system, gives them one visual identity — or paint them with whatever you already use.";

export const metadata: Metadata = {
    title: { absolute: "Fragiola — headless components, and a design system" },
    description: POSITIONING,
};

function ProjectCard({ project }: { project: Project }) {
    const examples = firstExampleUrl(project);
    return (
        <li
            data-project={project.slug}
            className="landing-reveal landing-card palette-raised group relative flex flex-col gap-4 overflow-hidden rounded-lg border border-palette-line bg-palette-base p-6 transition-[border-color,translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-palette-ring/50 hover:shadow-xl"
        >
            <div
                aria-hidden
                className="palette-purple absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-palette-base to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <div className="flex items-start justify-between gap-4">
                <Link
                    href={`/${project.slug}/`}
                    className="rounded-sm font-semibold text-palette-contrast text-xl tracking-tight after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-palette-ring"
                >
                    {project.title}
                </Link>
                <ArrowRight
                    aria-hidden
                    className="size-5 text-palette-accent/85 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                />
            </div>
            <p className="text-palette-accent/85 text-sm leading-relaxed">
                {project.description}
            </p>
            <p className="font-mono text-palette-accent/85 text-xs">
                {project.frameworks.map(frameworkName).join(" · ")}
            </p>
            {/* above the card's own link (its ::after covers the card) */}
            <div className="relative mt-auto flex gap-4 pt-2 text-sm">
                <Link
                    href={firstPageUrl(project)}
                    className="rounded-sm font-medium text-palette-accent/85 underline-offset-4 hover:text-palette-contrast hover:underline focus-visible:outline-2 focus-visible:outline-palette-ring"
                >
                    Docs
                </Link>
                {examples ? (
                    <Link
                        href={examples}
                        className="rounded-sm font-medium text-palette-accent/85 underline-offset-4 hover:text-palette-contrast hover:underline focus-visible:outline-2 focus-visible:outline-palette-ring"
                    >
                        Examples
                    </Link>
                ) : null}
            </div>
        </li>
    );
}

export default function Home() {
    const projects = getProjects();
    const ui = getProject("ui");
    return (
        <>
            <SiteHeader {...siteHeader()} />
            <main
                data-testid="landing"
                className="landing flex flex-1 flex-col pb-24"
            >
                <Hero
                    eyebrow="Headless components · an optional design system"
                    title="Headless components, and a design system when you want one."
                    description={POSITIONING}
                    background="grid"
                    actions={[
                        {
                            label: "Explore the projects",
                            href: "#projects",
                            variant: "primary",
                            icon: "arrow",
                        },
                        ...(ui
                            ? [
                                  {
                                      label: `Meet ${ui.title}`,
                                      href: `/${ui.slug}/`,
                                      variant: "secondary" as const,
                                  },
                              ]
                            : []),
                    ]}
                />

                <Section
                    eyebrow="The idea"
                    title="Two layers, and the second one is yours to choose"
                    description="Every Fragiola component is split the same way: what it does in one layer, how it looks in another. You always get the first. The second is a choice."
                >
                    <Features columns={2} numbered>
                        <Feature title="Headless primitives">
                            Behaviour, state and accessibility — keyboard
                            support, focus, ARIA — and no styles at all. A
                            primitive renders only what you give it and exposes
                            its state as data attributes and ARIA, so any
                            styling solution can paint it.
                        </Feature>
                        <Feature title="An optional design system">
                            Fragiola UI gives the primitives one visual
                            identity, and it bends: six colour roles, any number
                            of palettes, each scoped by a class to a page, a
                            card or a single button. Use it when you want it;
                            nothing depends on it.
                        </Feature>
                    </Features>
                </Section>

                <Section
                    eyebrow="Your stack"
                    title="Paint it with what you already use"
                    description="The primitives do not care who styles them. Pick the design system that fits your app, or none at all."
                >
                    <Pills
                        items={[
                            "Fragiola UI",
                            "shadcn/ui",
                            "daisyUI",
                            "Tailwind",
                            "Plain CSS",
                        ]}
                    />
                    <p className="text-palette-accent/85">
                        A state is a selector away: an open panel, a selected
                        tab, a dragged item are all attributes on the element,
                        ready for whichever CSS you write.
                    </p>
                </Section>

                {ui ? (
                    <Section
                        eyebrow="The design system"
                        title={ui.title}
                        description={ui.description}
                    >
                        <Features columns={3}>
                            <Feature title="Base UI and Tailwind v4">
                                Accessible building blocks from Base UI, painted
                                with Tailwind v4 utilities.
                            </Feature>
                            <Feature title="The code is yours">
                                Installed with the shadcn CLI from the{" "}
                                <code>
                                    {ui.registry?.namespace ?? "@fragiola"}
                                </code>{" "}
                                registry: the components are copied into your
                                app, to read and to change.
                            </Feature>
                            <Feature title="Colour you can scope">
                                Components read roles, never colours. A palette
                                applied by class repaints a page, a card or one
                                button, with no colour variant anywhere.
                            </Feature>
                        </Features>
                        <div className="not-prose flex flex-wrap items-center gap-3">
                            <ActionLink
                                label={`Explore ${ui.title}`}
                                href={`/${ui.slug}/`}
                                variant="primary"
                                icon="arrow"
                            />
                            <ActionLink
                                label="Read the docs"
                                href={firstPageUrl(ui)}
                                variant="secondary"
                            />
                        </div>
                    </Section>
                ) : null}

                <Section
                    id="projects"
                    eyebrow="Projects"
                    title="What Fragiola ships today"
                    description="Each project has its docs and its live examples here, on one site."
                >
                    <ul
                        aria-label="Projects"
                        className="not-prose grid list-none gap-4 p-0 sm:grid-cols-2"
                    >
                        {projects.map((project) => (
                            <ProjectCard key={project.slug} project={project} />
                        ))}
                    </ul>
                </Section>
            </main>
            <footer
                data-testid="site-footer"
                className="relative border-palette-line border-t"
            >
                <div
                    aria-hidden
                    className="palette-purple absolute inset-x-0 -top-px mx-auto h-px w-[min(40rem,100%)] bg-linear-to-r from-transparent via-palette-base to-transparent opacity-60"
                />
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-sm text-palette-accent/85 text-sm">
                        <span className="font-semibold text-palette-contrast">
                            Fragiola
                        </span>{" "}
                        — headless components, and a design system when you want
                        one.
                    </p>
                    <nav
                        aria-label="Fragiola"
                        className="flex flex-wrap gap-6 text-sm"
                    >
                        {projects.map((project) => (
                            <Link
                                key={project.slug}
                                href={`/${project.slug}/`}
                                className="rounded-sm text-palette-accent/85 transition-colors hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring"
                            >
                                {project.title}
                            </Link>
                        ))}
                        <a
                            href={ORGANIZATION_URL}
                            className="rounded-sm text-palette-accent/85 transition-colors hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring"
                        >
                            GitHub
                        </a>
                    </nav>
                </div>
            </footer>
        </>
    );
}
