# Fixtures

One minimal site export per project of `projects.json`, following the contract v1.7
(`../CONTRACT.md`). `pnpm sources:fixtures` copies them into `.sources-fixtures/` (never
`.sources/`, which holds the projects' exports), and the tests build the site from them
(`pnpm e2e:build`), so the suite needs no project repo and runs against content it controls.

The landings use the whole v1.1 landing vocabulary: ui's a grid `Hero` with an eyebrow and an
arrowed primary action, `Section`s with eyebrows, numbered `Features`, a `bleed` example; dockable's
the `{examples}` token, a ghost external action, an `<Example variant="showcase">`, four
`Features` across and struck-out `Pills`. Both `project.json` have a `repository`, and ui's
sidebar has collapsible sections (Atoms open by default, Menus closed).

For v1.2 (search and sharing) the landings' titles are search titles that name the project
("Dockable — headless dockable panel layouts for React"), every description is 50–160
characters, headings do not skip a level, ui's `project.json` has `keywords` (dockable's has
none, so both cases are built), and every embed HTML file carries
`<meta name="robots" content="noindex">`.

For v1.6 ui's `project.json` declares `create` (React) and ships `embed/react/create.html`, a
stand-in Create page (its own header linking to the docs, a main area that scrolls inside it,
`ready` with id `create`, and the `host` and `theme` it receives recorded on its root for the
tests); its landing's `Hero` has a `/create` action. No other fixture declares one, so both cases
are built.

For v1.7 dockable's landing `Hero` orders its actions examples, then the agent (`/ai`, the site's
AI agents docs), then the docs; every landing gets the agent band (after dockable's, data-grid's
and primitives' showcase, after the others' `Hero`).
ui exports a stand-in `palettes` example (React only), so the organization's landing builds its
"One class, one palette" section; the tests cover its absence (no section) on a copy
(`tests/featured.test.ts`).

For v1.5 every library but flow and primitives lists `adapters` (`vanilla`, `react`, `vue`, `angular`) and ui none, so
both cases are built; most fixtures embed React only, so the landing shows linked and plain adapters.

For v1.4 ui's sidebar names icons (§3.1): every section has one, and the Installation page too,
while the other pages and every other fixture name none, so both are built.

They were generated once from the proof of concept's v0 exports (`site:export` of the `poc/www`
branches of `ui` and `dockable`), then converted to v1: frontmatter on every page, links written
base-free and pointed at pages that exist here, the v1 vocabulary (`Steps`, `Cards`, `Hero`,
`Callout title`, titled code blocks, `Example variant`/`theme`/`framework`), `examples.json`,
manifests with the gallery fields and the shared files stored once, `#/` imports, and a registry
whose dependencies are all namespaced. Edit them by hand from now on.

`data-grid` was written by hand for v1.2 when the project joined: a landing, two pages, three of
its examples with placeholder sources (no registry items), and the shared fixture embed app. Its
landing has a `bleed` example first and a `showcase` one after it, so the organization's landing
("See it live", which features a landing's showcase first, else its first `<Example>`) covers both.
`grid-layout` was written the same way when it joined.
`dnd` was written the same way when it joined.
`tree` was written the same way when it joined, with three frameworks (`react`, `vue`,
`angular`), each an embed of the shared fixture app with the three examples.
`splitter` was written the same way when it joined.
`flow` was written the same way when it joined; like the real export, its `project.json` lists no
`adapters`.
`primitives` was written the same way when it joined, with three frameworks (`react`, `vue`,
`angular`) and, like the real export, no `adapters` and five themes; its landing's showcase is
the `dialog` example (theme `light`), an `"overlay": true` example like ui's `clickable`, so a
modal example is promoted from a landing's showcase too (`e2e/promotion.spec.ts`); its `app.css`
has the overlay's styles, like ui's.

What is **not** the real projects':

- **The embed apps** (`*/embed/<fw>/`) are one small app with no build and no framework
  (`app.js`, the same file in every embed), not the projects' React apps. It follows §5 to the
  letter, so the tests can drive all of it: `?id=`/`?theme=` before the first paint, `ready`,
  `resize` for a `flow` example (its "Add a row" button grows it), the `theme` message, and
  `popout/` under the same base (by its directory, like the embed: `serve` drops the query of
  `popout.html?…`). Each example renders a counter (the Reset tests), a
  textarea, and its framework and id. `readyDelay` in the JSON block of `index.html` holds
  `ready` back (`slow-start`: the frame must stay hidden until then).
  Since v1.3 it also sets its root's `color-scheme` to the theme's scheme, and an example with
  `"overlay": true` in that JSON block (`ui`'s `clickable`) has an "Open dialog" button: a modal
  overlay that follows overlay promotion (§5.4) — it waits for `host`, asks, arms on `promote`
  (a stylesheet under a media query of the promoted viewport), opens on `promoted`, slides in
  from the viewport's inline-end edge, and says it has closed once its exit transition has
  ended (`e2e/promotion.spec.ts`).
- **`dockable` has a `vue` framework** with three of its examples, so the framework switcher, the
  framework-only sidebar section and "an example missing in the selected framework" are tested.
  Dockable has no Vue adapter yet.
- **More examples** than the POC exported (`add-tabs`, `maximize`, …), with placeholder sources,
  so the gallery's list has levels to group and a scroll to keep.

The files in `*/embed/<fw>/manifest.json` are what the code panel shows (§6), verbatim.
