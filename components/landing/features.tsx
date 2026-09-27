import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// <Features columns? numbered?> / <Feature title> (§3.4): a grid of feature cards, as on the
// ui landing ("Three problems, three decisions") and the dockable one (four across). `numbered`
// prints 01, 02, … from a CSS counter (app/globals.css). Each card enters on scroll.

const COLUMNS = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
} as const;

export function Features({
    columns = 3,
    numbered = false,
    children,
}: {
    columns?: 2 | 3 | 4;
    numbered?: boolean;
    children?: ReactNode;
}) {
    return (
        <ul
            data-testid="features"
            data-columns={columns}
            data-numbered={numbered ? "" : undefined}
            className={cn(
                "landing-features not-prose my-8 grid list-none gap-4 p-0",
                COLUMNS[columns],
            )}
        >
            {children}
        </ul>
    );
}

export function Feature({
    title,
    children,
}: {
    title: string;
    children?: ReactNode;
}) {
    return (
        <li className="flex">
            <div className="landing-reveal palette-raised flex flex-1 flex-col gap-3 rounded-lg border border-palette-line bg-palette-base p-6 text-palette-contrast transition-colors hover:border-palette-ring">
                <span
                    data-feature-number
                    className="font-semibold text-palette-accent/85 text-xs"
                />
                <h3 className="font-semibold text-base text-palette-contrast">
                    {title}
                </h3>
                <div className="text-palette-accent/85 text-sm [&_code]:rounded-sm [&_code]:bg-palette-soft [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_p]:m-0 [&_p+p]:mt-2">
                    {children}
                </div>
            </div>
        </li>
    );
}
