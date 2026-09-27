"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// <InstallCommand item> (§3.4, §7): the shadcn CLI command for a registry item, namespaced with
// the project's registry (`npx shadcn@latest add @fragiola/<item>`), served from /r.

export function InstallCommand({ command }: { command: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div
            data-testid="install-command"
            className="not-prose my-4 flex items-center gap-2 rounded-md border border-fd-border bg-fd-muted px-3 py-2"
        >
            <code className="flex-1 overflow-x-auto whitespace-pre font-mono text-fd-foreground text-sm">
                {command}
            </code>
            <button
                type="button"
                aria-label={copied ? "Copied" : "Copy the command"}
                onClick={() => {
                    navigator.clipboard.writeText(command).then(
                        () => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        },
                        () => {
                            // clipboard unavailable: nothing to report
                        },
                    );
                }}
                className="inline-flex items-center gap-1 text-fd-muted-foreground text-xs transition-colors hover:text-fd-foreground"
            >
                {copied ? (
                    <Check aria-hidden className="size-3.5" />
                ) : (
                    <Copy aria-hidden className="size-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
            </button>
        </div>
    );
}
