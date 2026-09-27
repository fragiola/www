"use client";

import { useState } from "react";

// <InstallCommand item />: the shadcn CLI command for a registry item of the
// `@fragiola` namespace (served from /r/{name}.json).

export function InstallCommand({ item }: { item: string }) {
    const [copied, setCopied] = useState(false);
    const command = `npx shadcn@latest add @fragiola/${item}`;

    return (
        <div className="not-prose my-4 flex items-center gap-2 rounded-md border border-fd-border bg-fd-muted px-3 py-2">
            <code className="flex-1 font-mono text-fd-foreground text-sm">
                {command}
            </code>
            <button
                type="button"
                onClick={() => {
                    navigator.clipboard.writeText(command);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }}
                className="text-fd-muted-foreground text-xs transition-colors hover:text-fd-foreground"
            >
                {copied ? "Copied!" : "Copy"}
            </button>
        </div>
    );
}
