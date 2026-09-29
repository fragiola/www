import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { isAppRoute } from "@/lib/contract/links";
import type { ActionIcon, ActionVariant } from "@/lib/contract/types";

// A landing call to action (§3.4, `Action`): a link that looks like a button, after Fragiola UI's
// Clickable: `primary` is the solid button in `palette-blue`, `secondary` the outline one,
// `ghost` the bare one. `href` is already a site URL here; an https:// URL opens as external.

const base =
    "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md px-5 font-medium text-sm transition-[background-color,border-color,color,box-shadow,translate] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring motion-reduce:transition-none [&_svg]:size-4 [&_svg]:transition-transform hover:[&_svg]:translate-x-0.5 rtl:hover:[&_svg]:-translate-x-0.5 motion-reduce:hover:[&_svg]:translate-x-0";

// primary: the palette's own colour, lit from within (an inset highlight) and glowing in it
// (a shadow painted by the same palette's base), its transparent border drawn in forced colours;
// secondary: glass over the page; ghost: bare.
const VARIANTS: Record<ActionVariant, string> = {
    primary:
        "palette-blue border border-transparent bg-palette-base text-palette-contrast shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--palette-contrast)_25%,transparent),0_8px_24px_-8px_var(--palette-base)] hover:-translate-y-px hover:bg-palette-base-hover motion-reduce:hover:translate-y-0",
    secondary:
        "border border-palette-line bg-palette-soft/40 text-palette-contrast backdrop-blur-sm hover:border-palette-ring/60 hover:bg-palette-soft",
    ghost: "bg-transparent text-palette-accent hover:bg-palette-soft hover:text-palette-contrast",
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
