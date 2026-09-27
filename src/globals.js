import { GLOBAL_BRIDGE, GLOBAL_EXCLUDED } from './names.js'

/**
 * Publishes the engine surface on `globalThis`; returns a restore function. Prefer `withBridge` for serialized access.
 * @param {Object} hydra
 * @returns {Function}
 * */
export function publishHydraGlobals(hydra) {
  const { hydra: hydraGlobal, hydraSynth: hydraSynthGlobal, synth: synthGlobal } = GLOBAL_BRIDGE
  const snapshot = new Map()
  const win = globalThis
  const keys = [
    ...Object.values(GLOBAL_BRIDGE),
    ...Object.keys(hydra.synth).filter(key => !GLOBAL_EXCLUDED.has(key)),
  ]
  for (const key of keys) {
    snapshot.set(key, {
      own: Object.prototype.hasOwnProperty.call(win, key),
      value: win[key],
    })
  }
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
  return () => {
    for (const [key, entry] of snapshot) {
      if (entry.own) win[key] = entry.value
      else delete win[key]
    }
  }
}
