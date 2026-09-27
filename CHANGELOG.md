# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-27

### Added

- Initial `hydra-context` package — one isolated, persistent eval scope per `hydra-synth` instance, editor-style.
- `eval(code)` — the full editor DSL with no `synth.` prefix; `await` works, bare assignments persist in the context's `scope`, `let`/`const` don't (editor parity).
- Identifier resolution: bound names → live synth values (`time`, `width`, `height`, `speed`, `bpm`, `fps`, `update`, `afterUpdate`) → persistent scope → synth → `globalThis`.
- Bare assignments to user-owned props (`speed`, `bpm`, `update`, `afterUpdate`, `fps`) sync to the attached synth.
- `bind(name, value)` / `bindLive(name, provider)` / `unbind(name)` — feed static or live values into a sketch without touching `globalThis`; bound names win over the engine's own reads (`time`, `mouse`, `a`, …).
- Optional `sink(value)` on `bindLive` — two-way bindings: a sketch assignment echoes back to the host instead of freezing the getter.
- `attach(hydra)` — attach or replace an engine at any time, keeping the scope and bindings; binds the editor aliases `_hydra`/`hydraSynth` into the scope.
- `withBridge(fn)` — run an async function (e.g. `await import(...)` or a host-owned extension loader) under a temporary global bridge, serialized across contexts, with the previous globals restored in every path.
- `publishHydraGlobals(hydra)` named export — publish the engine surface on `globalThis` and get a restore function back, for hosts that must hold a persistent surface.
- `userCodeLine(error, code)` named export — map a V8 error stack back to a 1-based line in the submitted sketch.
- Options on `new HydraContext(hydra, options)`: `scope`, `unresolved`, `bridge`.
- `unresolved` — policy for unknown identifiers: warn once per scope and name, stay `silent`, throw a `ReferenceError` (`'error'`), or report through a custom function.
- Demo (`pnpm dev`) — two isolated instances with two-way sliders, per-instance pointers, a host-owned extension loader, and a watch on the editor globals staying `undefined`.

[0.1.0]: https://github.com/jdomizz/hydra-context/releases/tag/v0.1.0
