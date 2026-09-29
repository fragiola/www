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

1. **The contract is checked before anything is built, and only real exports are published.** `prepare:site` (the first half of
   `pnpm build` and `pnpm dev`) runs `lib/contract/validate.ts` on every export and fails with
   `<file>:<line>:<column>: <message>` for each problem: contract version, config ↔ files,
   frontmatter, vocabulary, links, `<Example id>`/`<InstallCommand item>`/manifest references,
   levels and themes, registry namespacing and duplicates (§8). A broken link fails the build.
   Never downgrade a check to a warning to get a build through: fix the export. `pnpm build`
   refuses the fixtures (they live in `.sources-fixtures/`, built with `--fixtures`), an empty
   `.sources/`, and an export older than its checkout: re-sync instead of forcing it.
2. **One module per rule.** Links are classified and rewritten only by `lib/contract/links.ts`
   (the checks, the MDX components and the gallery all use it). Pages are read only by
   `lib/contract/mdx.ts` (a real MDX parse with positions, never regexes over the source).
3. **A project's examples never run in the site's page.** Examples are the project's embed app in
   an `<iframe>` (§5): hidden until `fragiola:example:ready`, sized by `layout`/`height`/`resize`,
   themed by `?theme=` and the `theme` message. The iframe is created only after hydration
   (a frame loaded before hydration could say ready before anyone listens). Reset remounts it.
   This is about examples only: the Fragiola UI components the site itself is built with (the
   header's navigation menu) are copied from ui's registry into this repo, the way a consumer
   installs them (`pnpm registry:copy`), and are the site's own code from then on, like the
   theme `prepare:site` vendors. Never edit the copies: a fix belongs in `../ui`, then re-copy.
4. **The site resolves the theme.** The embeds never read the site's `localStorage`: the site
   resolves its own theme (including `system`) and always passes an explicit example theme — the
   chosen one, else the first theme of the site's scheme.
5. **A page carries no code.** The code panel's files are static JSON written by `prepare:site`
   (`public/<slug>/code/`, highlighted with Shiki at build time) and fetched when a panel opens;
   the manifest's `shared` files once per project and framework (`lib/code.ts`). The panel itself
   is a dynamic import. Do not pass file contents through props or RSC payloads.
6. **The gallery is dockable's gallery, made generic.** `components/gallery/` is a port of
   `../dockable/apps/docs/components/site/` (examples-chrome, examples-shell, code-panel): the
   persistent layout (list scroll and filter kept), the toolbar (themes with swatches,
   Reset, Fullscreen, Code), the URL state, the remembered theme, the setup command, the mobile
   overlay. Behaviour changes go through its specs (`e2e/shell.spec.ts`), which are ported too.
   Its header is not its own: it is the site header, as on every page (rule 9).
7. **The framework choice is site-wide** (`localStorage["fragiola:framework"]`, `?framework=` in
   the gallery). An example missing in the chosen framework says so; it never disappears.
8. **This repo never installs a project's dependencies.** `site:export` and `site:dev` run in the
   project's own checkout with its own lockfile.
9. **One header, the same on every page.** `components/site-header.tsx` is the header of the
   organization's landing, a project's landing, its docs and its gallery: the wordmark, the
   Projects menu (every project of `projects.json`), then under `/<slug>/**` the project's title,
   Docs and Examples; search, the theme and GitHub on the right. What it shows is computed at
   build time (`siteHeader()`, `lib/layout.shared.tsx`). In the docs it sits above Fumadocs'
   grid, which `--fd-banner-height` pushes down (`.site-docs`, `app/globals.css`); the docs
   sidebar carries no title, links, search or theme of its own. Its specs: `e2e/header.spec.ts`.

## Commands

| command | does |
|---|---|
| `pnpm install` | install dependencies |
| `pnpm sources:sync [slug…]` | `pnpm install --frozen-lockfile` then `site:export` in each project (`localPath`; in CI `$FRAGIOLA_PROJECTS_DIR/<slug>`, installed with `--install`) into `.sources/<slug>`, recording each checkout's commit and changes in `.sources/.origin.json`, then the contract checks |
| `pnpm sources:fixtures` | fill `.sources-fixtures/` from `fixtures/` (what the tests build from; never `.sources/`) |
| `pnpm prepare:site [--fixtures\|--dev] [--check]` | checks, then embed apps → `public/<slug>/embed/`, code → `public/<slug>/code/`, registries → `public/r/`, the theme from ui's registry → `styles/fragiola/`. By default it takes only fresh project exports (fails on an empty `.sources/`, the fixtures, or an export its checkout has moved on from) |
| `pnpm registry:copy [--check]` | copy the Fragiola UI components the site is built with (`navigation-menu` and its registry dependencies) from `.sources/ui/r` to their targets (`components/ui/`, `components/atoms/`, `components/families/`, `lib/cn.ts`), byte for byte; `--check` fails when a copy is behind the registry |
| `pnpm build` | `prepare:site` + `next build` → `out/`, from the projects' exports only |
| `pnpm dev [--port n]` | the site on :3000 with the projects live: `<localPath>/site/docs` mirrored and re-checked on every change, `site:dev` started for a project with `devUrl` and `/<slug>/embed/**` proxied to it (websockets too, so the examples hot-reload) |
| `pnpm serve [port]` | serve `out/` the way GitHub Pages does (:4400) |
| `pnpm check` / `pnpm check:fix` | Biome |
| `pnpm typecheck` | TypeScript 7, no emit (needs `.sources/`, or `FRAGIOLA_SOURCES=.sources-fixtures`) |
| `pnpm test` | Vitest: the contract checks on the fixtures and on broken copies, links, the build failing, the site's own code painting with palette roles only (`tests/palette.test.ts`) |
| `pnpm e2e:build` then `pnpm e2e` / `pnpm e2e:serve` | Playwright (Chromium) against `out/` built from the fixtures (`build --fixtures`), served like Pages / by `serve` (clean URLs) |
| `pnpm measure <origin> <path>… [--no-prefetch] [--click <sel>]` | page weight, raw and gzip, by category |

## Repository layout

```
CONTRACT.md                 the site export contract (v1.1)
projects.json               { slug, repo, ref, localPath?, devUrl? } per project
lib/contract/               types, links (§3.3), the MDX scan, the checks (§8); Node-free except validate.ts
lib/projects.ts             build-time reads of .sources/ (server only), the shapes sent to the client
lib/code.ts                 the code panel's files: URLs, fetch-once cache
lib/layout.shared.tsx       what the site header shows (siteHeader), computed at build time
lib/cn.ts                   Fragiola UI's cn, copied from ui's registry (pnpm registry:copy)
app/                        / (organization), /[project] (landing), /[project]/docs, /[project]/examples, /api/search
components/site-header.tsx  the one header of every page (rule 9)
components/ui/, atoms/, families/  Fragiola UI's components, copied from ui's registry; never edited
components/gallery/         the gallery: chrome (layout), example view (page)
components/example-frame.tsx  the iframe side of §5
components/example-block.tsx  <Example> in a page: inline, bleed, card, showcase
components/landing/         Hero, Action, Section, Features/Feature, Pills, the scroll reveal (§3.4)
                            + hero-scene: the organization landing's WebGL scene (three, on / only,
                              loaded after hydration; e2e/scene.spec.ts, scene-no-webgl.spec.ts)
components/project-footer.tsx the project footer on every landing and docs page (§3.5)
components/mdx.tsx          the v1.1 vocabulary
scripts/                    sources-sync, sources-fixtures, prepare-site, registry-copy, build, dev, serve, measure
fixtures/<slug>/            a minimal v1.1 export per project (fixtures/README.md)
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
