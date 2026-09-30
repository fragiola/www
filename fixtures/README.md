# Fixtures

One minimal site export per project of `projects.json`, following the contract v1.2
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

They were generated once from the proof of concept's v0 exports (`site:export` of the `poc/www`
branches of `ui` and `dockable`), then converted to v1: frontmatter on every page, links written
base-free and pointed at pages that exist here, the v1 vocabulary (`Steps`, `Cards`, `Hero`,
`Callout title`, titled code blocks, `Example variant`/`theme`/`framework`), `examples.json`,
manifests with the gallery fields and the shared files stored once, `#/` imports, and a registry
whose dependencies are all namespaced. Edit them by hand from now on.

What is **not** the real projects':

- **The embed apps** (`*/embed/<fw>/`) are one small app with no build and no framework
  (`app.js`, the same file in every embed), not the projects' React apps. It follows §5 to the
  letter, so the tests can drive all of it: `?id=`/`?theme=` before the first paint, `ready`,
  `resize` for a `flow` example (its "Add a row" button grows it), the `theme` message, and
  `popout/` under the same base (by its directory, like the embed: `serve` drops the query of
  `popout.html?…`). Each example renders a counter (the Reset tests), a
  textarea, and its framework and id. `readyDelay` in the JSON block of `index.html` holds
  `ready` back (`slow-start`: the frame must stay hidden until then).
- **`dockable` has a `vue` framework** with three of its examples, so the framework switcher, the
  framework-only sidebar section and "an example missing in the selected framework" are tested.
  Dockable has no Vue adapter yet.
- **More examples** than the POC exported (`add-tabs`, `maximize`, …), with placeholder sources,
  so the gallery's list has levels to group and a scroll to keep.

The files in `*/embed/<fw>/manifest.json` are what the code panel shows (§6), verbatim.
