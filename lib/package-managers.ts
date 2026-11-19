// The package managers the install command speaks (components/install-command.tsx). The contract's
// command is npm's (`npx shadcn@latest add …`, lib/projects.ts#installCommand); each manager runs
// the same package with its own runner.

export const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/** The manager a reader sees before choosing: npm, the contract's own. */
export const DEFAULT_PACKAGE_MANAGER: PackageManager = "npm";

const RUNNERS: Record<PackageManager, string> = {
    pnpm: "pnpm dlx",
    npm: "npx",
    yarn: "yarn dlx",
    bun: "bunx --bun",
};

export function isPackageManager(value: unknown): value is PackageManager {
    return (PACKAGE_MANAGERS as readonly unknown[]).includes(value);
}

/** An npx command split for display: the runner (`pnpm dlx`) and what it runs. */
export function runnerCommand(
    command: string,
    manager: PackageManager,
): { runner: string; rest: string } {
    const rest = command.replace(/^npx\s+/, "");
    return { runner: RUNNERS[manager], rest };
}

/** An npx command for `manager`: `npx shadcn@latest add x` → `pnpm dlx shadcn@latest add x`. */
export function commandFor(command: string, manager: PackageManager): string {
    const { runner, rest } = runnerCommand(command, manager);
    return `${runner} ${rest}`;
}
