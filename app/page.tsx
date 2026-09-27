import { HomeLayout } from "fumadocs-ui/layouts/home";
import Link from "next/link";
import { baseOptions } from "@/lib/layout.shared";
import { firstPageUrl, getProjects } from "@/lib/projects";

// A minimal landing: the projects, from their exports. The final design is
// out of the POC's scope.
export default function Home() {
    return (
        <HomeLayout {...baseOptions()}>
            <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
                <header className="flex flex-col gap-3">
                    <h1 className="font-semibold text-4xl">Fragiola</h1>
                    <p className="max-w-2xl text-fd-muted-foreground text-lg">
                        Open-source building blocks for React apps, one site.
                    </p>
                </header>
                <ul className="grid gap-4 sm:grid-cols-2">
                    {getProjects().map((project) => (
                        <li key={project.slug}>
                            <Link
                                href={firstPageUrl(project)}
                                className="flex h-full flex-col gap-2 rounded-lg border border-fd-border p-6 transition-colors hover:bg-fd-accent"
                            >
                                <span className="font-medium text-lg">
                                    {project.title}
                                </span>
                                <span className="text-fd-muted-foreground text-sm">
                                    {project.description}
                                </span>
                                <span className="mt-auto pt-2 text-fd-muted-foreground text-xs">
                                    {project.frameworks.join(" · ")}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </main>
        </HomeLayout>
    );
}
