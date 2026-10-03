# Architecture

`hydra-context` is a small, DOM-independent evaluation library for
[`hydra-synth`](https://github.com/hydra-synth/hydra-synth) instances. It does
not create engines, own canvases, or run loops — the host does all of that and
attaches an engine to a context.

Two deliberate choices shape everything else:

- **the eval scope is persistent and per-context** — bare assignments survive
  evaluations and stay off `window`, which is what lets many instances coexist;
- **the editor's `window` surface is moved, not removed** — the same DSL, the
  same live names, the same resolution semantics, resolving through a scope
  `Proxy` instead of a global object, so editor-style sketches run unchanged,
  scoped to their instance.

Most of the remaining "differences from the editor" (unknown identifiers warn
instead of throwing, `'use strict'` is inert, …) are consequences of that one
move; the rest are per-instance registration choices for extension authors —
see the README's
[Editor compatibility](./README.md#editor-compatibility) section.

## Big picture

```
index.js ─── the public root: HydraContext · userCodeLine · publishHydraGlobals
   │
   ▼
src/context.js ── HydraContext (the facade)
   │   owns: engine ref · scope · bindings · eval · bridge
   │
   ├─▶ src/eval.js   hydraEval — the async `with`-scope evaluator
   │                     └─▶ src/scope.js   createScopeProxy — resolution + bindings
   ├─▶ src/bridge.js  serialized global bridge
   │                     └─▶ src/globals.js  publish / restore
   └─▶ src/names.js  the reserved-name sets (single source)
```

Imports flow one way (`context → helpers → names`); nothing imports the facade
back, and every module that needs the reserved-name sets imports them from
`names.js`.

## Module map

| File             | Responsibility                                                                    |
| ---------------- | --------------------------------------------------------------------------------- |
| `index.js`       | Public root; exports `HydraContext`, `userCodeLine`, `publishHydraGlobals`.       |
| `src/context.js` | `HydraContext` — the facade: engine attachment, scope ownership, public methods.  |
| `src/eval.js`    | `hydraEval` — the async evaluator; `userCodeLine` — V8 stack mapping.             |
| `src/scope.js`   | The scope `Proxy` and the binding primitives (`bind`/`bindLive`/`unbind`).        |
| `src/bridge.js`  | `createBridge` — the serialized bridge coordinator; `sharedBridge` — the default. |
| `src/globals.js` | `publishHydraGlobals` — the engine-surface publish/restore primitive.             |
| `src/names.js`   | The reserved-name sets (bridge names, live/user props, global exclusions).        |

Each behavior module has a sibling `*.spec.js` covering it (`names.js` is pure
constants); `index.spec.js` pins the public export surface.

## Evaluation model

```
context.eval(code)
        │
        ▼
async function () { with(scopeProxy) { code } }()
        │
        ├── 1. bound name (bind/bindLive) ── wins over everything
        ├── 2. live synth name ──────────── read fresh on every access
        ├── 3. persistent scope ──────────── bare assignments live here
        ├── 4. synth props/methods ───────── osc, s0…, setFunction (bound to the synth)
        └── 5. globalThis ────────────────── wrapped so host fns keep the right `this`
```

- The proxy's `has()` always returns `true`, so unknown names resolve through
  `get()` instead of escaping to `window` — this is why every bare assignment
  stays in the scope, and why unknown identifiers warn once and resolve to
  `undefined` instead of throwing.
- `set()` writes the scope and mirrors user-owned props (`speed`, `bpm`,
  `update`, `afterUpdate`, `fps`) to the synth.
- Synth functions are read bound to the synth; global functions are wrapped so
  they keep `globalThis` as their receiver (`setTimeout`, `fetch`, …).

## Bindings

`bind`/`bindLive`/`unbind` are plain scope definitions: a writable static value,
a getter with an optional `sink` setter, and a delete. A bound name is recorded
in a per-scope marker set so it wins over live synth reads — that's how a host
shadows `time`, `mouse`, or `a`.

Bindings are writable by design — editor parity: in the editor every name on
`window` is reassignable. A sketch assignment overrides a static binding;
assigning to a live binding replaces its getter with a static value (or calls
the `sink`, keeping it live and echoing to the host); re-binding restores.

## The global bridge

`withBridge` runs on a bridge coordinator (`createBridge`, defaulting to the
shared `sharedBridge`): at most one engine holds the bridge at a time, waiters
drain in FIFO order, and a call by the current owner runs inline. While the
bridge is held, `publishHydraGlobals` publishes the engine surface on
`globalThis` — `_hydra`, `hydraSynth`, `synth`, and the synth methods, minus the
excluded live names — and the previous globals are restored on every path. This
serves classic extensions that read `window._hydra` / `window.hydraSynth`, and
keeps `window` clean after the load.

`publishHydraGlobals` is the raw publish/restore pair beneath the coordinator,
exported for hosts that must hold a persistent surface (e.g. `hydra-element`'s
`global` mode) — manual use owns serialization itself.

Extension loading is composed by the host on top of `withBridge` + `eval`
(fetch the text, evaluate it under the bridge, or fall back to a `<script>` tag
when the host is DOM-based); the package ships no loader of its own.

## Host boundary

The host owns: engine creation and lifecycle, canvas and render loop, eval
scheduling and serialization, CORS/fetch policy and fallbacks, and error
reporting (`userCodeLine`). The package stays DOM-independent and carries no
runtime dependency on `hydra-synth` — a compatible engine object is attached at
runtime.

## Build and verification

The published package ships the `tsc`-compiled `dist/` — each source module is
emitted as `dist/<module>.js` next to its `dist/<module>.d.ts`, with
`dist/index.js`/`dist/index.d.ts` as the entry. The full local gate is:

```sh
pnpm check
```

lint + format check + the Vitest suite + the `tsc` build + the package
publishing linters (`publint`, `arethetypeswrong`). CI runs it on every push
and pull request. The demo (`index.html`) runs against `src` via the Vite dev
server (`pnpm dev`) and needs no build.
