// The fixture embed app (www/fixtures): a stand-in for a project's real embed app, with no build
// and no framework, that follows the site export contract v1.1 §5 to the letter, so the site's
// tests can drive every part of it (and v1.3 §5.4, overlay promotion):
//
//   ?id=<id>&theme=<name>             one example on the whole viewport, no chrome; the theme is
//                                     applied before the first paint (the inline script in
//                                     index.html), a missing or unknown one is the first light
//   fragiola:example:ready            once, after the first render (`readyDelay` holds it back)
//   fragiola:example:resize           after ready, on every content height change (flow only)
//   fragiola:example:theme            applied without a reload; an unknown theme is ignored
//   popout/                           opened by the "Pop out" button, under the same base (by its
//                                     directory too: `serve` drops the query of popout.html?…)
//   fragiola:example:host             the site can promote the frame: from then on "Open dialog"
//                                     asks first (`overlay` open), arms on `promote` (a stylesheet
//                                     under a media query of the promoted viewport pins the stage
//                                     to `rect`), says `armed`, opens on `promoted`, and says
//                                     `overlay` closed once the exit transition has ended. Without
//                                     `host`, or with no `promoted` in time, it opens in place
//
// Each example renders a counter (reset tests), a textarea, and for a flow example rows that
// "Add a row" grows (resize tests); an `overlay` example also has "Open dialog", a modal overlay
// that slides in from the viewport's inline-end edge. The configuration is the JSON block in
// index.html.

const config = JSON.parse(
    document.getElementById("fixture-config")?.textContent ?? "{}",
);
const READY = "fragiola:example:ready";
const RESIZE = "fragiola:example:resize";
const THEME = "fragiola:example:theme";
const HOST = "fragiola:example:host";
const OVERLAY = "fragiola:example:overlay";
const PROMOTE = "fragiola:example:promote";
const ARMED = "fragiola:example:armed";
const PROMOTED = "fragiola:example:promoted";
/** How long an overlay waits for `promoted` before it opens in place. */
const HOLD_TIMEOUT_MS = 300;

const params = new URLSearchParams(location.search);
const id = params.get("id");
const base = new URL(".", location.href).pathname;
const stage = document.getElementById("stage");
const embedded = window.parent !== window;

function post(message) {
    if (embedded) window.parent.postMessage(message, location.origin);
}

function applyTheme(name) {
    const scheme = config.themes[name];
    if (!scheme) return false;
    const html = document.documentElement;
    html.dataset.theme = scheme;
    html.classList.toggle("dark", scheme === "dark");
    html.style.colorScheme = scheme;
    html.dataset.exampleTheme = name;
    if (stage) stage.dataset.exampleTheme = name;
    return true;
}

// the pre-paint script already applied it; the stage mirrors it
applyTheme(document.documentElement.dataset.exampleTheme ?? "");

window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== window.parent)
        return;
    const data = event.data;
    if (data?.type === THEME && typeof data.theme === "string") {
        applyTheme(data.theme);
    } else if (data?.type === HOST && data.overlay === true) {
        hosted = true;
    } else if (data?.type === PROMOTE) {
        arm(data.rect, data.viewport);
        post({ type: ARMED, id });
    } else if (data?.type === PROMOTED) {
        // again on a resized viewport: the same rule, new values
        arm(data.rect, data.viewport);
        const open = held;
        held = null;
        open?.();
    }
});

// ─── Overlay promotion (§5.4) ──────────────────────────────────────────────

let hosted = false;
/** the overlay waiting for `promoted` */
let held = null;
/** whether the site was asked to promote, so it is told when the overlay is gone */
let asked = false;
let armedStyle = null;

// Pins the stage where the site says it was, and clears the root's background, only while the
// viewport is the promoted one: the media query switches in the same rendering update as the
// frame's new size, so the example never shows displaced, and it stops matching by itself when
// the frame is back in place.
function arm(rect, viewport) {
    if (!rect || !viewport) return;
    armedStyle ??= document.head.appendChild(
        element("style", { "data-armed": "" }),
    );
    armedStyle.textContent = `@media (width: ${viewport.width}px) and (height: ${viewport.height}px) {
    html[data-example-theme], html[data-example-theme] body { background: transparent; }
    #stage, #stage.flow {
        position: fixed;
        left: ${rect.x}px;
        top: ${rect.y}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        margin: 0;
    }
}`;
}

function openOverlay() {
    if (document.querySelector("[data-overlay]") || held) return;
    if (!embedded || !hosted) {
        mountOverlay();
        return;
    }
    const open = () => {
        mountOverlay();
    };
    held = open;
    asked = true;
    post({ type: OVERLAY, id, open: true });
    setTimeout(() => {
        if (held !== open) return;
        held = null;
        open();
    }, HOLD_TIMEOUT_MS);
}

function mountOverlay() {
    const backdrop = element("div", {
        class: "overlay-backdrop",
        "data-overlay": "",
        "data-testid": "overlay-backdrop",
    });
    const close = element("button", {
        type: "button",
        "data-testid": "close-overlay",
        text: "Close",
        onclick: () => closeOverlay(backdrop, panel),
    });
    const panel = element(
        "div",
        {
            class: "overlay-panel",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Fixture dialog",
            "data-overlay": "",
            "data-testid": "overlay-panel",
        },
        element("p", { text: "A modal overlay." }),
        close,
    );
    document.body.append(backdrop, panel);
    // the viewport the opening transition starts in, for the tests
    requestAnimationFrame(() => {
        window.overlayFirstFrame = {
            viewport: { width: innerWidth, height: innerHeight },
            panel: panel.getBoundingClientRect().toJSON(),
        };
        requestAnimationFrame(() => {
            backdrop.dataset.open = "";
            panel.dataset.open = "";
        });
    });
    close.focus();
}

function closeOverlay(backdrop, panel) {
    if (!("open" in panel.dataset)) return;
    delete backdrop.dataset.open;
    delete panel.dataset.open;
    panel.addEventListener(
        "transitionend",
        () => {
            backdrop.remove();
            panel.remove();
            if (!asked) return;
            asked = false;
            post({ type: OVERLAY, id, open: false });
        },
        { once: true },
    );
}

function element(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
        else if (key === "text") node.textContent = value;
        else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
}

function afterPaint(callback) {
    requestAnimationFrame(() => requestAnimationFrame(callback));
}

function renderIndex() {
    stage.append(
        element(
            "ul",
            { class: "index" },
            ...Object.keys(config.examples).map((key) =>
                element(
                    "li",
                    {},
                    element("a", { href: `?id=${key}`, text: key }),
                ),
            ),
        ),
    );
}

function renderExample(example) {
    let count = 0;
    const counter = element("button", {
        type: "button",
        "data-testid": "counter",
        text: "Count: 0",
        onclick: () => {
            count += 1;
            counter.textContent = `Count: ${count}`;
        },
    });
    const root = element(
        "div",
        {
            class: "example",
            "data-testid": "example-root",
            "data-layout": example.layout,
        },
        element("h1", { text: example.title }),
        element("p", {
            "data-testid": "framework",
            text: `${config.framework} · ${id}`,
        }),
        counter,
        element("textarea", { "aria-label": "Notes", "data-testid": "notes" }),
    );
    if (example.overlay) {
        root.append(
            element("button", {
                type: "button",
                "data-testid": "open-overlay",
                text: "Open dialog",
                onclick: openOverlay,
            }),
        );
    }
    if (example.popout) {
        root.append(
            element("button", {
                type: "button",
                "data-testid": "popout",
                text: "Pop out",
                onclick: () => {
                    const theme = document.documentElement.dataset.exampleTheme;
                    window.open(
                        `${base}popout/?${new URLSearchParams({ id, theme })}`,
                        "_blank",
                        "popup,width=640,height=420",
                    );
                },
            }),
        );
    }
    if (example.layout === "flow") {
        const rows = element("ol", { "data-testid": "rows" });
        const addRow = () =>
            rows.append(
                element("li", {
                    class: "row",
                    text: `Row ${rows.children.length + 1}`,
                }),
            );
        for (let index = 0; index < (example.rows ?? 2); index += 1) addRow();
        root.append(
            rows,
            element("button", {
                type: "button",
                "data-testid": "grow",
                text: "Add a row",
                onclick: addRow,
            }),
        );
    }
    stage.append(root);

    const ready = () => {
        post({ type: READY, id });
        if (example.layout !== "flow") return;
        let last = -1;
        new ResizeObserver(() => {
            const height = Math.ceil(root.getBoundingClientRect().height);
            if (height === last) return;
            last = height;
            post({ type: RESIZE, id, height });
        }).observe(root);
    };
    afterPaint(() => setTimeout(ready, example.readyDelay ?? 0));
}

if (stage) {
    if (!id) renderIndex();
    else if (!config.examples[id]) {
        stage.append(
            element("div", { role: "alert", text: `Unknown example "${id}"` }),
        );
        afterPaint(() => post({ type: READY, id }));
    } else {
        const example = config.examples[id];
        if (example.layout === "flow") stage.classList.add("flow");
        renderExample(example);
    }
}
