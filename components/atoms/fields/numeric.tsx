import { Field as FieldPrimitive } from "@fragiola/primitives-react/field";
import type * as React from "react";
import { field } from "@/components/families/field";
import {
    type ControlValue,
    controlText,
    type PrimitiveProps,
} from "@/lib/base";
import { cn } from "@/lib/cn";

// The control takes an input's value (`ControlValue`), as on every base.
type ControlProps = Omit<
    PrimitiveProps<typeof FieldPrimitive.Control, "input">,
    "value" | "defaultValue"
> & { value?: ControlValue; defaultValue?: ControlValue };

// Bare control — numeric. This is the THESIS TEST: a new control, written
// from scratch, should be only its middle — without a single line of box
// styling (border, background, focus ring, invalid state, theme). All of
// that lives on the field.body that wraps this control.
//
// Behaviour: input type=number with step/min/max and keyboard increment
// (ArrowUp/ArrowDown respecting step). render={<input type="number" />}
// fixes the type while keeping Fragiola Primitives Field's a11y wiring.
export type NumericProps = Omit<ControlProps, "type"> & {
    min?: number;
    max?: number;
    step?: number;
};

export function Numeric({
    className,
    min,
    max,
    step = 1,
    onKeyDown,
    value,
    defaultValue,
    ...props
}: NumericProps) {
    return (
        <FieldPrimitive.Control
            data-slot="numeric"
            render={<input type="number" min={min} max={max} step={step} />}
            className={cn(field.control(), className as string)}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    const base = Number.parseFloat(event.currentTarget.value);
                    const current = Number.isFinite(base) ? base : 0;
                    const dir = event.key === "ArrowUp" ? 1 : -1;
                    const next = current + dir * (step ?? 1);
                    const clamped =
                        Number.isFinite(min) && next < (min as number)
                            ? (min as number)
                            : Number.isFinite(max) && next > (max as number)
                              ? (max as number)
                              : next;
                    event.currentTarget.value = String(clamped);
                }
                onKeyDown?.(event);
            }}
            {...props}
            value={controlText(value)}
            defaultValue={controlText(defaultValue)}
        />
    );
}
