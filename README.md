# fragiola.com

The single site for every Fragiola project: `/` (landing), `/ui`, `/dockable`, …
Each project lives in its own repo and exposes a **site export**; this repo
assembles the exports into one static Next.js + Fumadocs site, published on
GitHub Pages.

> Status: proof of concept.

## The "site export" contract (v0)

Every project implements, at its repo root:

```sh
pnpm site:export --base /<slug> --out <dir>
```

It runs in the project's own repo, with its own install and lockfile. The
output:

```
<out>/
  project.json        { slug, title, description, frameworks, defaultFramework }
  docs/config.json    { sections: [{ label, framework?, pages: [{ label, path }] }] }
  docs/**/*.mdx       the pages (`path` = file path without .mdx)
  examples/<fw>/      static app built for <base>/examples/<fw>/, `?id=<id>` renders one example
    manifest.json     [{ id, title, description?, height?, files: [{ path, lang, content }] }]
  r/                  (optional) shadcn registry JSON
```

MDX components: `<Example>`, `<Callout>`, `<Tabs>`/`<Tab>`, `<InstallCommand>`,
`<Framework>` — nothing else.

## How the site is built

| command | does |
|---|---|
| `pnpm sources:sync` | runs `site:export` in every project of `projects.json` into `.sources/<slug>/` and checks the output |
| `pnpm prepare:site` | copies the examples apps to `public/<slug>/examples/`, merges the registries into `public/r/` (the same item from two projects fails), vendors the theme from `.sources/ui/r` into `styles/fragiola/` |
| `pnpm build` | `prepare:site` + `next build` → `out/` |
| `pnpm dev` | `prepare:site` + `next dev` |
| `pnpm check` / `pnpm typecheck` | Biome / TypeScript |

`projects.json` lists `{ slug, repo, ref, localPath }`. Locally a project is
read from `localPath`; in CI (`.github/workflows/deploy-pages.yml`) from a
clone of `repo@ref` under `$FRAGIOLA_PROJECTS_DIR`.
