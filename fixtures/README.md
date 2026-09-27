# Fixtures

One minimal site export per project of `projects.json`, following the contract v1
(`../CONTRACT.md`). `pnpm sources:fixtures` copies them into `.sources/`, and the tests build the
site from them (`pnpm e2e:build`), so the suite needs no project repo and runs against content it
controls.

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
  `popout.html` under the same base. Each example renders a counter (the Reset tests), a
  textarea, and its framework and id. `readyDelay` in the JSON block of `index.html` holds
  `ready` back (`slow-start`: the frame must stay hidden until then).
- **`dockable` has a `vue` framework** with three of its examples, so the framework switcher, the
  framework-only sidebar section and "an example missing in the selected framework" are tested.
  Dockable has no Vue adapter yet.
- **More examples** than the POC exported (`add-tabs`, `maximize`, …), with placeholder sources,
  so the gallery's list has levels to group and a scroll to keep.

The files in `*/embed/<fw>/manifest.json` are what the code panel shows (§6), verbatim.
