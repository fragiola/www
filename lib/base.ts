import type { RenderProp } from "@fragiola/primitives-react/render";
import type * as React from "react";

// The base's adapter: what the registry needs from its primitive library
// that is not a component it wraps. Every base exports the same names
// (packages/registry/bases.ts), so code importing them runs on any base.
//
// - DirectionProvider: the direction the primitives read (RTL: keyboard
//   navigation, slider direction, submenu sides).
// - CollapsiblePrimitive: the unstyled Collapsible, for compositions that
//   need it (a collapsible sidebar menu).
// - PrimitiveProps<typeof Part, "element">: a wrapper's props, the part's
//   own and its element's, as one type on every base.
// - RenderComponentProps<"element">: the props of a part written with the
//   base's useRender.
// - POSITIONER_DEFAULTS: what every Positioner the registry renders gets.
// - ControlValue and controlText: a field control's value as an input's
//   (`string | number | readonly string[]`), and what the base's control takes.
//
// This file is Fragiola Primitives'. A part's props declare its own props
// and forward any other (`[key: string]: unknown`); the element's props are
// added here, so a wrapper types `onClick`, `aria-*` or `value` the way it
// does on Base UI.

export { Collapsible as CollapsiblePrimitive } from "@fragiola/primitives-react/collapsible";
export { DirectionProvider } from "@fragiola/primitives-react/direction";

type Declared<T> = {
    [K in keyof T as string extends K
        ? never
        : number extends K
          ? never
          : symbol extends K
            ? never
            : K]: T[K];
};

export type PrimitiveProps<
    Part extends React.ElementType,
    Element extends keyof React.JSX.IntrinsicElements = "div",
> = Declared<React.ComponentProps<Part>> &
    Omit<
        React.ComponentProps<Element>,
        keyof Declared<React.ComponentProps<Part>>
    >;

export type RenderComponentProps<
    Element extends keyof React.JSX.IntrinsicElements,
    State = Record<string, unknown>,
> = Omit<React.ComponentProps<Element>, "className" | "style"> & {
    render?: RenderProp<State>;
    className?: string | ((state: State) => string | undefined);
    style?:
        | React.CSSProperties
        | ((state: State) => React.CSSProperties | undefined);
};

export type ControlValue = string | number | readonly string[];

/** Fragiola Primitives' field control takes text: a number or a list becomes its string. */
export function controlText(
    value: ControlValue | undefined,
): string | undefined {
    if (value === undefined) return undefined;
    return typeof value === "string" ? value : String(value);
}

// Base UI's collision padding (5px; Fragiola Primitives' default is 8), so a
// popup flips and shifts where it does on Base UI.
export const POSITIONER_DEFAULTS: { collisionPadding?: number } = {
    collisionPadding: 5,
};
