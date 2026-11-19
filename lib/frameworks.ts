const NAMES: Record<string, string> = {
    react: "React",
    vue: "Vue",
    angular: "Angular",
    svelte: "Svelte",
    solid: "Solid",
    preact: "Preact",
    vanilla: "Vanilla JS",
};

/** A framework's display name: "react" → "React". */
export function frameworkName(framework: string): string {
    return (
        NAMES[framework] ??
        framework.charAt(0).toUpperCase() + framework.slice(1)
    );
}
