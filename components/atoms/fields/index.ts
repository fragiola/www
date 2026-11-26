import { Input as InputControl } from "@/components/atoms/fields/input";
import { Numeric } from "@/components/atoms/fields/numeric";
import { Textarea } from "@/components/atoms/fields/textarea";
import { Template } from "./templates";

// Input is the bare control (function) + the Template namespace attached.
// Access: <Input />, <Input.Template.Simple label="..." />
const Input = Object.assign(InputControl, { Template });

export const AtomsFields = {
    Input,
    Textarea,
    Numeric,
};

export { Input, Numeric, Textarea };
