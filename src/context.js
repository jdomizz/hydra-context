import { sharedBridge } from './bridge.js'
import { hydraEval } from './eval.js'
import { GLOBAL_BRIDGE } from './names.js'
import { bindLiveScope, bindScope, unbindScope } from './scope.js'

/** A persistent, headless eval context for a hydra-synth instance. */
export class HydraContext {
  #hydra
  #synth
  #scope
  #unresolved
  #bridge

  /**
   * @param {Object} [hydra] The hydra-synth engine to attach.
   * @param {Object} [options]
   * @param {Object} [options.scope] Persistent scope object.
   * @param {'warn'|'error'|'silent'|Function} [options.unresolved='warn'] Policy for identifiers missing from scope, synth, and globals.
   * @param {Object} [options.bridge] Serialized bridge coordinator.
   * */
  constructor(hydra, options = {}) {
    this.#scope = options.scope ?? Object.create(null)
    this.#unresolved = options.unresolved ?? 'warn'
    this.#bridge = options.bridge ?? sharedBridge
    if (hydra) this.attach(hydra)
  }

  /**
   * The attached engine, or `undefined`.
   * @returns {Object|undefined}
   * */
  get hydra() {
    return this.#hydra
  }

  /**
   * The attached engine's synth, or `undefined`.
   * @returns {Object|undefined}
   * */
  get synth() {
    return this.#synth
  }

  /**
   * The persistent eval scope.
   * @returns {Object}
   * */
  get scope() {
    return this.#scope
  }

  /**
   * Attaches or replaces the engine; keeps scope and bindings.
   * @param {Object} hydra
   * @returns {HydraContext}
   * */
  attach(hydra) {
    this.#hydra = hydra
    this.#synth = hydra.synth
    this.bind(GLOBAL_BRIDGE.hydra, hydra)
    this.bind(GLOBAL_BRIDGE.hydraSynth, hydra)
    return this
  }

  /**
   * Evaluates code directly and returns its async result.
   * @param {string} code
   * @returns {Promise<unknown>}
   * */
  eval(code) {
    return hydraEval(code, this.#synth, this.#scope, { unresolved: this.#unresolved })
  }

  /**
   * Runs an async function under the temporary global bridge, serialized across engines.
   * @param {Function} fn
   * @returns {Promise<unknown>}
   * @throws {Error} When no hydra instance is attached.
   * */
  withBridge(fn) {
    if (!this.#hydra) {
      throw new Error('[hydra-context] withBridge requires a hydra instance')
    }
    return this.#bridge.withBridge(this.#hydra, fn)
  }

  /**
   * Binds a static value into the persistent scope.
   * @param {string} name
   * @param {unknown} value
   * @returns {HydraContext}
   * */
  bind(name, value) {
    bindScope(this.#scope, name, value)
    return this
  }

  /**
   * Binds a live getter, re-read on every access; an optional `sink(value)` makes it two-way.
   * @param {string} name
   * @param {Function} provider
   * @param {Function} [sink]
   * @returns {HydraContext}
   * */
  bindLive(name, provider, sink) {
    bindLiveScope(this.#scope, name, provider, sink)
    return this
  }

  /**
   * Removes a binding from the persistent scope.
   * @param {string} name
   * @returns {HydraContext}
   * */
  unbind(name) {
    unbindScope(this.#scope, name)
    return this
  }
}
