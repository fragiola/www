"use client";

import {
    createContext,
    type ReactNode,
    useContext,
    useSyncExternalStore,
} from "react";
import { frameworkName } from "@/lib/frameworks";
import { readStored, STORAGE_KEYS, writeStored } from "@/lib/storage";

// The chosen framework: one value for the whole site (§4), persisted in
// localStorage["@fragiola:framework"] (lib/storage.ts) and shared across tabs through `storage`.
// A project that does not offer the stored framework shows its default one; the choice is kept
// for the next project that does.

const KEY = STORAGE_KEYS.framework;
const listeners = new Set<() => void>();

function read(): string | null {
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

export function setFramework(framework: string) {
    writeStored(KEY, framework);
    for (const listener of listeners) listener();
}

export interface ProjectFrameworks {
    slug: string;
    frameworks: string[];
    defaultFramework: string;
}

const ProjectContext = createContext<ProjectFrameworks | null>(null);

export function ProjectProvider({
    project,
    children,
}: {
    project: ProjectFrameworks;
    children: ReactNode;
}) {
    return <ProjectContext value={project}>{children}</ProjectContext>;
}

export function useProjectFrameworks(): ProjectFrameworks | null {
    return useContext(ProjectContext);
}

/** The framework to show for the current project. Before hydration: its default. */
export function useFramework(): string {
    const project = useContext(ProjectContext);
    const stored = useSyncExternalStore(subscribe, read, () => null);
    if (!project) return stored ?? "react";
    return stored && project.frameworks.includes(stored)
        ? stored
        : project.defaultFramework;
}

export function FrameworkSelect({ frameworks }: { frameworks: string[] }) {
    const framework = useFramework();
    return (
        <label className="flex items-center justify-between gap-2 rounded-md border border-fd-border px-2 py-1.5 text-sm">
            <span className="text-fd-muted-foreground">Framework</span>
            <select
                data-testid="framework-select"
                className="bg-transparent text-fd-foreground"
                value={framework}
                onChange={(event) => setFramework(event.target.value)}
            >
                {frameworks.map((name) => (
                    <option key={name} value={name}>
                        {frameworkName(name)}
                    </option>
                ))}
            </select>
        </label>
    );
}

/** `<Framework name="react">…</Framework>`: the block shows only for that framework. */
export function Framework({
    name,
    children,
}: {
    name: string;
    children: ReactNode;
}) {
    return useFramework() === name ? children : null;
}
