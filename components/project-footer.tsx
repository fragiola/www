import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { docsHref } from "@/lib/contract/links";
import type { Project } from "@/lib/projects";

// A project's footer (§3.5, v1.1), on every page of the project's landing and docs: its title
// and description, the links of its first sidebar section, and its repository. The look is the
// ui landing's footer (ui/apps/www, components/landing/site-footer.tsx), painted through roles.

function FooterLink({
    href,
    external,
    children,
}: {
    href: string;
    external?: boolean;
    children: ReactNode;
}) {
    const className =
        "rounded-sm text-palette-accent/85 transition-colors hover:text-palette-contrast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring";
    return external ? (
        <a
            className={className}
            href={href}
            rel="noreferrer noopener"
            target="_blank"
        >
            {children}
        </a>
    ) : (
        <Link className={className} href={href}>
            {children}
        </Link>
    );
}

function FooterColumn({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <nav aria-label={title} className="flex flex-col gap-3">
            <span className="font-semibold text-palette-contrast text-xs uppercase tracking-wide">
                {title}
            </span>
            <ul className="flex list-none flex-col gap-2 p-0 text-sm">
                {children}
            </ul>
        </nav>
    );
}

export function ProjectFooter({
    project,
    className,
}: {
    project: Project;
    className?: string;
}) {
    const [first] = project.docs.sections;
    const repository = project.repository;
    return (
        <footer
            data-testid="project-footer"
            className={cn(
                "not-prose border-palette-line border-t bg-palette-base",
                className,
            )}
        >
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex max-w-xs flex-col gap-2">
                    <Link
                        href={`/${project.slug}/`}
                        className="font-semibold text-palette-contrast text-sm tracking-tight"
                    >
                        {project.title}
                    </Link>
                    <p className="text-palette-accent/85 text-sm">
                        {project.description}
                    </p>
                </div>
                <div className="flex flex-col gap-10 sm:flex-row sm:gap-16">
                    {first ? (
                        <FooterColumn title={first.label}>
                            {first.pages.map((entry) => (
                                <li key={entry.label}>
                                    {"path" in entry ? (
                                        <FooterLink
                                            href={docsHref(
                                                project.slug,
                                                entry.path,
                                            )}
                                        >
                                            {entry.label}
                                        </FooterLink>
                                    ) : (
                                        <FooterLink href={entry.href} external>
                                            {entry.label}
                                        </FooterLink>
                                    )}
                                </li>
                            ))}
                        </FooterColumn>
                    ) : null}
                    {repository ? (
                        <FooterColumn title="Project">
                            <li>
                                <FooterLink href={repository} external>
                                    {/^https:\/\/github\.com\//.test(repository)
                                        ? "GitHub"
                                        : "Repository"}
                                </FooterLink>
                            </li>
                        </FooterColumn>
                    ) : null}
                </div>
            </div>
            <div className="border-palette-line border-t">
                <p className="mx-auto w-full max-w-5xl px-6 py-6 text-palette-accent/85 text-xs">
                    {project.title} is part of{" "}
                    <FooterLink href="/">Fragiola</FooterLink>.
                </p>
            </div>
        </footer>
    );
}
