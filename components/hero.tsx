import Link from "next/link";
import { cn } from "@/lib/cn";
import { isAppRoute } from "@/lib/contract/links";

// <Hero title description? actions?> (§3.4): the landing's header. The project owns the words
// and the links (already site URLs here); the site owns the layout.

export function Hero({
    title,
    description,
    actions = [],
}: {
    title: string;
    description?: string;
    actions?: { label: string; href: string }[];
}) {
    return (
        <header
            data-testid="hero"
            className="not-prose flex flex-col items-start gap-5 py-10 md:py-16"
        >
            <h1 className="max-w-3xl text-balance font-semibold text-4xl tracking-tight md:text-5xl">
                {title}
            </h1>
            {description ? (
                <p className="max-w-2xl text-balance text-fd-muted-foreground text-lg">
                    {description}
                </p>
            ) : null}
            {actions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {actions.map((action, index) => {
                        const className = cn(
                            "inline-flex h-10 items-center rounded-md px-4 font-medium text-sm transition-colors",
                            index === 0
                                ? "bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/85"
                                : "border border-fd-border hover:bg-fd-accent",
                        );
                        return isAppRoute(action.href) ? (
                            <Link
                                key={action.href}
                                href={action.href}
                                className={className}
                            >
                                {action.label}
                            </Link>
                        ) : (
                            <a
                                key={action.href}
                                href={action.href}
                                className={className}
                            >
                                {action.label}
                            </a>
                        );
                    })}
                </div>
            ) : null}
        </header>
    );
}
