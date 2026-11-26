"use client";

import { Layers } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useProjectFrameworks } from "@/components/framework";
import { baseDir } from "@/lib/contract/bases";
import type { BaseInfo } from "@/lib/contract/types";
import { readStored, STORAGE_KEYS, writeStored } from "@/lib/storage";

// The chosen base (v1.8, CONTRACT.md §2): one value for the whole site, like the framework
// (components/framework.tsx), persisted in localStorage["@fragiola:base"] (lib/storage.ts),
// shared across tabs through `storage`, and taken from `?base=<name>` on the first read of a page
// (a shared link chooses it). A project that does not offer the stored base shows its default
// one; the choice is kept for the next project that does. A project without bases has nothing to
// choose: every reader of this module gets undefined for it.

const KEY = STORAGE_KEYS.base;
const listeners = new Set<() => void>();
let fromUrl = false;

function read(): string | null {
    if (!fromUrl) {
        fromUrl = true;
        const asked = new URLSearchParams(window.location.search).get("base");
        if (asked) writeStored(KEY, asked);
    }
    return readStored(KEY);
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

export function setBase(base: string) {
    writeStored(KEY, base);
    for (const listener of listeners) listener();
}

/** The default base of a list, else its first. */
function defaultOf(bases: BaseInfo[]): BaseInfo | undefined {
    return bases.find((base) => base.default) ?? bases[0];
}

/** The base to show for the current project. Before hydration: its default. */
export function useBase(): BaseInfo | undefined {
    const bases = useProjectFrameworks()?.bases ?? [];
    const stored = useSyncExternalStore(subscribe, read, () => null);
    if (bases.length === 0) return undefined;
    return bases.find((base) => base.name === stored) ?? defaultOf(bases);
}

/** The chosen base's folder under `embed/<framework>/` and `r/`: "" for the default. */
export function useBaseDir(): string {
    return baseDir(useBase());
}

/** The docs sidebar's base select, under the framework's: only for a project with bases. */
export function BaseSelect() {
    const bases = useProjectFrameworks()?.bases ?? [];
    const base = useBase();
    if (bases.length < 2 || !base) return null;
    return (
        <label className="flex items-center gap-2.5 rounded-md border border-fd-border bg-fd-secondary/50 px-2.5 py-1.5 text-sm transition-colors focus-within:border-fd-ring hover:bg-fd-accent/60">
            <Layers aria-hidden className="size-4 shrink-0 text-fd-primary" />
            <span className="text-fd-muted-foreground">Base</span>
            <select
                data-testid="base-select"
                className="ms-auto min-w-0 cursor-pointer truncate bg-transparent font-medium text-fd-foreground outline-none"
                value={base.name}
                onChange={(event) => setBase(event.target.value)}
            >
                {bases.map((option) => (
                    <option key={option.name} value={option.name}>
                        {option.title}
                    </option>
                ))}
            </select>
        </label>
    );
}

/**
 * Under an install command, for a non-default base: the `components.json` entry that points the
 * registry's namespace at the base's items (§7). Nothing on the default base: its command needs
 * no setup beyond the registry the installation page describes.
 */
export function BaseRegistryNote({
    namespace,
    site,
}: {
    namespace: string;
    site: string;
}) {
    const base = useBase();
    if (!base || base.default) return null;
    const entry = JSON.stringify(
        {
            registries: {
                [namespace]: { url: `${site}/r/${base.name}/{name}.json` },
            },
        },
        null,
        2,
    );
    return (
        <div
            data-testid="base-registry-note"
            data-base={base.name}
            className="mt-2 rounded-lg border border-fd-border bg-fd-secondary/40 p-3 text-sm"
        >
            <p className="mb-2 text-fd-muted-foreground">
                {`On ${base.title}, ${namespace} points at its registry in components.json:`}
            </p>
            <pre className="overflow-x-auto font-mono text-xs text-fd-foreground">
                {entry}
            </pre>
        </div>
    );
}
