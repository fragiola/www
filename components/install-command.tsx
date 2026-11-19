"use client";

import { Check, Copy, SquareTerminal } from "lucide-react";
import {
    type KeyboardEvent,
    useId,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { cn } from "@/lib/cn";
import {
    commandFor,
    DEFAULT_PACKAGE_MANAGER,
    isPackageManager,
    PACKAGE_MANAGERS,
    type PackageManager,
    runnerCommand,
} from "@/lib/package-managers";
import { readStored, STORAGE_KEYS, writeStored } from "@/lib/storage";

// <InstallCommand item> (§3.4, §7): the shadcn CLI command for a registry item, namespaced with
// the project's registry (`npx shadcn@latest add @fragiola/<item>`), served from /r.
//
// Drawn as a terminal: a bar with the package managers as tabs (pnpm | npm | yarn | bun) and a
// copy button, then the command for the chosen one. The choice is one for the whole site: every
// install command on the page follows it, and it is remembered in
// localStorage["@fragiola:package-manager"] (lib/storage.ts), shared across tabs. The static page
// shows npm, the contract's own, until hydration.

const KEY = STORAGE_KEYS.packageManager;
const listeners = new Set<() => void>();

function read(): PackageManager {
    const stored = readStored(KEY);
    return isPackageManager(stored) ? stored : DEFAULT_PACKAGE_MANAGER;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
        if (event.key === KEY || event.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
    };
}

function setPackageManager(manager: PackageManager) {
    writeStored(KEY, manager);
    for (const listener of listeners) listener();
}

function usePackageManager(): PackageManager {
    return useSyncExternalStore(subscribe, read, () => DEFAULT_PACKAGE_MANAGER);
}

/** The command, coloured like a shell: the runner muted, the registry items in the primary. */
function CommandText({
    command,
    manager,
}: {
    command: string;
    manager: PackageManager;
}) {
    const { runner, rest } = runnerCommand(command, manager);
    const words = rest.split(" ");
    return (
        <code className="block min-w-0 flex-1 overflow-x-auto whitespace-pre py-0.5 font-mono text-sm">
            <span aria-hidden className="select-none text-fd-muted-foreground">
                ${" "}
            </span>
            <span className="text-fd-muted-foreground">{runner}</span>
            {words.map((word, index) => (
                <span
                    // the words of one fixed command: their order is their identity
                    // biome-ignore lint/suspicious/noArrayIndexKey: see above
                    key={index}
                    className={
                        word.startsWith("@")
                            ? "font-medium text-fd-primary"
                            : "text-fd-foreground"
                    }
                >
                    {` ${word}`}
                </span>
            ))}
        </code>
    );
}

export function InstallCommand({ command }: { command: string }) {
    const manager = usePackageManager();
    const [copied, setCopied] = useState(false);
    const id = useId();
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const panel = `${id}-panel`;

    const select = (index: number) => {
        const next =
            PACKAGE_MANAGERS[
                (index + PACKAGE_MANAGERS.length) % PACKAGE_MANAGERS.length
            ];
        if (!next) return;
        setPackageManager(next);
        tabs.current[PACKAGE_MANAGERS.indexOf(next)]?.focus();
    };

    const onKeyDown = (event: KeyboardEvent, index: number) => {
        const moves: Record<string, number> = {
            ArrowRight: index + 1,
            ArrowLeft: index - 1,
            Home: 0,
            End: PACKAGE_MANAGERS.length - 1,
        };
        const to = moves[event.key];
        if (to === undefined) return;
        event.preventDefault();
        select(to);
    };

    const copy = () => {
        navigator.clipboard.writeText(commandFor(command, manager)).then(
            () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            },
            () => {
                // clipboard unavailable: nothing to report
            },
        );
    };

    return (
        <div
            data-testid="install-command"
            data-package-manager={manager}
            className="not-prose my-4 overflow-hidden rounded-lg border border-fd-border bg-fd-card shadow-xs"
        >
            <div className="flex items-center gap-2 border-fd-border border-b bg-fd-secondary/50 ps-3 pe-1.5">
                <SquareTerminal
                    aria-hidden
                    className="size-4 shrink-0 text-fd-muted-foreground"
                />
                <div
                    role="tablist"
                    aria-label="Package manager"
                    className="-mb-px flex min-w-0 flex-1 overflow-x-auto"
                >
                    {PACKAGE_MANAGERS.map((name, index) => {
                        const selected = name === manager;
                        return (
                            <button
                                key={name}
                                ref={(node) => {
                                    tabs.current[index] = node;
                                }}
                                type="button"
                                role="tab"
                                id={`${id}-${name}`}
                                aria-selected={selected}
                                aria-controls={panel}
                                tabIndex={selected ? 0 : -1}
                                onClick={() => setPackageManager(name)}
                                onKeyDown={(event) => onKeyDown(event, index)}
                                className={cn(
                                    "border-b-2 px-2.5 py-2 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-fd-ring focus-visible:-outline-offset-2",
                                    selected
                                        ? "border-fd-primary text-fd-foreground"
                                        : "border-transparent text-fd-muted-foreground hover:text-fd-foreground",
                                )}
                            >
                                {name}
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    aria-label={copied ? "Copied" : "Copy the command"}
                    onClick={copy}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-fd-ring"
                >
                    {copied ? (
                        <Check aria-hidden className="size-3.5" />
                    ) : (
                        <Copy aria-hidden className="size-3.5" />
                    )}
                </button>
            </div>
            <div
                id={panel}
                role="tabpanel"
                aria-labelledby={`${id}-${manager}`}
                className="flex items-center px-4 py-3"
            >
                <CommandText command={command} manager={manager} />
            </div>
        </div>
    );
}
