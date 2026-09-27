import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { isAppRoute } from "@/lib/contract/links";
import type { ActionIcon, ActionVariant } from "@/lib/contract/types";

// A landing call to action (§3.4, `Action`): a link that looks like a button. The classes are
// Fragiola UI's Clickable (size md) so it reads like the ui landing's: `primary` is the solid
// button in `palette-blue`, `secondary` the outline one, `ghost` the bare one. `href` is already
// a site URL here; an https:// URL opens as external.

const base =
    "inline-flex h-control items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4";

const VARIANTS: Record<ActionVariant, string> = {
    primary:
        "palette-blue bg-palette-base text-palette-contrast hover:bg-palette-base-hover",
    secondary:
        "border border-palette-line bg-transparent text-palette-accent hover:bg-palette-soft",
    ghost: "bg-transparent text-palette-accent hover:bg-palette-soft",
};

export function ActionLink({
    label,
    href,
    variant,
    icon,
}: {
    label: string;
    href: string;
    variant: ActionVariant;
    icon?: ActionIcon;
}) {
    const className = cn(base, VARIANTS[variant]);
    const children = (
        <>
            {label}
            {icon === "arrow" ? (
                <ArrowRight aria-hidden className="rtl:rotate-180" />
            ) : icon === "external" ? (
                <ArrowUpRight aria-hidden className="rtl:-scale-x-100" />
            ) : null}
        </>
    );
    if (/^https:\/\//.test(href)) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                data-variant={variant}
                className={className}
            >
                {children}
            </a>
        );
    }
    return isAppRoute(href) ? (
        <Link href={href} data-variant={variant} className={className}>
            {children}
        </Link>
    ) : (
        <a href={href} data-variant={variant} className={className}>
            {children}
        </a>
    );
}
