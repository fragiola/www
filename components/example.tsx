import { ExampleBlock } from "@/components/example-block";
import { getExample, getProject, themeSummaries } from "@/lib/projects";

// <Example id framework? theme? height? variant?> (§3.4), on the server: reads the example from
// the manifests and hands the client only what the embed and the code panel need. The export was
// validated before the build (the id exists, the theme and the framework are the project's).

export function Example({
    project: slug,
    id,
    framework,
    theme,
    height,
    variant = "inline",
}: {
    project: string;
    id: string;
    framework?: string;
    theme?: string;
    height?: number;
    variant?: "inline" | "bleed" | "card";
}) {
    const project = getProject(slug);
    const example = project && getExample(project, id);
    if (!project || !example) {
        throw new Error(`<Example id="${id}">: not in ${slug}'s manifests`);
    }
    return (
        <ExampleBlock
            slug={slug}
            id={id}
            variants={example.variants}
            themes={themeSummaries(project).map(({ name, scheme }) => ({
                name,
                scheme,
            }))}
            variant={variant}
            {...(framework ? { framework } : {})}
            {...(theme ? { theme } : {})}
            {...(height ? { height } : {})}
        />
    );
}
