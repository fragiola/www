# fragiola.com

The single site for every Fragiola project: `/` (the organization), `/ui`, `/dockable`, …
Each project lives in its own repo and exposes a **site export**; this repo checks the exports
against the contract and assembles them into one static Next.js + Fumadocs site, published on
GitHub Pages.

- **The contract** a project implements: [`CONTRACT.md`](CONTRACT.md) (v1.2).
- **How this repo works**, its rules and commands: [`AGENTS.md`](AGENTS.md).

## Working on it

```sh
pnpm install
pnpm sources:sync        # install and run each project's site:export (projects.json → localPath) into .sources/
pnpm dev                 # http://localhost:3000, the projects' pages and examples live
```

`projects.json` lists `{ slug, repo, ref, localPath?, devUrl? }`. `localPath` is the project's
checkout on your machine; with `devUrl`, `pnpm dev` starts the project's `site:dev` there and
proxies `/<slug>/embed/**` to it, so an edited example hot-reloads inside the site. An edited page
in the project's `site/docs` shows without a restart, checked against the contract on save.

Without the projects' checkouts, `pnpm sources:fixtures` fills `.sources-fixtures/` from
`fixtures/`, and `FRAGIOLA_SOURCES=.sources-fixtures pnpm dev` runs the site on them. `pnpm build`
never publishes them: it takes `.sources/` only, as the last `pnpm sources:sync` left it, and
refuses it when a project's checkout has changed since.

| | |
|---|---|
| `pnpm build` | the contract checks, then `out/` (a broken link fails here, with its file and line) |
| `pnpm test` | unit tests (the contract checks, the build refusing what it must) |
| `pnpm e2e:build && pnpm e2e` | the browser suite, against `out/` built from the fixtures (`pnpm e2e:serve`: served by `serve`) |
| `pnpm serve` · `pnpm measure` | serve `out/` like Pages; weigh pages |

## Deploying

`.github/workflows/deploy-pages.yml` tests (against the fixtures), clones every project at its
`ref`, runs their exports, builds and publishes. It runs on a push to `main`, daily at 05:17 UTC,
on demand, and when a project's CI dispatches `project-updated`. None of it is set up yet; in
order:

1. **The repository.** Create `fragiola/www` on GitHub (public, like the projects: the workflow
   clones them without a token), add it as `origin` here and push `main`.
2. **Pages.** Settings → Pages → Build and deployment → Source: **GitHub Actions**. Then run the
   workflow once (Actions → "Deploy site to GitHub Pages" → Run workflow) and check the
   `github-pages` environment it creates.
3. **The domain.** Settings → Pages → Custom domain: `fragiola.com`, then **Enforce HTTPS** once
   the certificate is issued. At the DNS provider:
   - `fragiola.com`: `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
     `185.199.111.153` (and `AAAA` to `2606:50c0:8000::153`, `2606:50c0:8001::153`,
     `2606:50c0:8002::153`, `2606:50c0:8003::153`);
   - `www.fragiola.com`: `CNAME` to `fragiola.github.io`.

   Verify the domain for the organization first (Organization settings → Pages → Add a domain),
   so no other account can claim it. With an Actions deployment no `CNAME` file is needed.
   The site is served from the domain root: every export is built for `/<slug>`, so it cannot be
   served from `fragiola.github.io/www`.
4. **The dispatch token.** The projects' CI sends `repository_dispatch` `project-updated` after
   a push to `main` once a `WWW_DISPATCH_TOKEN` secret exists (dockable's `main` does; ui's does
   on `feat/site-export-v1`, not merged yet). Create a **fine-grained personal access token** (or a
   GitHub App token) with:
   - resource owner: `fragiola`; repository access: only `fragiola/www`;
   - repository permissions: **Contents: Read and write** (what `POST /repos/{owner}/{repo}/dispatches`
     requires), Metadata: Read.

   Store it as the **`WWW_DISPATCH_TOKEN`** Actions secret in each project repo (or once as an
   organization secret shared with `ui` and `dockable`). Set an expiry and a reminder to rotate it.
5. **The refs.** `projects.json` builds `main` of every project. A project's `main` must export
   contract v1.2 (`project.json` → `"contract": 1`, and the v1.2 rules of `CONTRACT.md`), or the
   build fails on it.
6. **Search engines** (manual, once the domain is live). In
   [Google Search Console](https://search.google.com/search-console), add `https://fragiola.com`
   as a property, verify it (a DNS TXT record on the domain), then submit
   `https://fragiola.com/sitemap.xml` under Sitemaps. Bing Webmaster Tools can import it from
   Search Console. Nothing in this repo does it: no verification token is committed.
