import { ENGINE_GLOBALS, GLOBAL_BRIDGE, GLOBAL_EXCLUDED } from './names.js'

/**
 * Captures the current values of some `globalThis` names.
 * @param {Iterable<string>} names
 * @returns {Map<string, { own: boolean, value: any }>}
 * */
function captureGlobals(names) {
  const win = /** @type {any} */ (globalThis)
  const snapshot = new Map()
  for (const name of names) {
    snapshot.set(name, {
      own: Object.prototype.hasOwnProperty.call(win, name),
      value: win[name],
    })
  }
  return snapshot
}

/**
 * Restores names captured by `captureGlobals`, deleting those that were absent.
 * @param {Map<string, { own: boolean, value: any }>} snapshot
 * @returns {void}
 * */
function restoreGlobals(snapshot) {
  const win = /** @type {any} */ (globalThis)
  for (const [name, entry] of snapshot) {
    if (entry.own) win[name] = entry.value
    else delete win[name]
  }
}

/**
 * Publishes the engine surface on `globalThis`; returns a restore function. Prefer `withBridge` for serialized access.
 * @param {any} hydra
 * @returns {Function}
 * */
export function publishHydraGlobals(hydra) {
  const { hydra: hydraGlobal, hydraSynth: hydraSynthGlobal, synth: synthGlobal } = GLOBAL_BRIDGE
  const win = /** @type {any} */ (globalThis)
  const keys = [
    ...Object.values(GLOBAL_BRIDGE),
    ...Object.keys(hydra.synth).filter(key => !GLOBAL_EXCLUDED.has(key)),
  ]
  const snapshot = captureGlobals(keys)
  for (const key of snapshot.keys()) {
    const value = hydra.synth[key]
    if (key === hydraGlobal || key === hydraSynthGlobal) {
      win[key] = hydra
    } else if (key === synthGlobal) {
      win[key] = hydra.synth
    } else if (typeof value === 'function') {
      win[key] = value.bind(hydra.synth)
    } else {
      win[key] = value
    }
  }
  return () => restoreGlobals(snapshot)
}

/**
 * Captures the engine-owned globals before a `makeGlobal` engine is constructed; returns a restore
 * that writes back the previous values and deletes names the page did not own.
 * @returns {Function}
 * */
export function snapshotEngineGlobals() {
  const snapshot = captureGlobals(ENGINE_GLOBALS)
  return () => restoreGlobals(snapshot)
}
