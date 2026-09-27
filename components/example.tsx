import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { ExampleFrame } from "@/components/example-frame";
import { FrameworkSwitch } from "@/components/framework";
import { getExample, getProject } from "@/lib/projects";

// <Example id height? framework? />: an iframe on the project's examples app
// (`/<slug>/examples/<fw>/?id=<id>`) and a code panel from its manifest.
//
// Without `framework`, one variant is rendered per framework the project
// exports the example for, and the site's framework choice picks one.

export async function Example({
    project: slug,
    id,
    height,
    framework,
}: {
    project: string;
    id: string;
    height?: number;
    framework?: string;
}) {
    const project = getProject(slug);
    if (!project) throw new Error(`<Example>: unknown project "${slug}"`);
    const frameworks = framework ? [framework] : project.frameworks;

    const variants: Record<string, React.ReactNode> = {};
    for (const fw of frameworks) {
        const entry = getExample(slug, fw, id);
        if (!entry) continue;
        variants[fw] = (
            <div className="not-prose my-6 overflow-hidden rounded-md border border-fd-border">
                <ExampleFrame
                    id={id}
                    src={`/${slug}/examples/${fw}/?id=${encodeURIComponent(id)}`}
                    title={entry.title}
                    height={height ?? entry.height}
                />
                <details className="border-fd-border border-t">
                    <summary className="cursor-pointer select-none px-4 py-2 text-fd-muted-foreground text-xs hover:text-fd-foreground">
                        Show code
                    </summary>
                    <Tabs
                        items={entry.files.map((file) => file.path)}
                        className="my-0 rounded-none border-0 border-fd-border border-t"
                    >
                        {
                            await Promise.all(
                                entry.files.map(async (file) => (
                                    <Tab
                                        key={file.path}
                                        value={file.path}
                                        className="p-0"
                                    >
                                        <ServerCodeBlock
                                            code={file.content}
                                            lang={file.lang}
                                            codeblock={{
                                                allowCopy: true,
                                                className:
                                                    "my-0 rounded-none border-0",
                                            }}
                                        />
                                    </Tab>
                                )),
                            )
                        }
                    </Tabs>
                </details>
            </div>
        );
    }
    if (Object.keys(variants).length === 0) {
        throw new Error(`<Example id="${id}">: not in ${slug}'s manifest`);
    }
    return <FrameworkSwitch variants={variants} />;
}
