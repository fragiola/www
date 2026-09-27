import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { baseOptions } from "@/lib/layout.shared";
import { firstPageUrl, getProject, getProjects } from "@/lib/projects";

type Props = { params: Promise<{ project: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
    return getProjects().map((project) => ({ project: project.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const project = getProject((await params).project);
    return project
        ? { title: project.title, description: project.description }
        : {};
}

export default async function ProjectHome({ params }: Props) {
    const project = getProject((await params).project);
    if (!project) notFound();
    return (
        <HomeLayout {...baseOptions()}>
            <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-16">
                <h1 className="font-semibold text-4xl">{project.title}</h1>
                <p className="text-fd-muted-foreground text-lg">
                    {project.description}
                </p>
                <Link
                    href={firstPageUrl(project)}
                    className="self-start rounded-md bg-fd-primary px-4 py-2 font-medium text-fd-primary-foreground text-sm"
                >
                    Read the docs
                </Link>
            </main>
        </HomeLayout>
    );
}
