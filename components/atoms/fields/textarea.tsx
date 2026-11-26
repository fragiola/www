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

// Bare control — multiline text. Same rule as Input: no box of its own.
// Variable height: the textarea uses rows; the field.body that wraps it uses
// min-h-control (not fixed), so it grows with content without a size variant.
// render={<textarea />} swaps the default element (input) for textarea while
// keeping Fragiola Primitives Field's a11y wiring.
export function Textarea({
    className,
    rows,
    value,
    defaultValue,
    ...props
}: ControlProps & {
    rows?: number;
}) {
    return (
        <FieldPrimitive.Control
            data-slot="textarea"
            render={<textarea rows={rows} />}
            className={cn(
                field.control(),
                "min-h-control",
                className as string,
            )}
            {...props}
            value={controlText(value)}
            defaultValue={controlText(defaultValue)}
        />
    );
}
