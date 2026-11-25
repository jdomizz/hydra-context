/** User-owned synth props; assignments mirror to the engine. */
export const USER_PROPS = ['speed', 'bpm', 'update', 'afterUpdate', 'fps']

/** Live synth names that shadow scope reads unless bound. */
export const LIVE_SYNTH_NAMES = [...USER_PROPS, 'time', 'width', 'height']

/** Names never copied to `globalThis` when publishing the engine surface. */
export const GLOBAL_EXCLUDED = new Set([...LIVE_SYNTH_NAMES, 'mouse', 'stats'])

/**
 * Names a global engine writes on `globalThis` that `publishHydraGlobals` does not own.
 * Includes hydra-synth's `window.loadScript`.
 */
export const ENGINE_GLOBALS = [...GLOBAL_EXCLUDED, 'loadScript']

/** Classic hydra editor global bridge names, keyed by role. */
export const GLOBAL_BRIDGE = { hydra: '_hydra', hydraSynth: 'hydraSynth', synth: 'synth' }
