import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// clsx + tailwind-merge, with Fragiola's palette classes as one group (the last palette wins),
// the same as the `cn` of the Fragiola UI registry that paints the site.
const merge = extendTailwindMerge<"palette">({
    extend: {
        classGroups: {
            palette: [
                {
                    palette: [
                        "surface",
                        "raised",
                        "danger",
                        "blue",
                        "green",
                        "orange",
                        "purple",
                        "rose",
                    ],
                },
            ],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return merge(clsx(inputs));
}
