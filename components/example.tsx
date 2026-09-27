import { ExampleBlock } from "@/components/example-block";
import { getExample, getProject, themeSummaries } from "@/lib/projects";

// <Example id framework? theme? height? variant? label?> (§3.4), on the server: reads the example from
// the manifests and hands the client only what the embed and the code panel need. The export was
// validated before the build (the id exists, the theme and the framework are the project's).

export function Example({
    project: slug,
    id,
    framework,
    theme,
    height,
    variant = "inline",
    label,
}: {
    project: string;
    id: string;
    framework?: string;
    theme?: string;
    height?: number;
    variant?: "inline" | "bleed" | "card" | "showcase";
    label?: string;
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
            themes={themeSummaries(project).map(
                ({ name, title, description, scheme, swatch }) => ({
                    name,
                    title,
                    description,
                    scheme,
                    swatch,
                }),
            )}
            variant={variant}
            {...(label ? { label } : {})}
            {...(framework ? { framework } : {})}
            {...(theme ? { theme } : {})}
            {...(height ? { height } : {})}
        />
    );
}
