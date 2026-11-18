// The site's half of overlay promotion (contract v1.3, §5.4): where a frame is, the viewport it
// is promoted to, and the page's scroll held still while it is. The frame itself (the top layer,
// the messages) is in example-frame.tsx.

/** CSS pixels, in the coordinates of the viewport the frame fills once promoted. */
export interface PromotionRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Promotion {
    rect: PromotionRect;
    viewport: { width: number; height: number };
}

/**
 * Where the frame is and the viewport it is promoted to. The wrapper is the frame's inline box
 * (it keeps its place while the frame is promoted); the frame's height is the inline frame's,
 * which in the gallery may run past the wrapper. A promoted frame fills the viewport from its
 * top-left corner, so `rect` is the wrapper's position in the viewport, as is.
 */
export function measurePromotion(
    wrapper: HTMLElement,
    frameHeight: number,
): Promotion {
    const box = wrapper.getBoundingClientRect();
    const root = document.documentElement;
    return {
        rect: {
            x: box.left,
            y: box.top,
            width: box.width,
            height: frameHeight,
        },
        // the layout viewport without its scrollbars: what a frame at `inset: 0` fills
        viewport: { width: root.clientWidth, height: root.clientHeight },
    };
}

/**
 * Holds the page's scroll position still until the returned function is called. A promoted frame
 * covers the page, and a wheel over a document that cannot scroll chains to the frame's
 * scrolling ancestors: the page would move under an example that is pinned in place. Each
 * scroll of the document or of an ancestor is undone in its `scroll` event, which runs before
 * the next paint, so nothing moves on screen — and nothing is restyled, so no scrollbar
 * disappears and no layout shifts, which `overflow: hidden` would cause.
 */
export function holdScroll(from: HTMLElement): () => void {
    const held = new Map<Element, { top: number; left: number }>();
    const scroller = document.scrollingElement ?? document.documentElement;
    held.set(scroller, { top: scroller.scrollTop, left: scroller.scrollLeft });
    for (
        let node = from.parentElement;
        node && node !== document.body;
        node = node.parentElement
    ) {
        const { overflowX, overflowY } = getComputedStyle(node);
        if (/auto|scroll/.test(`${overflowX} ${overflowY}`)) {
            held.set(node, { top: node.scrollTop, left: node.scrollLeft });
        }
    }
    const restore = (event: Event) => {
        const target =
            event.target === document ? scroller : (event.target as Element);
        const position = held.get(target);
        if (!position) return;
        if (
            target.scrollTop !== position.top ||
            target.scrollLeft !== position.left
        ) {
            target.scrollTo({
                top: position.top,
                left: position.left,
                behavior: "instant",
            });
        }
    };
    // element scrolls do not bubble: capture them on the way down
    document.addEventListener("scroll", restore, { capture: true });
    return () =>
        document.removeEventListener("scroll", restore, { capture: true });
}
