import Link from "next/link";
import { cn } from "@/lib/cn";
import { frameworkName } from "@/lib/frameworks";
import type { ExampleVariant } from "@/lib/projects";

// An example the site-wide framework (AGENTS.md rule 7) does not have: it says so, never
// disappears. A docs page's <Example> and the home page's carousel show it.

/** An example the chosen framework does not have: it says so, and links to one that has it. */
export function MissingFramework({
    slug,
    id,
    framework,
    variants,
    className,
}: {
    slug: string;
    id: string;
    framework: string;
    variants: Record<string, ExampleVariant>;
    className?: string;
}) {
    const other = Object.keys(variants)[0];
    return (
        <div
            role="status"
            data-testid="missing-framework"
            data-example={id}
            className={cn(
                "not-prose rounded-lg border border-palette-line border-dashed p-4 text-palette-accent/85 text-sm",
                className,
            )}
        >
            {`This example is not available for ${frameworkName(framework)} yet.`}{" "}
            {other ? (
                <Link
                    href={`/${slug}/examples/${id}/?framework=${other}`}
                    className="underline"
                >
                    {`See it in ${frameworkName(other)}`}
                </Link>
            ) : null}
        </div>
    );
}
