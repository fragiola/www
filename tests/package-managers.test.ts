import { describe, expect, test } from "vitest";
import {
    commandFor,
    DEFAULT_PACKAGE_MANAGER,
    isPackageManager,
    PACKAGE_MANAGERS,
} from "@/lib/package-managers";

const COMMAND = "npx shadcn@latest add @fragiola/dialog";

describe("the install command per package manager", () => {
    test("each manager runs the same package with its own runner", () => {
        expect(commandFor(COMMAND, "npm")).toBe(COMMAND);
        expect(commandFor(COMMAND, "pnpm")).toBe(
            "pnpm dlx shadcn@latest add @fragiola/dialog",
        );
        expect(commandFor(COMMAND, "yarn")).toBe(
            "yarn dlx shadcn@latest add @fragiola/dialog",
        );
        expect(commandFor(COMMAND, "bun")).toBe(
            "bunx --bun shadcn@latest add @fragiola/dialog",
        );
    });

    test("npm is the default, and only the four managers are accepted", () => {
        expect(DEFAULT_PACKAGE_MANAGER).toBe("npm");
        expect(PACKAGE_MANAGERS).toEqual(["pnpm", "npm", "yarn", "bun"]);
        expect(isPackageManager("pnpm")).toBe(true);
        expect(isPackageManager("deno")).toBe(false);
        expect(isPackageManager(null)).toBe(false);
    });
});
