# Site export contract, v1

`fragiola.com` is one static site built by this repo (`www`) from the exports of separate
project repos (`ui`, `dockable`, and later `grid`, `scheduler`, …). A project never ships a docs
site of its own: it **provides** pages, examples and (optionally) a registry through one command,
and `www` owns everything else — the shell, navigation, search, the example gallery, the code
panel, the site theme.

This file is the source of truth. A project states the version it implements
(`project.json` → `contract`), and `www` rejects an export that does not match.

Changes from v0 (the POC) are listed at the end.

---

## 1. The command

Every project exposes, at its repo root:

```
pnpm site:export --base /<slug> --out <dir>
```

- It runs inside the project repo with the project's own install and lockfile. `www` never
  installs a project's dependencies into its own workspace.
- `--base` is the project's mount point on the site (`/dockable`). The project needs it only to
  build its embed apps (§5); pages are written base-free (§3.3).
- It validates its own output against this contract and exits non-zero on any violation.
- It only deletes `--out` when that folder holds a previous export.

A project **should** also expose `pnpm site:dev --base /<slug> --port <n>`, which serves the
embed apps (§5) with hot reload, so `www` in dev can proxy `/<slug>/embed/**` to it.

## 2. Output layout

```
<out>/
  project.json
  docs/
    config.json
    index.mdx                 the project's landing (§3.5)
    **/*.mdx                  pages
  examples.json               gallery configuration (§4)
  embed/<framework>/          one static app per framework (§5)
    index.html
    manifest.json
    popout.html …             anything else the app needs, under its own base
  r/                          optional: the project's registry items (§7)
    index.json
    <item>.json
```

### `project.json`

```jsonc
{
    "contract": 1,
    "slug": "dockable",
    "title": "Dockable",
    "description": "One sentence.",
    "frameworks": ["react"],          // every framework with an embed app
    "defaultFramework": "react",
    "registry": { "namespace": "@fragiola" }   // only when r/ is present
}
```

## 3. Pages

### 3.1 Files and sidebar

Pages are `.mdx` under `docs/`. A page's path is its file path without the extension
(`guides/tabs.mdx` → `guides/tabs`). `docs/config.json` is the sidebar:

```jsonc
{
    "sections": [
        {
            "label": "Guides",
            "framework": "react",            // optional: shown only for this framework
            "pages": [
                { "label": "Tabs", "path": "guides/tabs" },
                { "label": "Found a problem?", "href": "https://github.com/…", "external": true }
            ]
        }
    ]
}
```

Every `.mdx` except `index.mdx` appears in `config.json` exactly once, and every `path` exists.

### 3.2 Frontmatter

`title` and `description` are required on every page. `index.mdx` also takes
`layout: "landing"`.

### 3.3 Links

Pages link **base-free**, as if the project were at the root:

| written | served at |
|---|---|
| `/docs/guides/tabs#anchor` | `/<slug>/docs/guides/tabs#anchor` |
| `/examples/add-tabs` | `/<slug>/examples/add-tabs` (the gallery, §4) |
| `/` | `/<slug>` (the landing) |

Relative file links (`../x.mdx`) are not allowed. `www` rewrites links and **fails the build on a
link to a page, anchor or example that does not exist**.

### 3.4 Vocabulary

Plain Markdown with GFM (tables, task lists, strikethrough). Fenced code blocks take a language
and an optional `title="…"`. Beyond that, only these components; anything else fails the export
and the build.

| component | props | renders |
|---|---|---|
| `<Example>` | `id`, `framework?`, `theme?`, `height?`, `variant?: "inline" \| "bleed" \| "card"` | `inline` (default): the embed plus a toggleable code panel. `bleed`: full-width embed, no chrome (landings). `card`: a link card to the gallery. |
| `<Callout>` | `type: "info" \| "warn" \| "danger"`, `title?` | a callout |
| `<Tabs>` / `<Tab>` | `items` / `value` | tabs |
| `<Steps>` / `<Step>` | — | a numbered procedure |
| `<Cards>` / `<Card>` | `title`, `href`, `description?` | link cards (`href` follows §3.3) |
| `<InstallCommand>` | `item` | the registry install command for `<namespace>/<item>`; the item must exist in `r/` |
| `<Framework>` | `name` | its children only when that framework is selected |
| `<Hero>` | `title`, `description?`, `actions?: { label, href }[]` | the landing header (landing only) |

### 3.5 Landing

`docs/index.mdx` with `layout: "landing"` is served at `/<slug>`. It is a normal page in the
vocabulary above, typically a `<Hero>` and an `<Example variant="bleed">` for a live demo. The
project owns its hero, docs and examples; `www` only provides the layout around them.

## 4. The example gallery

Every project with examples gets **the same gallery**, rendered by `www` at
`/<slug>/examples/<id>` (and `/<slug>/examples` → the first example). It is the dockable gallery
as it exists today, made generic:

- **List** on the side, grouped by level in `examples.json` order and sorted by `order` inside a
  level; a filter over title, description and features. The gallery is a persistent layout: the
  list keeps its scroll and its filter while moving between examples.
- **Header**: title, level, description, feature tags, a link to the example's docs page.
- **Toolbar**: theme switcher (the project's themes, with swatches), **Reset** (remounts the
  example), **Fullscreen**, **Code** (toggles the code panel), and a **framework switcher** when
  the project has more than one framework.
- **Code panel**: the example's files, the selected theme's CSS file, and the setup command
  (registry items + packages). On narrow screens it overlays the stage.
- **URL state**: `?theme=<name>`, `?code=1`, `?framework=<name>`. The chosen example theme is
  remembered per project; the framework choice is site-wide.
- An example missing in the selected framework says so instead of disappearing.

### `examples.json`

```jsonc
{
    "levels": [
        { "id": "basic", "title": "Basic" },
        { "id": "intermediate", "title": "Intermediate" },
        { "id": "advanced", "title": "Advanced" }
    ],
    "themes": [
        {
            "name": "light",
            "title": "Light",
            "description": "Neutral and quiet: the reference look.",
            "scheme": "light",                 // "light" | "dark"
            "swatch": ["oklch(…)", "oklch(…)"],
            "file": { "path": "_themes/light.css", "lang": "css", "content": "…" }  // optional
        }
    ]
}
```

A project with no themes of its own declares one `light` and one `dark` theme. The first theme of
each scheme is the default for that scheme.

## 5. Embed apps

One static app per framework, built with base `<base>/embed/<framework>/`.

### 5.1 Rendering

- `index.html?id=<id>&theme=<name>` renders **only** that example, filling the viewport, with no
  chrome.
- An inline script applies `theme` before first paint (the theme's `name` and `scheme`, however
  the project maps them onto its own DOM — e.g. `data-theme` and `.dark` on `<html>`, plus
  `data-example-theme` on the stage). Missing or unknown `theme` → the project's first `light`
  theme.
- The app never reads the site's `localStorage`. `www` resolves the site theme (including
  `system`) and always passes an explicit example theme.
- Anything the app opens (a popout window) lives under the same base.

### 5.2 Messages

Same origin; always `postMessage(message, location.origin)`.

| direction | message | when |
|---|---|---|
| embed → site | `{ type: "fragiola:example:ready", id }` | once, after the example's first render (lazy parts mounted) |
| embed → site | `{ type: "fragiola:example:resize", id, height }` | after `ready`, whenever the content height changes (not for `layout: "fill"`) |
| site → embed | `{ type: "fragiola:example:theme", theme }` | the user changes the theme; the embed applies it without reloading |

`www` keeps the iframe hidden until `ready`. Reset reloads the iframe.

### 5.3 `manifest.json`

```jsonc
{
    "files": {
        // every source file shown by any example, once
        "add-tabs/index.tsx": { "lang": "tsx", "content": "…" },
        "_kit/layout.tsx": { "lang": "tsx", "content": "…", "shared": true }
    },
    "examples": [
        {
            "id": "add-tabs",
            "title": "Add tabs",
            "description": "One or two sentences.",
            "level": "basic",                 // an id from examples.json
            "order": 5,
            "features": ["Actions.addTab", "DockLocation"],
            "docs": "/docs/guides/tabs",      // optional, base-free (§3.3)
            "layout": "fill",                 // "fill": fills a fixed height | "flow": grows with content
            "height": 480,                    // "fill": the height; "flow": the minimum height
            "files": ["add-tabs/index.tsx", "_kit/layout.tsx"],   // entry first
            "registry": ["select"],           // registry items it uses, without namespace
            "packages": ["@fragiola/dockable-react"]
        }
    ]
}
```

- `id`s are the same across frameworks: `add-tabs` in React and in Vue is one gallery entry.
- `height` on a `flow` example is a floor: set it so overlays (menus, popovers, selects) fit
  without the component shrinking them.
- The code panel shows the files **verbatim** (§6).

## 6. Code shown to readers

Examples import a project's internal modules through **`#/…`** (`#/components/ui/select`,
`#/lib/cn`), never `@/…`: `@name` is reserved for packages (`@fragiola/dockable-react`,
`@tanstack/…`), so `#/` cannot be mistaken for one. The code panel shows it as written; the
setup command lists the registry items and packages the reader needs.

## 7. Registry

- Optional; declared by `project.json` → `registry.namespace`.
- Every `registryDependencies` entry is namespaced (`"@fragiola/cn"`) or a full URL. Bare names
  are rejected: the shadcn CLI resolves them against its own default registry.
- `r/index.json` lists the project's items. `www` serves every project's items at `/r/` (the
  domain root), merges the indexes, and **fails the build when two projects export the same
  item**.
- `<InstallCommand item="x">` and the gallery's setup command render
  `npx shadcn@latest add <namespace>/<x>`.

## 8. What `www` validates

On every build, per project: contract version; config ↔ files; frontmatter; vocabulary; links
(§3.3); `<Example id>`, `<InstallCommand item>` and manifest references; levels and themes in
the manifest exist in `examples.json`; registry namespacing and duplicates.

## 9. Delivery

`projects.json` in `www` lists `{ slug, repo, ref, localPath?, devUrl? }`. The deploy workflow
clones each `repo@ref`, runs `site:export`, builds and publishes. It runs on push to `www`, on a
schedule, on demand, and on `repository_dispatch` sent by a project's CI after a push to its
default branch.

---

## Changes from v0

- `site:export` output gains `examples.json`, `index.mdx`, `r/index.json`; examples move from
  `examples/<fw>/` to `embed/<fw>/` so `/<slug>/examples/<id>` is free for the gallery.
- Links are written base-free and rewritten by `www`; broken links fail the build.
- Vocabulary adds `Steps`, `Cards`, `Hero`, `Callout title`, code block `title`, `Example theme`
  and `variant`, external sidebar links; frontmatter is required.
- Theme: the embed no longer reads `localStorage`; `www` passes `?theme=` and a `theme` message.
  Pre-paint script is required.
- Height: `ready` before the first `resize`; `layout: "fill" | "flow"`; `height` is a floor on
  `flow`.
- Manifest: gallery fields (`level`, `order`, `features`, `docs`), `registry`/`packages`, shared
  files stored once.
- Imports shown as `#/…`.
- Registry: namespaced dependencies only; served at `/r`; per-project index merged by `www`.
