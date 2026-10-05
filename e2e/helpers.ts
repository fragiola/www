import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    expect,
    type FrameLocator,
    type Locator,
    type Page,
} from "@playwright/test";
import type {
    ExamplesConfig,
    Manifest,
    ProjectInfo,
} from "../lib/contract/types";

// What the specs are written against: the fixtures (fixtures/), read the way the site reads them.

const FIXTURES = join(import.meta.dirname, "..", "fixtures");
const readJson = <T>(file: string): T =>
    JSON.parse(readFileSync(join(FIXTURES, file), "utf-8")) as T;

export function fixture(slug: string) {
    const project = readJson<ProjectInfo>(`${slug}/project.json`);
    const examples = readJson<ExamplesConfig>(`${slug}/examples.json`);
    const manifests = Object.fromEntries(
        project.frameworks.map((framework) => [
            framework,
            readJson<Manifest>(`${slug}/embed/${framework}/manifest.json`),
        ]),
    );
    const levels = examples.levels.map((level) => level.id);
    /** the default framework's examples, in gallery order */
    const ordered = [
        ...(manifests[project.defaultFramework]?.examples ?? []),
    ].sort(
        (a, b) =>
            levels.indexOf(a.level) - levels.indexOf(b.level) ||
            a.order - b.order,
    );
    return { project, examples, manifests, ordered };
}

export const DOCKABLE = fixture("dockable");
export const UI = fixture("ui");
export const DATA_GRID = fixture("data-grid");
export const GRID_LAYOUT = fixture("grid-layout");
/** Every project, in projects.json order. */
export const PROJECTS = [UI, DOCKABLE, DATA_GRID, GRID_LAYOUT];

/** Records the `fragiola:example:*` messages every window of the page receives. */
export async function recordMessages(page: Page) {
    await page.addInitScript(() => {
        const log: unknown[] = [];
        (window as unknown as { messages: unknown[] }).messages = log;
        window.addEventListener("message", (event) => {
            const data = event.data as { type?: unknown } | null;
            if (
                typeof data?.type === "string" &&
                data.type.startsWith("fragiola:example:")
            ) {
                log.push(data);
            }
        });
    });
}

export const messages = (page: Page) =>
    page.evaluate(
        () => (window as unknown as { messages: unknown[] }).messages,
    );

/** The embed of the first example frame inside `scope` (the gallery's stage by default). */
export function embed(scope: Page | Locator): FrameLocator {
    return scope
        .locator('[data-testid="example-frame"] iframe')
        .first()
        .contentFrame();
}

/** Opens an example in the gallery and waits for its embed to be ready. */
export async function openExample(
    page: Page,
    slug: string,
    id: string,
    options: { theme?: string; code?: boolean; framework?: string } = {},
) {
    const params = new URLSearchParams();
    if (options.theme) params.set("theme", options.theme);
    if (options.code) params.set("code", "1");
    if (options.framework) params.set("framework", options.framework);
    const query = params.toString();
    await page.goto(`${slug}/examples/${id}/${query ? `?${query}` : ""}`);
    const stage = page.getByTestId("stage");
    if (options.theme) {
        await expect(stage).toHaveAttribute(
            "data-example-theme",
            options.theme,
        );
    }
    await expectReady(stage);
    return stage;
}

/** Waits for the first example frame inside `scope` to be ready and visible. */
export async function expectReady(scope: Locator) {
    const frame = scope.getByTestId("example-frame").first();
    await expect(frame).toHaveAttribute("data-ready", "");
    await expect(frame.locator("iframe")).toHaveCSS("opacity", "1");
    return frame;
}

/** Collects console errors and uncaught exceptions for the page's lifetime. */
export function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    return errors;
}

/** Marks a window: a reload loses the mark. */
export async function mark(page: Page) {
    await page.evaluate(() => {
        (window as unknown as { marker: boolean }).marker = true;
    });
}

export const marked = (page: Page) =>
    page.evaluate(() => (window as unknown as { marker?: boolean }).marker);

/** Marks the first example frame's window. */
export async function markFrame(scope: Locator) {
    await scope
        .locator('[data-testid="example-frame"] iframe')
        .first()
        .evaluate((iframe) => {
            const target = (iframe as HTMLIFrameElement).contentWindow as
                | (Window & { marker?: boolean })
                | null;
            if (target) target.marker = true;
        });
}

export const frameMarked = (scope: Locator) =>
    scope
        .locator('[data-testid="example-frame"] iframe')
        .first()
        .evaluate(
            (iframe) =>
                (
                    (iframe as HTMLIFrameElement).contentWindow as
                        | (Window & { marker?: boolean })
                        | null
                )?.marker,
        );

/** Switches the site's own theme (Fumadocs' toggle, next-themes). */
export async function setSiteTheme(page: Page, theme: "light" | "dark") {
    await page.addInitScript((value) => {
        // the page only: an embed loading later (Reset) would set it back, and next-themes
        // follows another document's write
        if (window !== window.top) return;
        try {
            localStorage.setItem("@fragiola:theme", value);
        } catch {}
    }, theme);
}
