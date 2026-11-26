import { Field as FieldPrimitive } from "@fragiola/primitives-react/field";
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

// Bare control — text. No border, background, focus ring, invalid state or
// theme: all of that lives on the field.body that wraps this control. Uses
// FieldPrimitive.Control (Fragiola Primitives) for the a11y wiring (id, aria-labelledby,
// aria-describedby, validation) when inside <Field.Root>; outside, it works
// as a plain input. The inputVariants.tone (5 values) is gone entirely —
// colour via the body's className.
export function Input({
    className,
    value,
    defaultValue,
    ...props
}: ControlProps) {
    return (
        <FieldPrimitive.Control
            data-slot="input"
            className={cn(field.control(), className as string)}
            {...props}
            value={controlText(value)}
            defaultValue={controlText(defaultValue)}
        />
    );
}
