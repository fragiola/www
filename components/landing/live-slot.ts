"use client";

import { type RefObject, useEffect, useSyncExternalStore } from "react";

// The organization's landing holds at most one example iframe (AGENTS.md rule 3), and two
// sections run one: "See it live" (live-preview.tsx) and "One class, one palette"
// (palette-section.tsx). They share this slot, one owner at a time, "preview" first: the section
// that shows the most of itself in the viewport takes it as the page scrolls (a tie keeps the
// owner), and a reader's choice in one (a chip, a click on the placeholder) takes it at once.
// The other one drops its frame and shows its placeholder.

export type LiveOwner = "preview" | "palette";

let owner: LiveOwner = "preview";
const listeners = new Set<() => void>();
const sections = new Map<LiveOwner, HTMLElement>();

export function claimLive(next: LiveOwner) {
    if (owner === next) return;
    owner = next;
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Whether `id` holds the slot now: only then may it render its example's frame. */
export function useLive(id: LiveOwner): boolean {
    return useSyncExternalStore(
        subscribe,
        () => owner === id,
        () => id === "preview",
    );
}

/** How much of `element` the viewport shows, in pixels. */
function shown(element: HTMLElement): number {
    const { top, bottom } = element.getBoundingClientRect();
    return Math.max(0, Math.min(bottom, window.innerHeight) - Math.max(top, 0));
}

let frame = 0;
function measure() {
    frame = 0;
    let best: LiveOwner | undefined;
    let most = 0;
    for (const [id, element] of sections) {
        const pixels = shown(element);
        if (pixels > most) {
            most = pixels;
            best = id;
        }
    }
    const current = sections.get(owner);
    if (best && (!current || most > shown(current))) claimLive(best);
}

function schedule() {
    if (frame === 0) frame = requestAnimationFrame(measure);
}

/** Registers `ref`'s element as section `id` of the slot while it is mounted. */
export function useLiveSection(
    ref: RefObject<HTMLElement | null>,
    id: LiveOwner,
) {
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        sections.set(id, element);
        if (sections.size === 1) {
            window.addEventListener("scroll", schedule, { passive: true });
            window.addEventListener("resize", schedule);
        }
        schedule();
        return () => {
            sections.delete(id);
            if (sections.size === 0) {
                window.removeEventListener("scroll", schedule);
                window.removeEventListener("resize", schedule);
            }
        };
    }, [ref, id]);
}
