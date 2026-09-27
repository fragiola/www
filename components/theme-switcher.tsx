"use client";

import type { ThemeSummary } from "@/lib/projects";

// A project's example themes as a row of buttons, each with its swatches (§4): the gallery's
// toolbar and the landing's showcase (§3.4). The caller styles the buttons.

export function ThemeSwitcher({
    themes,
    value,
    onChange,
    buttonClassName,
}: {
    themes: Pick<ThemeSummary, "name" | "title" | "description" | "swatch">[];
    value: string | undefined;
    onChange: (theme: string) => void;
    buttonClassName: string;
}) {
    return (
        <fieldset className="flex flex-wrap items-center gap-1">
            <legend className="sr-only">Theme</legend>
            {themes.map((theme) => (
                <button
                    key={theme.name}
                    type="button"
                    aria-pressed={value === theme.name}
                    title={theme.description}
                    data-theme-option={theme.name}
                    className={buttonClassName}
                    onClick={() => onChange(theme.name)}
                >
                    <span aria-hidden className="flex -space-x-1">
                        {theme.swatch.map((color) => (
                            <span
                                key={color}
                                className="size-3 rounded-full border border-palette-line"
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </span>
                    {theme.title}
                </button>
            ))}
        </fieldset>
    );
}
