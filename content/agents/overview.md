# Fragiola, for AI agents

Fragiola (https://fragiola.com) is an ecosystem of components and libraries for the web. Every
project follows the same principles, so what you learn about one applies to the others, and they
can be combined in one app.

## Two kinds of components

Fragiola ships components in **two different ways**. Before you use one, know which kind it is.

| | Fragiola UI | Fragiola libraries |
| --- | --- | --- |
| what it is | components as **source code** | headless **npm packages** |
| examples | select, dialog, sidebar, tabs, chart, … | `@fragiola/dockable`, `@fragiola/data-grid`, `@fragiola/grid-layout` |
| how it is added | the shadcn CLI copies the files into the project | `npm install` the adapter for the project's framework (it brings the core) |
| who owns the code | the project: edit it freely | the package: use its API, do not copy it |
| styling | Tailwind v4 with six palette roles | none shipped: style the `data-*` and ARIA state, or with Fragiola UI |

### Fragiola UI: source code through the shadcn registry

Fragiola UI is built on Base UI and Tailwind v4.

1. Add the registry to the project's `components.json` once:

   ```json
   { "registries": { "@fragiola": { "url": "https://fragiola.com/r/{name}.json" } } }
   ```

2. Add components with `npx shadcn@latest add @fragiola/<name>`. Their registry dependencies come
   with them: shared atoms, style families, `cn`, the theme.

Rules the code follows, and that changes should keep:

- **Colours come only from six palette roles**: `base`, `soft`, `line`, `contrast`, `accent`,
  `ring` (for example `bg-palette-base`, `text-palette-contrast`). They are never fixed colours.
  Secondary text is `text-palette-accent/85`. Any number of palettes can be scoped to a subtree.
- **Families** are shared styles, such as popup, menu, choice, layer, disclosure and track. They
  have no variants.
- **Composition**: swap an element with the `render` prop, never `asChild`. Use logical inline
  properties for RTL, and never `!important`.
- Item groups: `component` (ui), `atom` (small building blocks), `family` (shared style), `lib`
  (helpers such as `cn`), `theme`, `palette`.

### Libraries: headless npm packages

Each library has a framework-free **core**, `@fragiola/<x>`, and one **adapter** per framework:
`@fragiola/<x>-react`, `@fragiola/<x>-vue`, `@fragiola/<x>-angular`, … Install **only the adapter
for the project's framework** (`npm install @fragiola/<x>-react`): it depends on the core and
re-exports it, so the app imports everything from the adapter, the model included. Never install
several adapters, nor the core next to an adapter. The core alone is for framework-free use.

- **Headless**: a library ships behaviour, keyboard support and accessibility, never CSS, icons or
  text. Its state is exposed as `data-*` attributes and ARIA, so any styling approach works.
  Fragiola UI is the natural fit.
- **One model API in every library.** State is plain immutable data behind a model. Every change
  is a command run through a bus with middleware and events. Every question goes through one of
  five verbs:
  - `model.run(key, payload)` changes the state;
  - `model.can(key, payload)` says whether a command would apply;
  - `model.check(key, payload)` says why it would not;
  - `model.get(key)` reads a value;
  - `model.is(key)` answers a yes/no question.
- **Composition**: assemble the primitives under one namespace, own the recursion through
  children functions, and swap elements with `render`.
- **App policy stays in the app**: undo/redo, persistence and translations are not in the
  packages. The docs show them as code to copy.
- The libraries work together. They share the model shape, command envelopes and JSON documents,
  so one library, a back-end or an AI can drive another.

## How to work with Fragiola

- **Choosing**:
  - for buttons, fields, menus, overlays and navigation, use Fragiola UI;
  - for dockable panel layouts, use Dockable;
  - for large data tables, use Data Grid;
  - for draggable and resizable dashboards, use Grid Layout.

  They combine: a library's primitives styled with Fragiola UI.
- **Before writing code**, read the component's or library's docs page and API. Never invent
  props, commands or attributes.
- Each project's docs are at `https://fragiola.com/<project>/docs/`. Every page is also published
  as Markdown under `https://fragiola.com/agents/<project>/<page>.md`. The full index is
  `https://fragiola.com/agents/index.json`.
- The MCP server gives agents all of this through tools: `npx fragiola@latest mcp`
  (https://fragiola.com/mcp/).
