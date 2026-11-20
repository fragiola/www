import { Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// What a live section of the organization's landing shows where its example will be: the
// example's title and description over a skeleton, until the frame says ready. With `onRun`, the
// section does not hold the page's one example slot (live-slot.ts): a button takes it back.

export function LivePlaceholder({
    title,
    description,
    onRun,
}: {
    title: string;
    description: string;
    onRun?: () => void;
}) {
    return (
        <div
            data-testid={onRun ? "live-paused" : undefined}
            className="flex size-full flex-col gap-3 self-stretch p-6 text-start"
        >
            <span className="font-medium text-palette-accent/85 text-sm">
                {title}
            </span>
            <span className="text-palette-accent/85 text-xs">
                {description}
            </span>
            {onRun ? (
                <button
                    type="button"
                    onClick={onRun}
                    className="inline-flex h-8 w-fit items-center gap-2 rounded-md border border-palette-line bg-palette-soft/40 px-3 font-medium text-palette-contrast text-sm transition-colors hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring motion-reduce:transition-none"
                >
                    <Play aria-hidden className="size-3.5" />
                    Run it here
                </button>
            ) : null}
            <Skeleton className="mt-2 min-h-0 w-full flex-1" />
        </div>
    );
}
