import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// The landings' one entrance: a class. The animation itself is CSS (app/globals.css,
// .landing-reveal): scroll-driven, only where supported and only without reduced motion, and
// never hidden by default. No JS, no observer.

export function Reveal({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return <div className={cn("landing-reveal", className)}>{children}</div>;
}
