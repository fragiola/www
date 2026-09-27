# www — fragiola.com

The **single site** of every Fragiola project: `/` (the organization), `/ui`, `/dockable`, and
later `/grid`, `/scheduler`, … A project never ships a docs site of its own. It **exports** its
pages, its examples and (optionally) its registry with one command, and this repo owns
everything else: the shell, navigation, search, the example gallery, the code panel, the site
theme. The output is a static Next.js + Fumadocs export (`out/`) on GitHub Pages.

**`CONTRACT.md` is the source of truth** for what a project exports and what this repo checks.
Read it before touching anything that reads `.sources/`. If the code and the contract disagree,
the contract wins; if the contract does not close, stop and say so rather than improvise.

## Non-negotiable rules

Do not "fix" these.

1. **The contract is checked before anything is built.** `prepare:site` (the first half of
   `pnpm build` and `pnpm dev`) runs `lib/contract/validate.ts` on every export and fails with
   `<file>:<line>:<column>: <message>` for each problem: contract version, config ↔ files,
   frontmatter, vocabulary, links, `<Example id>`/`<InstallCommand item>`/manifest references,
   levels and themes, registry namespacing and duplicates (§8). A broken link fails the build.
   Never downgrade a check to a warning to get a build through: fix the export.
2. **One module per rule.** Links are classified and rewritten only by `lib/contract/links.ts`
   (the checks, the MDX components and the gallery all use it). Pages are read only by
   `lib/contract/mdx.ts` (a real MDX parse with positions, never regexes over the source).
3. **A project's code never runs in the site's page.** Examples are the project's embed app in
   an `<iframe>` (§5): hidden until `fragiola:example:ready`, sized by `layout`/`height`/`resize`,
   themed by `?theme=` and the `theme` message. The iframe is created only after hydration
   (a frame loaded before hydration could say ready before anyone listens). Reset remounts it.
4. **The site resolves the theme.** The embeds never read the site's `localStorage`: the site
   resolves its own theme (including `system`) and always passes an explicit example theme — the
   chosen one, else the first theme of the site's scheme.
5. **A page carries no code.** The code panel's files are static JSON written by `prepare:site`
   (`public/<slug>/code/`, highlighted with Shiki at build time) and fetched when a panel opens;
   the manifest's `shared` files once per project and framework (`lib/code.ts`). The panel itself
   is a dynamic import. Do not pass file contents through props or RSC payloads.
6. **The gallery is dockable's gallery, made generic.** `components/gallery/` is a port of
   `../dockable/apps/docs/components/site/` (examples-chrome, examples-shell, code-panel): the
   persistent layout (list scroll and filter kept), the header, the toolbar (themes with swatches,
   Reset, Fullscreen, Code), the URL state, the remembered theme, the setup command, the mobile
   overlay. Behaviour changes go through its specs (`e2e/shell.spec.ts`), which are ported too.
7. **The framework choice is site-wide** (`localStorage["fragiola:framework"]`, `?framework=` in
   the gallery). An example missing in the chosen framework says so; it never disappears.
8. **This repo never installs a project's dependencies.** `site:export` and `site:dev` run in the
   project's own checkout with its own lockfile.

## Commands

| command | does |
|---|---|
| `pnpm install` | install dependencies |
| `pnpm sources:sync [slug…]` | `site:export` in each project (`localPath`, or `$FRAGIOLA_PROJECTS_DIR/<slug>` in CI; `--install` first installs it) into `.sources/<slug>`, then the contract checks |
| `pnpm sources:fixtures` | fill `.sources/` from `fixtures/` instead (what the tests build from) |
| `pnpm prepare:site` | checks, then embed apps → `public/<slug>/embed/`, code → `public/<slug>/code/`, registries → `public/r/`, the theme from ui's registry → `styles/fragiola/` |
| `pnpm build` | `prepare:site` + `next build` → `out/` |
| `pnpm dev [--port n]` | the site on :3000 with the projects live: `<localPath>/site/docs` mirrored and re-checked on every change, `site:dev` started for a project with `devUrl` and `/<slug>/embed/**` proxied to it (websockets too, so the examples hot-reload) |
| `pnpm serve [port]` | serve `out/` the way GitHub Pages does (:4400) |
| `pnpm check` / `pnpm check:fix` | Biome |
| `pnpm typecheck` | TypeScript 7, no emit (needs `.sources/`) |
| `pnpm test` | Vitest: the contract checks on the fixtures and on broken copies, links, the build failing |
| `pnpm e2e:build` then `pnpm e2e` | Playwright (Chromium) against `out/` built from the fixtures |
| `pnpm measure <origin> <path>… [--no-prefetch] [--click <sel>]` | page weight, raw and gzip, by category |

## Repository layout

```
CONTRACT.md                 the site export contract (v1)
projects.json               { slug, repo, ref, localPath?, devUrl? } per project
lib/contract/               types, links (§3.3), the MDX scan, the checks (§8); Node-free except validate.ts
lib/projects.ts             build-time reads of .sources/ (server only), the shapes sent to the client
lib/code.ts                 the code panel's files: URLs, fetch-once cache
app/                        / (organization), /[project] (landing), /[project]/docs, /[project]/examples, /api/search
components/gallery/         the gallery: chrome (layout), example view (page)
components/example-frame.tsx  the iframe side of §5
components/example-block.tsx  <Example> in a page: inline, bleed, card
components/mdx.tsx          the v1 vocabulary
scripts/                    sources-sync, sources-fixtures, prepare-site, dev, serve, measure
fixtures/<slug>/            a minimal v1 export per project (fixtures/README.md)
tests/                      Vitest
e2e/                        Playwright
```

## Conventions

- Biome: 4-space indent, double quotes, LF, trailing newline, organized imports.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. Do not relax it;
  a blanket `!` on every index access is not a fix.
- Scripts run with Node's type stripping: erasable syntax only, relative imports with `.ts`.
- Pin dependencies to exact versions published at least 7 days ago (`minimumReleaseAge`).
- Commits are gitmoji-conventional: `✨ feat: …`, `🐛 fix: …`, `✅ test: …`, `🔧 chore: …`,
  `👷 ci: …`, `📝 docs: …`.
- Nothing is pushed and no remote is created by an agent: the GitHub repo, its secrets and Pages
  are set up by a maintainer (README.md, "Deploying").
