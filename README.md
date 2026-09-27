# 🍯 hydra-context

Isolated, persistent eval scopes for [hydra-synth](https://github.com/hydra-synth/hydra-synth) instances.

```js
import Hydra from 'hydra-synth'
import { HydraContext } from 'hydra-context'

const hydra = new Hydra({ canvas, makeGlobal: false })
const ctx = new HydraContext(hydra)

await ctx.eval('osc(20, 0.1, 1.2).rotate(0.2).out()')
```

Each context owns a private scope — sketches read and write _its_ variables and
bindings, never another instance's, never `window`. The DSL is the one from the
[Hydra editor](https://hydra.ojack.xyz/): no `synth.` prefix, bare assignments
persist, `await` works.

> **This is not a sandbox** — evaluated code can reach `globalThis`
> (`document`, `fetch`, …). Only evaluate code you trust.

## Who is this for

A classic editor sketch — `osc().out()` — doesn't need this library. If you
write Hydra sketches in the editor and never manage more than one engine, you
can skip this page.

`hydra-context` is plumbing for people who **embed or host** Hydra:

- **App builders** running several engines at once (multi-canvas editors,
  galleries, dashboards) whose sketches currently leak into each other's
  `window` — each context gets a private scope, DSL, and bridge.
- **Extension authors** who want per-instance registration — `setFunction`,
  `update`, `afterUpdate`, and loaded libraries land on one engine, not the
  global namespace.
- **Tool/library makers** building on
  `hydra-synth` (e.g.
  `hydra-element`-style hosts) that
  need `makeGlobal: false` plus a stable surface for editor-style sketches and
  extension loading.

If you just want a single Hydra instance, the plain
[hydra-synth](https://github.com/hydra-synth/hydra-synth) API is the simpler
starting point. To embed a sketch in an HTML page, the
[hydra-element](https://github.com/jdomizz/hydra-element) custom element is the
most convenient — each element wraps its own engine, no extra wiring.

## Demo

Want to poke around without setting up a project? Open the CodePen
[example](https://codepen.io/editor/jdomizz/pen/01a0e33d-ffb3-72ee-b8dd-213dbcf6d823)
for a ready-to-edit playground and quick tests.

The demo mounts two engines side by side, feeds each a two-way slider and its
own pointer, loads an extension into one scope, and watches the editor
globals — they stay `undefined`.

## Install

```sh
npm install hydra-context   # or pnpm add / yarn add
```

`hydra-context` has no runtime dependency on `hydra-synth` — you create the
engine (`makeGlobal: false`, which is what keeps the DSL off `window`) and
attach it to a context.

## Evaluate sketches

```js
const ctx = new HydraContext(hydra)

await ctx.eval('osc().out()')
```

Code runs inside an async function — `await` works. Bare assignments persist
in the context's `scope` and read back through it:

```js
await ctx.eval('x = 5')
ctx.scope.x // 5
```

A context can exist before its engine; `attach` keeps the scope and bindings:

```js
const ctx = new HydraContext()
ctx.bind('speed', 1.5)

ctx.attach(hydra)
await ctx.eval('osc(speed).out()')
```

`eval` is direct: it evaluates once and returns the promise — it does not
queue. Serialize yourself when ordering matters.

## What the sketch sees

| Write in sketch                      | Persists? | Where                                         |
| ------------------------------------ | --------- | --------------------------------------------- |
| `x = 5`                              | yes       | The context's `scope` (the editor's `window`) |
| `let` / `const` / `var` / `function` | no        | Function-scoped per eval (editor parity)      |
| `speed`, `bpm`, `update`, `fps`      | yes       | Stored in scope and synced to the synth       |
| `time`, `width`, `height`            | live      | Read from the synth on every access           |
| `_hydra`, `hydraSynth`               | yes       | Bound automatically on attach                 |

Names resolve in this order:

1. **Bound names** — `bind`/`bindLive` values, winning over the engine's reads
2. **Live synth names** — `time`, `width`, `height`, `speed`, `bpm`, `fps`,
   `update`, `afterUpdate`, fresh on every access
3. **Persistent scope** — bare assignments
4. **Synth** — `osc`, `s0`–`s3`, `o0`–`o3`, custom transforms, `setFunction`
5. **`globalThis`** — browser globals

## Bind values

Feed values into a sketch without touching `globalThis`:

```js
ctx.bind('seed', 0.5) // static — a pinned value
ctx.bindLive('freq', () => slider.value) // live — re-read on every access
ctx.unbind('seed') // remove either
```

Parameters re-evaluate per frame only when passed as functions: `osc(freq, …)`
pins the value at eval time, `osc(() => freq, …)` stays live.

A bound name wins over the engine's own read, so you can replace what the
editor would otherwise provide:

```js
ctx.bind('mouse', myPointer) // replaces the editor's `mouse` object
ctx.bind('a', myAudio) // shadows hydra's audio object (`a.fft`, `a.bins`)
```

A bound name is just a scope value — a sketch can override it with a bare
assignment. Assigning to a live binding replaces its getter with the assigned
value; re-`bindLive` restores the live read. Or pass a `sink(value)` to make the
binding two-way: the assignment calls the sink instead of freezing the getter,
so the value stays live and the host can push it back (e.g. move a slider):

```js
ctx.bindLive(
  'freq',
  () => slider.value,
  value => (slider.value = value)
)
```

`unbind` on an engine-owned name reverts to the engine's live read.

## Load extensions

Loading is host-owned — fetch policy, CORS, and fallbacks stay with the host —
because the package is DOM-free: a `<script>` tag fallback needs a document.
The primitives are `withBridge` (run code under the engine surface) and `eval`:

```js
// host binds its own loader into the scope
ctx.bind('loadScript', async url => {
  await ctx.withBridge(async () => {
    const res = await fetch(url)
    if (!res.ok) return // or fall back to a <script> tag
    await ctx.eval(await res.text())
  })
})

await ctx.eval(`
  await loadScript('https://cdn.statically.io/gl/metagrowing/extra-shaders-for-hydra@main/lib/lib-pattern.js')
  spiral().diff(concentric()).out()
`)
```

Classic extensions self-register through `window` (`_hydra`, `hydraSynth`,
`setFunction`, …). While a script runs, the context publishes a **temporary
bridge** — the engine surface appears on `globalThis` — then restores the
previous globals. Concurrent loads are serialized so two bridges never overlap,
and at most one bridge is ever active across contexts.

Transforms registered with `setFunction` land on _this_ instance's synth;
top-level `const`/`let` declarations are discarded once the load finishes, and
`window.name = …` persists globally.

## Editor compatibility

Code written for the editor runs here with the same semantics — same DSL, same
live names (`speed`, `bpm`, `fps`, `time`, `width`, `height`, `update`), same
bare-assignment persistence. The editor's `window` surface isn't removed; it's
moved onto the context's scope. The differences that remain are deliberate and
fall into two buckets.

**Scoping semantics** — consequences of that move. They change where names live
and how they resolve, not what a sketch can write:

- **Unknown identifiers** resolve to `undefined` with a one-time `console.warn`
  instead of throwing `ReferenceError` — the cost of keeping every bare
  assignment inside the scope instead of leaking it to `window` (`typeof
undeclaredName` still works as in the editor). For editor strictness set
  `options.unresolved: 'error'` (note `typeof unknown` throws there too), or
  pass a function to collect reports yourself.
- **`'use strict'` directives are inert** — sketches run in sloppy mode inside
  the `with` wrapper.
- **`mouse` is shared by the engine** — `hydra-synth` exposes one module-level
  mouse object to every instance. Bind your own pointer:
  `ctx.bindLive('mouse', () => myPointer)`.
- **Extension loading is host-owned** — the package ships no loader; the editor
  resolves a failed load instead of rejecting, and hosts recreate that (e.g. a
  `<script>` tag fallback) around `withBridge`.

**DSL for the sketch creator** — the registration choices an extension author
already makes in the editor, applied per instance:

- **`setFunction`, `update`, `afterUpdate` are per-instance** — two contexts can
  define the same name differently without `window` collisions.
- **`time` / `width` / `height` are read per access** — fresher than the
  editor's per-frame `window.time`.

## Isolation

| Isolated per instance                                    | Shared / not sandboxed                           |
| -------------------------------------------------------- | ------------------------------------------------ |
| Eval scope (variables, bindings, loaded extensions)      | `globalThis` — reachable from any sketch         |
| DSL functions (`makeGlobal: false`)                      | `window.foo = …` in extension scripts            |
| `_hydra`, `hydraSynth` (bound in scope, not on `window`) | Browser hardware (mic/webcam) with `detectAudio` |

**Only run code you trust.** Real execution isolation — a separate `window`
per instance — needs an iframe or worker per engine.

Importing `hydra-synth` also sets `window.Meyda` — a module side effect of its
`meyda` dependency, shared and outside this package's surface.

## API

| Member                                | Description                                                        |
| ------------------------------------- | ------------------------------------------------------------------ |
| `new HydraContext(hydra?, options?)`  | Persistent-scope eval context; the engine can be attached later.   |
| `ctx.hydra`                           | The attached engine, or `undefined`.                               |
| `ctx.synth`                           | The attached engine's synth, or `undefined`.                       |
| `ctx.scope`                           | The persistent eval scope.                                         |
| `ctx.attach(hydra)`                   | Attach or replace the engine; keeps scope and bindings.            |
| `ctx.eval(code)`                      | Evaluate code directly; returns the async result (no queue).       |
| `ctx.bind(name, value)`               | Bind a static value.                                               |
| `ctx.bindLive(name, provider, sink?)` | Bind a live getter; `sink(value)` makes it two-way.                |
| `ctx.unbind(name)`                    | Remove a binding; engine-owned names revert to the live read.      |
| `ctx.withBridge(fn)`                  | Run an async function (e.g. `await import(...)`) under the bridge. |

`bind`, `bindLive`, and `unbind` are chainable. `withBridge` throws
synchronously when no engine is attached.

The package root exports only three names — the source modules are
implementation details, not public subpaths:

| Export                       | Description                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `HydraContext`               | The class.                                                                                                                                  |
| `publishHydraGlobals(hydra)` | Publish the engine surface on `globalThis`; returns a restore function. Prefer `withBridge`; for hosts that must hold a persistent surface. |
| `userCodeLine(error, code)`  | Map a V8/Chromium error stack back to a 1-based line in the submitted code; `undefined` when unmappable.                                    |

### Options

| Option       | Default               | Description                                                                          |
| ------------ | --------------------- | ------------------------------------------------------------------------------------ |
| `scope`      | `Object.create(null)` | Initial scope for the context.                                                       |
| `unresolved` | `'warn'`              | Policy for unknown identifiers: `'warn'` once per scope and name, `'silent'`, `'error'` (throws `ReferenceError`), or a function receiving each report (also once per scope and name). |
| `bridge`     | shared coordinator    | Serialized global-bridge coordinator (tests inject fresh ones).                      |

## Acknowledgements

- [Olivia Jack](https://ojack.xyz/) for creating [Hydra](https://hydra.ojack.xyz/) 🌈
- The Hydra community for the extensions and ecosystem that surround it 🧩

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).

## License

[AGPL-3.0-or-later](LICENSE).
