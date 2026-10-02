"use client";

import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { Check, Copy, X } from "lucide-react";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { type CodeFile, loadExampleCode, loadThemeFiles } from "@/lib/code";

// The code panel (ported from dockable's docs, components/site/code-panel.tsx): one tab per file
// of the example, verbatim (§6), the selected theme's CSS last, a copy button per file, "Copy
// all" with a `// <path>` header per file, and the setup command (§4).
//
// Nothing is in the page: the files are fetched when the panel opens (lib/code.ts), the shared
// ones once per project and framework.

/** Copies text and reports it through `data-copied` for a moment (no toast library). */
function useCopy() {
    const [copied, setCopied] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    const copy = async (key: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(key);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(null), 1500);
        } catch {
            // clipboard unavailable (permissions, insecure context): nothing to report
        }
    };
    return { copied, copy };
}

type Loaded =
    | { state: "loading" }
    | { state: "error" }
    | {
          state: "done";
          files: CodeFile[];
          themeFiles: Record<string, CodeFile>;
      };

/** An example's files, and the project's theme files when asked for, fetched on mount. */
function useCode(
    slug: string,
    framework: string,
    id: string,
    withThemes: boolean,
): Loaded {
    const [loaded, setLoaded] = useState<Loaded & { key: string }>({
        state: "loading",
        key: "",
    });
    const key = `${slug}/${framework}/${id}`;
    useEffect(() => {
        let live = true;
        Promise.all([
            loadExampleCode(slug, framework, id),
            withThemes ? loadThemeFiles(slug) : Promise.resolve({}),
        ]).then(
            ([files, themeFiles]) => {
                if (live) setLoaded({ state: "done", files, themeFiles, key });
            },
            () => {
                if (live) setLoaded({ state: "error", key });
            },
        );
        return () => {
            live = false;
        };
    }, [slug, framework, id, withThemes, key]);
    return loaded.key === key ? loaded : { state: "loading" };
}

/** Shiki's `style` attribute (`--shiki-light:#…;…`) as a React style object. */
function styleOf(css: string): CSSProperties {
    const style: Record<string, string> = {};
    for (const declaration of css.split(";")) {
        const at = declaration.indexOf(":");
        if (at > 0) {
            style[declaration.slice(0, at).trim()] = declaration
                .slice(at + 1)
                .trim();
        }
    }
    return style as CSSProperties;
}

// Fumadocs caps a code block at 600px (made for a page); here it fills the panel and is its
// only scroller, so the horizontal scrollbar sits at the panel's bottom. Its `cn` does not merge
// conflicting classes, hence the `!`.
function Highlighted({ file }: { file: CodeFile }) {
    return (
        <CodeBlock
            allowCopy={false}
            className={cn("my-0", file.pre.className)}
            style={styleOf(file.pre.style)}
            viewportProps={{ className: "h-full max-h-none!" }}
        >
            <Pre>
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki's output, built from the export at build time */}
                <code dangerouslySetInnerHTML={{ __html: file.html }} />
            </Pre>
        </CodeBlock>
    );
}

const toolButton =
    "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-palette-accent/85 outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring data-copied:text-palette-contrast";

export function CodePanel({
    slug,
    framework,
    id,
    theme,
    setup,
    onClose,
}: {
    slug: string;
    framework: string;
    id: string;
    /** the selected example theme: its CSS is the last file (the gallery) */
    theme?: string;
    setup: string;
    onClose?: () => void;
}) {
    const [active, setActive] = useState(0);
    const { copied, copy } = useCopy();
    const tabsId = useId();
    const loaded = useCode(slug, framework, id, theme !== undefined);
    const files =
        loaded.state === "done"
            ? [
                  ...loaded.files,
                  ...(theme && loaded.themeFiles[theme]
                      ? [loaded.themeFiles[theme]]
                      : []),
              ]
            : [];
    const index = Math.min(active, Math.max(files.length - 1, 0));
    const current = files[index];
    const all = files
        .map((file) => `// ${file.path}\n${file.code.trimEnd()}\n`)
        .join("\n");

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-1 border-palette-line border-b px-2 py-1.5">
                <h2 className="px-1 font-semibold text-sm">Code</h2>
                <div className="ms-auto flex items-center gap-1">
                    <button
                        type="button"
                        data-testid="copy-all"
                        data-copied={copied === "all" ? "" : undefined}
                        disabled={files.length === 0}
                        className={toolButton}
                        onClick={() => copy("all", all)}
                    >
                        {copied === "all" ? (
                            <Check aria-hidden className="size-3.5" />
                        ) : (
                            <Copy aria-hidden className="size-3.5" />
                        )}
                        {copied === "all" ? "Copied" : "Copy all"}
                    </button>
                    {onClose ? (
                        <button
                            type="button"
                            aria-label="Close code"
                            className={toolButton}
                            onClick={onClose}
                        >
                            <X aria-hidden className="size-4" />
                        </button>
                    ) : null}
                </div>
            </div>
            {setup ? (
                <div className="border-palette-line border-b px-3 py-2 text-palette-accent/85 text-xs">
                    <p className="mb-1">Install</p>
                    <code
                        data-testid="setup"
                        className="block overflow-x-auto whitespace-pre rounded bg-palette-soft px-2 py-1.5 font-mono text-palette-contrast"
                    >
                        {setup}
                    </code>
                </div>
            ) : null}
            {loaded.state === "loading" ? (
                <p
                    data-testid="code-loading"
                    className="px-3 py-4 text-palette-accent/85 text-sm"
                >
                    Loading the code…
                </p>
            ) : loaded.state === "error" ? (
                <p role="alert" className="px-3 py-4 text-sm">
                    The code could not be loaded.
                </p>
            ) : (
                <>
                    <div
                        role="tablist"
                        aria-label="Files"
                        className="flex shrink-0 gap-0.5 overflow-x-auto border-palette-line border-b px-2 pt-1.5"
                    >
                        {files.map((file, position) => (
                            <button
                                key={file.path}
                                type="button"
                                role="tab"
                                id={`${tabsId}-tab-${position}`}
                                aria-selected={position === index}
                                aria-controls={`${tabsId}-panel`}
                                className="shrink-0 rounded-t-md px-2.5 py-1.5 font-mono text-palette-accent/85 text-xs outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring aria-selected:bg-palette-soft aria-selected:text-palette-contrast"
                                onClick={() => setActive(position)}
                            >
                                {file.path}
                            </button>
                        ))}
                    </div>
                    {current ? (
                        <div
                            role="tabpanel"
                            id={`${tabsId}-panel`}
                            aria-labelledby={`${tabsId}-tab-${index}`}
                            className="relative flex min-h-0 flex-1 flex-col"
                        >
                            <button
                                type="button"
                                data-testid="copy-file"
                                data-copied={
                                    copied === current.path ? "" : undefined
                                }
                                className={cn(
                                    toolButton,
                                    "palette-raised absolute end-3 top-3 z-10 border border-palette-line bg-palette-base",
                                )}
                                onClick={() => copy(current.path, current.code)}
                            >
                                {copied === current.path ? (
                                    <Check aria-hidden className="size-3.5" />
                                ) : (
                                    <Copy aria-hidden className="size-3.5" />
                                )}
                                {copied === current.path ? "Copied" : "Copy"}
                            </button>
                            <div
                                data-testid="code-file"
                                data-path={current.path}
                                className="min-h-0 flex-1 text-[13px] [&_figure]:my-0 [&_figure]:h-full [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:shadow-none"
                            >
                                <Highlighted file={current} />
                            </div>
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}
