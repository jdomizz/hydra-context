# Contributing

Thanks for your interest! This guide is for contributors and maintainers — if
you just want to use the library, [README.md](./README.md) is enough.

## How to contribute

- **Report bugs** — open an [issue](https://github.com/jdomizz/hydra-context/issues) with a clear description and steps to reproduce.
- **Suggest features** — open an issue to discuss the idea first.
- **Submit code** — fork, branch off `main`, and open a pull request.

## Development setup

The package manager is **pnpm** (pinned in `package.json`).

```sh
pnpm install
pnpm dev     # vite dev server — the two-instance demo
pnpm test    # vitest (node)
```

`pnpm dev` serves the manual playground (`index.html`): two isolated engines
side by side, two-way sliders, per-instance pointers, an extension load, and a
watch on the editor globals staying `undefined`.

## Commands

| Command             | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `pnpm dev`          | Serve the demo with Vite (HMR).                        |
| `pnpm test`         | Run the test suites (Vitest).                          |
| `pnpm lint`         | Lint with oxlint.                                      |
| `pnpm format`       | Format with oxfmt.                                     |
| `pnpm format:check` | Check formatting without writing.                      |
| `pnpm build`        | Bundle `dist/hydra-context.js`.                        |
| `pnpm check`        | `lint` + `format:check` + `test` + `build` — the gate. |

Run the full gate before proposing a change.

## Structure

A facade over small, focused modules — see
[ARCHITECTURE.md](./ARCHITECTURE.md) for the module map and the design
decisions. Each behavior module has a sibling `*.spec.js` (`names.js` is pure
constants); behavior changes need tests.

## Conventions

- Plain JavaScript, JSDoc types on the public API.
- The root exports only `HydraContext`, `userCodeLine`, and
  `publishHydraGlobals` — no package subpaths for implementation modules.
- Keep the package DOM-independent, with no runtime dependency on
  `hydra-synth`; engine creation, rendering, and scheduling stay with the host.
- Keep `eval` direct and unsynchronized; serialization belongs to the host.
- Treat evaluated code as trusted code — never describe the evaluator as a
  sandbox.
- The public API is considered stable: treat additive changes as breaking and
  justify each with a concrete consumer or a documented defect.

When changing the public class: update `src/context.js`, its tests, the README
API section, and `CHANGELOG.md` — then run the gate.

## Integration check

`hydra-element` consumes this package through the local dependency
`file:../hydra-context`. When changing the public surface, also run that
package's checks if the sibling repository is available:

```sh
pnpm --dir ../hydra-element check
```

Do not commit generated `dist` or `node_modules` contents.
