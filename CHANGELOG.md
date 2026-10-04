# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-10-04

### Changed

- Bumped devDependencies: `oxc-standard` 1.4.0 → 1.4.2, `oxfmt` 0.48.0 → 0.71.0, `oxlint` 1.85.0 → 1.86.0, `vite` 8.3.0 → 8.3.2, `vitest` 5.0.1 → 5.0.3.

## [0.2.0] - 2026-10-04

### Added

- TypeScript declarations generated from the existing JSDoc — `pnpm build` compiles `src/` to `dist/` with `tsc` under `strict`/`checkJs`, emitting `dist/*.js` and `dist/*.d.ts` side by side.
- Package surfaces the types: `types` field and a `"types"` condition in `exports`.
- `tsconfig.json` (editor/type-check base) and `tsconfig.types.json` (the emit config).
- `publint` and `arethetypeswrong` (`pnpm publint`, `pnpm attw`) in the `pnpm check` gate — they validate the published package surface and type resolution before releasing. `attw` runs with `--profile esm-only` (the package is intentionally ESM-only).
- Tighter JSDoc on the bridge: a `Bridge` typedef now types `withBridge`/`createBridge` and `options.bridge` instead of `Function`.

### Changed

- The published runtime is now the `tsc`-compiled `dist/` (`.js` + `.d.ts` side by side) instead of the raw `src/` files; `main`/`module`/`exports` and `files` point at `dist`.
- Vite no longer builds a library bundle (`dist/hydra-context.js` is gone); `pnpm dev` still serves the demo against `src`.

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

[0.2.1]: https://github.com/jdomizz/hydra-context/releases/tag/v0.2.1
[0.2.0]: https://github.com/jdomizz/hydra-context/releases/tag/v0.2.0
[0.1.0]: https://github.com/jdomizz/hydra-context/releases/tag/v0.1.0
