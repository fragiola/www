// The fixture embed app (www/fixtures): a stand-in for a project's real embed app, with no build
// and no framework, that follows the site export contract v1 §5 to the letter, so the site's
// tests can drive every part of it:
//
//   index.html?id=<id>&theme=<name>   one example on the whole viewport, no chrome; the theme is
//                                     applied before the first paint (the inline script in
//                                     index.html), a missing or unknown one is the first light
//   fragiola:example:ready            once, after the first render (`readyDelay` holds it back)
//   fragiola:example:resize           after ready, on every content height change (flow only)
//   fragiola:example:theme            applied without a reload; an unknown theme is ignored
//   popout.html                       opened by the "Pop out" button, under the same base
//
// Each example renders a counter (reset tests), a textarea, and for a flow example rows that
// "Add a row" grows (resize tests). The configuration is the JSON block in index.html.

const config = JSON.parse(
    document.getElementById("fixture-config")?.textContent ?? "{}",
);
const READY = "fragiola:example:ready";
const RESIZE = "fragiola:example:resize";
const THEME = "fragiola:example:theme";

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
    }
});

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
    if (example.popout) {
        root.append(
            element("button", {
                type: "button",
                "data-testid": "popout",
                text: "Pop out",
                onclick: () => {
                    const theme = document.documentElement.dataset.exampleTheme;
                    window.open(
                        `${base}popout.html?${new URLSearchParams({ id, theme })}`,
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
