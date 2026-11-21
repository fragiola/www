# www — fragiola.com

The **single site** of every Fragiola project: `/` (the organization), `/ui`, `/dockable`,
`/data-grid`, `/grid-layout`, `/dnd`, `/tree`, `/splitter`, `/flow`, and later `/scheduler`, … A project never ships a docs site of its own. It **exports** its
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
   (the checks, the MDX components and the gallery all use it), the reserved `/ai` link (v1.7, the
   site's AI agents docs, `MCP_PATH`) too. Pages are read only by
   `lib/contract/mdx.ts` (a real MDX parse with positions, never regexes over the source).
3. **A project's examples never run in the site's page.** Examples are the project's embed app in
   an `<iframe>` (§5): hidden until `fragiola:example:ready`, sized by `layout`/`height`/`resize`,
   themed by `?theme=` and the `theme` message, its `color-scheme` the example theme's. The
   iframe is created only after hydration (a frame loaded before hydration could say ready
   before anyone listens). Reset remounts it. The organization's landing holds at most one
   example iframe: its carousel creates the active slide's frame and removes it on the next one, and its palette section shares that one slot with it (`components/landing/live-slot.ts`): the section most in view, or the one the reader just picked, runs; the other shows its placeholder. While the example has a modal overlay open, the
   frame is **promoted** over the whole page (§5.4, `components/example-promotion.ts`): into the
   top layer with `popover="manual"`, never moved in the DOM (a moved iframe reloads), the page's
   scroll held still, the embed keeping its example in place. Still the embed's own document.
   This is about examples only: the Fragiola UI components the site itself is built with (the
   header's navigation menu, the docs' project switcher, the gallery's sidebar) are copied from ui's registry into this
   repo, the way a consumer installs them (`pnpm registry:copy`), and are the site's own code
   from then on, like the theme `prepare:site` vendors. Never edit the copies: a fix belongs in
   `../ui`, then re-copy. Biome does not organize their imports (`biome.json`): the registry's
   aliases, resolved, reorder them.
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
   Its header is not its own: it is the site header, as on the landings (rule 9). Its list is
   Fragiola UI's Sidebar (rule 3): collapsed off canvas on desktop from the header's leading
   slot or Ctrl/⌘+B, the state remembered, a Drawer below 42rem. From `md` the code panel is
   resizable (`components/resizable.tsx`, shadcn's over `react-resizable-panels`, in palette
   roles), its width remembered; below `md` it is the overlay it always was.
7. **The framework choice is site-wide** (`localStorage["@fragiola:framework"]`, `?framework=` in
   the gallery). An example missing in the chosen framework says so; it never disappears. Every
   key the site stores starts with `@fragiola:` and is named in `lib/storage.ts` only; the keys
   written before the prefix move on the first visit (an inline script in `<head>`, before
   next-themes reads `@fragiola:theme`).
8. **This repo never installs a project's dependencies.** `site:export` and `site:dev` run in the
   project's own checkout with its own lockfile.
9. **One navigation: the header on the landings and the gallery, the sidebar in the docs.**
   `components/site-header.tsx` is the header of the organization's landing, a project's landing
   and its gallery: the wordmark, the Projects menu (every project of `projects.json`), then under
   `/<slug>/**` the project's title, Docs and Examples (and Create, when `project.json` declares a
   Create page, v1.6); search, the theme and GitHub on the right.
   The docs have **no header**, as on fumadocs.dev: the same navigation is their sidebar's
   (`components/docs-chrome.tsx`), the same for every project — the wordmark and the collapse
   toggle, the AI agents links (a "Built for AI agents" subtitle and two sidebar rows into the AI
   agents docs, `/ai/docs/skills/` and `/ai/docs/mcp/`; fixed: they never scroll), the
   project switcher (Fragiola UI's dropdown-menu, copied), search, Docs | Examples (| Create),
   the framework select; the project's GitHub and Fragiola's in its footer; the theme in the
   panel's top-right corner; below `md` Fumadocs' bar (wordmark, search, theme, the drawer). The
   controls both share (wordmark, search, theme, GitHub mark) are `components/site-controls.tsx`.
   What either shows is computed at build time (`siteHeader()`, `lib/layout.shared.tsx`). The docs
   grid is not centred: the sidebar sits on the viewport's left edge (`--fd-layout-width`), and
   from `md` the docs are **inset** (`.site-docs`, `app/globals.css`): the sidebar and the gutters
   are one frame surface, the page sits on a rounded panel (`.docs-inset-panel`, a grid item of
   `app/[project]/docs/layout.tsx`). Its specs: `e2e/header.spec.ts`, the chrome and inset ones
   in `e2e/docs.spec.ts`.
10. **Search and sharing is built by `lib/seo.ts` only.** Titles (the landing's own, then
    `· <project>`, then `· Fragiola` while it fits in 60), meta descriptions (plain text, 50–160),
    canonical URLs (absolute, trailing slash, no query), the Open Graph and Twitter cards (one
    share image per project, `app/**/og.png/route.tsx`) and the JSON-LD (`components/json-ld.tsx`,
    in the page's static HTML) come from its builders; a page never writes them by hand.
    `robots.txt`, `sitemap.xml` and the manifest are static routes (`force-static`). Redirect
    pages are `noindex`; the embeds say so themselves (CONTRACT.md §5.1). The brand's colours are
    tokens of the vendored theme (`lib/brand.ts`, `tests/brand.test.ts`), and every icon is drawn
    from the mark by `pnpm brand:icons`, never edited by hand. Its specs: `e2e/seo.spec.ts`.

## Commands

| command | does |
|---|---|
| `pnpm install` | install dependencies |
| `pnpm sources:sync [slug…]` | `pnpm install --frozen-lockfile` then `site:export` in each project, the projects side by side (`localPath`; in CI `$FRAGIOLA_PROJECTS_DIR/<slug>`, installed with `--install`) into `.sources/<slug>`, recording each checkout's commit and changes in `.sources/.origin.json`, then the contract checks |
| `pnpm sources:fixtures` | fill `.sources-fixtures/` from `fixtures/` (what the tests build from; never `.sources/`) |
| `pnpm prepare:site [--fixtures\|--dev] [--check]` | checks, then embed apps → `public/<slug>/embed/`, code → `public/<slug>/code/`, registries → `public/r/`, the agent index → `public/agents/` + `public/llms.txt` (`lib/agents.ts`), the theme from ui's registry → `styles/fragiola/`. By default it takes only fresh project exports (fails on an empty `.sources/`, the fixtures, or an export its checkout has moved on from) |
| `pnpm registry:copy [--check]` | copy the Fragiola UI components the site is built with (`dropdown-menu`, `navigation-menu`, `sidebar` and their registry dependencies, the theme and the palettes left to `prepare:site`) from `.sources/ui/r` to their targets (`components/ui/`, `components/atoms/`, `components/families/`, `lib/cn.ts`), byte for byte; `--check` fails when a copy is behind the registry |
| `pnpm brand:icons` | draw every icon from the mark in `lib/brand.ts` with Playwright's Chromium: `public/brand/fragiola-mark.svg`, `app/icon.svg`, `app/favicon.ico` (16/32/48), `app/apple-icon.png`, the manifest's icons and the 512 px logo in `public/brand/`; the same machine gives the same bytes. Run it when the mark or the palette changes (`tests/brand.test.ts` fails then) |
| `pnpm build` | `prepare:site` + `next build` → `out/`, from the projects' exports only |
| `pnpm dev [--port n]` | the site on :3000 with the projects live: `<localPath>/site/docs` mirrored and re-checked on every change, `site:dev` started for a project with `devUrl` and `/<slug>/embed/**` proxied to it (websockets too, so the examples hot-reload) |
| `pnpm serve [port]` | serve `out/` the way GitHub Pages does (:4400) |
| `pnpm check` / `pnpm check:fix` | Biome |
| `pnpm typecheck` | TypeScript 7, no emit (needs `.sources/`, or `FRAGIOLA_SOURCES=.sources-fixtures`) |
| `pnpm test` | Vitest: the contract checks on the fixtures and on broken copies, links, the build failing, the site's own code painting with palette roles only (`tests/palette.test.ts`; the frameworks' marks keep their brands' colours), the brand's colours being the theme's tokens and the icon files (`tests/brand.test.ts`, after `prepare:site`), the agent index against fragiola/cli's contract (`tests/agents.test.ts`) |
| `pnpm e2e:build` then `pnpm e2e` / `pnpm e2e:serve` | Playwright (Chromium) against `out/` built from the fixtures (`build --fixtures`): the whole suite served like Pages / the `@serve` tests (whose result depends on how a static server maps URLs, query strings, redirects and files) served by `serve` (clean URLs) |
| `pnpm measure <origin> <path>… [--no-prefetch] [--click <sel>]` | page weight, raw and gzip, by category |

## Repository layout

```
CONTRACT.md                 the site export contract (v1.7)
projects.json               { slug, repo, ref, localPath?, devUrl? } per project
lib/contract/               types, links (§3.3), the MDX scan, the sidebar icons (icons.ts, §3.1), the checks
                            (§8); Node-free except validate.ts
lib/projects.ts             build-time reads of .sources/ (server only), the shapes sent to the client; each
                            project's featured example (its landing's showcase <Example>, else its first,
                            read by lib/contract/mdx.ts), never listed by hand; the home page's palette
                            example (ui's palettes)
lib/code.ts                 the code panel's files: URLs, fetch-once cache
lib/layout.shared.tsx       what the site header shows (siteHeader), computed at build time
lib/cn.ts                   Fragiola UI's cn, copied from ui's registry (pnpm registry:copy)
lib/agents.ts               the agent index: /agents/index.json (fragiola/cli docs/agent-index.md v1), a
                            Markdown copy of every docs page, /agents/overview.md, /llms.txt
content/agents/overview.md  the ecosystem for AI agents, hand-written (served as /agents/overview.md)
lib/seo.ts                  titles, meta descriptions, canonical URLs, Open Graph/Twitter, JSON-LD (rule 10)
lib/site-paths.ts           the AI agents space (AI_SPACE) and its entry paths, import-free (client components, scripts)
lib/package-managers.ts     the install command per package manager (pnpm, npm, yarn, bun)
lib/storage.ts              every localStorage key (`@fragiola:…`) and the move of the older ones
lib/brand.ts                the mark and the brand's colours, each a token of the vendored theme
lib/feature-headings.ts     a remark step: a <Feature> outside a <Section> is an h2 (§3.4)
lib/agent-band.ts           a remark step: the agent band on every landing, after its top-level showcase
                            <Example>, else after its <Hero> (§3.5, v1.7)
app/                        / (organization), /ai/docs (the AI agents docs, content/ai/; /ai/, /mcp/ and /skills/ redirect into them), /[project] (landing), /[project]/docs, /[project]/examples, /[project]/create (v1.6, only for a project declaring it), /api/search
                            + the metadata routes: robots.ts, sitemap.ts, manifest.ts (force-static),
                              og.png/ and [project]/og.png/ (the share images, next/og at build),
                              icon.svg, favicon.ico, apple-icon.png (pnpm brand:icons)
components/site-header.tsx  the header of the landings and the gallery (rule 9)
components/site-controls.tsx  the wordmark, search, theme and GitHub mark the header and the docs share
components/docs-chrome.tsx  the docs' navigation (rule 9): the sidebar's top and footer, the panel's corner
components/docs-space-layout.tsx, docs-space-page.tsx  a docs layout and page, for a project or a docs space
content/ai/docs/            the AI agents docs (the agent skills, the MCP server), written by www: the shape of an
                            export's docs (§3.1–3.4), checked by validateDocsSpace in prepare:site (rule 1)
components/install-command.tsx  <InstallCommand>: a terminal, a tab per package manager, the choice site-wide
components/ui/, atoms/, families/  Fragiola UI's components, copied from ui's registry; never edited
components/gallery/         the gallery: chrome (layout, the list on ui's Sidebar), example view (page)
components/resizable.tsx    shadcn's resizable in palette roles (the code panel); the site's own until ui has one
components/example-frame.tsx  the iframe side of §5
components/create-frame.tsx  the Create page's frame (§5.5): the whole viewport, ready → host → theme, no
                            resize, no promotion; nothing of the site drawn over it, nothing scrolls the page
components/example-promotion.ts  overlay promotion's geometry and the page's held scroll (§5.4)
components/example-block.tsx  <Example> in a page: inline, bleed, card, showcase (with the adapters row above it)
components/missing-framework.tsx  the message of an example the chosen framework does not have (rule 7)
components/landing/         Hero, Action, Section, Features/Feature, Pills, the scroll reveal (§3.4), the adapters
                            row (project.json's adapters, v1.5: a mark each, a link to the docs in a framework)
                            + hero-scene: the organization landing's WebGL scene (three, on / only,
                              loaded after hydration; e2e/scene.spec.ts, scene-no-webgl.spec.ts)
                            + live-preview: the organization landing's "See it live" carousel (APG tabbed
                              carousel, no autoplay): small name-only chips, the active project's
                              description and links above a wide stage, each project's landing example, one
                              iframe at a time, created on activation (e2e/live-preview.spec.ts)
                            + palette-section: "One class, one palette", Fragiola UI's palettes example alone,
                              full width (else no section: lib/projects.ts paletteExample)
                            + live-slot: the one example iframe the two share; live-placeholder: their placeholder
                            + agent-band: the "build with your agent" band of every project landing (v1.7)
components/framework-logo.tsx  the frameworks' marks (Simple Icons, CC0) in their brands' colours: the one file
                            tests/palette.test.ts exempts
components/project-footer.tsx the project footer on every landing and docs page (§3.5)
components/docs-icon.tsx    the drawing of every sidebar icon, typed by lib/contract/icons.ts
components/docs-sidebar.tsx the docs sidebar's rows (Fumadocs' sidebar parts, the site's inset look): icons, the
                            current page as a filled pill, folding sections behind a guide line
components/docs-page-header.tsx  a docs page's header: the section as an eyebrow, the title, the lead, the glow
components/mdx.tsx          the v1.1 vocabulary (unchanged in v1.2 to v1.7), plus the site's AgentBand
components/json-ld.tsx      structured data in a page's static HTML, `<` escaped
components/share-image.tsx  the share card drawn by next/og: the mark, a title, a line of description
public/brand/               the mark (SVG, 512 px PNG) and the manifest's icons (pnpm brand:icons)
scripts/                    sources-sync, sources-fixtures, prepare-site, registry-copy, brand-icons, build, dev, serve, measure
fixtures/<slug>/            a minimal v1.7 export per project (fixtures/README.md)
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
