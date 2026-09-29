import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { frameworkName } from "@/lib/frameworks";
import { siteHeader } from "@/lib/layout.shared";
import { firstExampleUrl, firstPageUrl, getProjects } from "@/lib/projects";

// The organization's landing: every project of projects.json, from its own project.json.

export default function Home() {
    const projects = getProjects();
    return (
        <>
            <SiteHeader {...siteHeader()} />
            <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
                <header className="flex flex-col gap-3">
                    <h1 className="font-semibold text-4xl tracking-tight">
                        Fragiola
                    </h1>
                    <p className="max-w-2xl text-fd-muted-foreground text-lg">
                        Open-source building blocks for web apps: a component
                        library, a layout manager, and more to come. Every
                        project, its docs and its live examples, on one site.
                    </p>
                </header>
                <ul aria-label="Projects" className="grid gap-4 sm:grid-cols-2">
                    {projects.map((project) => {
                        const examples = firstExampleUrl(project);
                        return (
                            <li
                                key={project.slug}
                                data-project={project.slug}
                                className="flex flex-col gap-3 rounded-lg border border-fd-border p-6"
                            >
                                <Link
                                    href={`/${project.slug}/`}
                                    className="font-medium text-xl hover:underline"
                                >
                                    {project.title}
                                </Link>
                                <p className="text-fd-muted-foreground text-sm">
                                    {project.description}
                                </p>
                                <p className="text-fd-muted-foreground text-xs">
                                    {project.frameworks
                                        .map(frameworkName)
                                        .join(" · ")}
                                </p>
                                <div className="mt-auto flex gap-3 pt-2 text-sm">
                                    <Link
                                        href={firstPageUrl(project)}
                                        className="underline-offset-4 hover:underline"
                                    >
                                        Docs
                                    </Link>
                                    {examples ? (
                                        <Link
                                            href={`/${project.slug}/examples/`}
                                            className="underline-offset-4 hover:underline"
                                        >
                                            Examples
                                        </Link>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </main>
        </>
    );
}
