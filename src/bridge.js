import { publishHydraGlobals } from './globals.js'

/**
 * Serialized bridge coordinator — one engine at a time, FIFO waiters.
 * @typedef {Object} Bridge
 * @property {(hydra: Object, fn: Function) => Promise<unknown>} withBridge Runs `fn` under the temporary global bridge for `hydra`.
 */

/**
 * Creates a serialized global bridge coordinator — one engine at a time, FIFO waiters.
 * @returns {Bridge}
 * */
export function createBridge() {
  /** The engine that currently holds the bridge. @type {any} */
  let owner = null

  /** Waiters for the bridge, drained in FIFO order. @type {any[]} */
  const waiters = []

  /**
   * Requests the bridge for an engine, resolving immediately when free or already held.
   * @param {Object} hydra
   * @returns {Promise<void>}
   * */
  function acquire(hydra) {
    if (owner === null || owner === hydra) {
      owner = hydra
      return Promise.resolve()
    }
    return new Promise(resolve => waiters.push({ hydra, resolve }))
  }

  /**
   * Releases the bridge and hands it to the next waiter.
   * @returns {void}
   * */
  function release() {
    if (waiters.length > 0) {
      const next = waiters.shift()
      owner = next.hydra
      next.resolve()
      return
    }
    owner = null
  }

  /**
   * Runs `fn` under a temporary global bridge for the engine, restoring globals in every path.
   * @param {Object} hydra
   * @param {Function} fn
   * @returns {Promise<unknown>}
   * */
  async function withBridge(hydra, fn) {
    const shared = owner === hydra
    if (!shared) await acquire(hydra)
    const restore = shared ? null : publishHydraGlobals(hydra)
    try {
      return await fn()
    } finally {
      if (restore) {
        restore()
        release()
      }
    }
  }

  return { withBridge }
}

/** The production-wide bridge coordinator shared by all contexts. */
export const sharedBridge = createBridge()
