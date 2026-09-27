// The site export contract, v1 (CONTRACT.md): the shapes of what a project exports. Shared by
// the scripts (run with Node's type stripping: erasable syntax only) and the site.

export const CONTRACT = 1;

/** `<out>/project.json` (§2). */
export interface ProjectInfo {
    contract: number;
    slug: string;
    title: string;
    description: string;
    frameworks: string[];
    defaultFramework: string;
    registry?: { namespace: string };
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

/** An entry of `projects.json` (§9). */
export interface ProjectEntry {
    slug: string;
    repo: string;
    ref: string;
    localPath?: string;
    devUrl?: string;
}
