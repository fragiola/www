// The site export contract, v1.2 (CONTRACT.md): the shapes of what a project exports. Shared by
// the scripts (run with Node's type stripping: erasable syntax only) and the site. v1.1 and v1.2
// keep the file format: `project.json` still says `"contract": 1`.

export const CONTRACT = 1;
/** The revision www implements, as the messages print it. */
export const CONTRACT_REVISION = "1.2";

/** `<out>/project.json` (§2). */
export interface ProjectInfo {
    contract: number;
    slug: string;
    title: string;
    description: string;
    frameworks: string[];
    defaultFramework: string;
    registry?: { namespace: string };
    /** v1.1: the repository, linked from the header and the footer */
    repository?: string;
    /** v1.2: 1–8 lowercase topics, for the project's structured data only (§2) */
    keywords?: string[];
}

/** An entry of a sidebar section: a page of the export, or an external link. */
export type SidebarEntry =
    | { label: string; path: string }
    | { label: string; href: string; external: true };

/** `<out>/docs/config.json` (§3.1). */
export interface DocsConfig {
    sections: {
        label: string;
        framework?: string;
        /** v1.1: a folder that folds (default false: always open) */
        collapsible?: boolean;
        /** v1.1: a collapsible section open on load (the current page's section always is) */
        defaultOpen?: boolean;
        pages: SidebarEntry[];
    }[];
}

export type ThemeScheme = "light" | "dark";

/** A file shown by the code panel: its path, language and source, verbatim (§6). */
export interface SourceFile {
    path: string;
    lang: string;
    content: string;
}

export interface ExampleTheme {
    name: string;
    title: string;
    description: string;
    scheme: ThemeScheme;
    swatch: string[];
    file?: SourceFile;
}

/** `<out>/examples.json` (§4). */
export interface ExamplesConfig {
    levels: { id: string; title: string }[];
    themes: ExampleTheme[];
}

export type ExampleLayout = "fill" | "flow";

/** An example of a manifest (§5.3). */
export interface ManifestExample {
    id: string;
    title: string;
    description: string;
    level: string;
    order: number;
    features: string[];
    docs?: string;
    layout: ExampleLayout;
    height: number;
    files: string[];
    registry: string[];
    packages: string[];
}

/** `<out>/embed/<framework>/manifest.json` (§5.3). */
export interface Manifest {
    files: Record<string, { lang: string; content: string; shared?: boolean }>;
    examples: ManifestExample[];
}

/** A shadcn registry item (§7), as far as `www` reads it. */
export interface RegistryItem {
    name: string;
    type: string;
    title?: string;
    description?: string;
    registryDependencies?: string[];
    files?: {
        path: string;
        type?: string;
        target?: string;
        content?: string;
    }[];
}

/** `<out>/r/index.json` (§7). */
export interface RegistryIndex {
    name?: string;
    homepage?: string;
    items: RegistryItem[];
}

/** v1.2 (§2, §3.2): lengths in characters (Unicode code points) */
export const LIMITS = {
    title: 60,
    description: { min: 50, max: 160 },
    keywords: { min: 1, max: 8, length: 40 },
} as const;

/** A landing call to action (§3.4): `<Hero actions>`. */
export interface Action {
    label: string;
    href: string;
    variant?: ActionVariant;
    icon?: ActionIcon;
}

export const ACTION_VARIANTS = ["primary", "secondary", "ghost"] as const;
export type ActionVariant = (typeof ACTION_VARIANTS)[number];
export const ACTION_ICONS = ["arrow", "external"] as const;
export type ActionIcon = (typeof ACTION_ICONS)[number];

/** The tokens an action label may carry: `{examples}`, the project's example count. */
export const LABEL_TOKEN = /\{([^{}]*)\}/g;

/** An entry of `projects.json` (§9). */
export interface ProjectEntry {
    slug: string;
    repo: string;
    ref: string;
    localPath?: string;
    devUrl?: string;
}
