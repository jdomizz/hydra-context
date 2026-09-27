import { GLOBAL_BRIDGE, LIVE_SYNTH_NAMES, USER_PROPS } from './names.js'

/** Live synth names that shadow scope reads unless bound. */
const liveNames = new Set(LIVE_SYNTH_NAMES)

/** User-owned synth props that mirror to the engine on assignment. */
const userProps = new Set(USER_PROPS)

/** Message shared by the unresolved-identifier warn and `ReferenceError`. */
const unresolvedMessage = name =>
  `[hydra-context] identifier '${name}' is undefined (scope, synth, and globals)`

/** Per-scope names already warned about. */
const warnedIdentifiers = new WeakMap()

/** Default reporter for unresolved identifiers. */
const defaultWarn = (...args) => console.warn(...args)

/** Per-scope names explicitly bound via `bindScope`/`bindLiveScope`. */
const boundScopeNames = new WeakMap()

/**
 * Records a bound name for the scope.
 * @param {Object} scope
 * @param {string} name
 * @returns {void}
 * */
function markBound(scope, name) {
  let bound = boundScopeNames.get(scope)
  if (bound === undefined) {
    bound = new Set()
    boundScopeNames.set(scope, bound)
  }
  bound.add(name)
}

/**
 * Removes a bound name from the scope record.
 * @param {Object} scope
 * @param {string} name
 * @returns {void}
 * */
function unmarkBound(scope, name) {
  boundScopeNames.get(scope)?.delete(name)
}

/**
 * Warns once per scope for an unresolved identifier.
 * @param {Object} scope
 * @param {string} name
 * @param {Function} warn
 * @returns {void}
 * */
function warnOnce(scope, name, warn) {
  let warned = warnedIdentifiers.get(scope)
  if (warned === undefined) {
    warned = new Set()
    warnedIdentifiers.set(scope, warned)
  }
  if (!warned.has(name)) {
    warned.add(name)
    warn(unresolvedMessage(name))
  }
}

/**
 * Reads a synth property, binding methods to the synth.
 * @param {Object} synth
 * @param {string} prop
 * @returns {{found: boolean, value: unknown}}
 * */
function readSynthProp(synth, prop) {
  if (synth === null || synth === undefined || !(prop in synth)) {
    return { found: false, value: undefined }
  }
  const value = synth[prop]
  if (typeof value === 'function') return { found: true, value: value.bind(synth) }
  return { found: true, value }
}

/**
 * Defines a writable static value on a scope.
 * @param {Object} scope
 * @param {string} name
 * @param {unknown} value
 * @returns {void}
 * */
function defineStatic(scope, name, value) {
  Object.defineProperty(scope, name, {
    enumerable: true,
    configurable: true,
    writable: true,
    value,
  })
}

/**
 * Defines a static binding in a scope.
 * @param {Object} scope
 * @param {string} name
 * @param {unknown} value
 * @returns {void}
 * */
export function bindScope(scope, name, value) {
  defineStatic(scope, name, value)
  markBound(scope, name)
}

/**
 * Defines a live getter binding; an assignment replaces it with a static value unless a `sink` is provided.
 * @param {Object} scope
 * @param {string} name
 * @param {Function} provider
 * @param {Function} [sink]
 * @returns {void}
 * */
export function bindLiveScope(scope, name, provider, sink) {
  Object.defineProperty(scope, name, {
    enumerable: true,
    configurable: true,
    get: provider,
    set(value) {
      if (sink) {
        sink(value)
      } else {
        defineStatic(scope, name, value)
      }
    },
  })
  markBound(scope, name)
}

/**
 * Deletes a binding from a scope.
 * @param {Object} scope
 * @param {string} name
 * @returns {void}
 * */
export function unbindScope(scope, name) {
  delete scope[name]
  unmarkBound(scope, name)
}

/**
 * Proxies scope access to live synth values and globals.
 * @param {Object} synth
 * @param {Object} scope
 * @param {Object} [options]
 * @param {'warn'|'error'|'silent'|Function} [options.unresolved='warn'] Policy for identifiers missing from scope, synth, and globals: warn once, stay silent, throw a `ReferenceError`, or report through a custom function.
 * @returns {Proxy}
 * */
export function createScopeProxy(synth, scope, options = {}) {
  const unresolved = options.unresolved ?? 'warn'
  const synthGlobal = GLOBAL_BRIDGE.synth
  return new Proxy(scope, {
    has() {
      return true
    },
    get(target, prop) {
      if (typeof prop !== 'string') {
        if (prop in target) return target[prop]
        return globalThis[prop]
      }
      if (liveNames.has(prop) && !boundScopeNames.get(target)?.has(prop)) {
        const liveRead = readSynthProp(synth, prop)
        if (liveRead.found) return liveRead.value
      }
      if (prop in target) return target[prop]
      if (prop === synthGlobal) return synth
      const synthValue = readSynthProp(synth, prop)
      if (synthValue.found) return synthValue.value
      if (!(prop in globalThis)) {
        if (typeof unresolved === 'function') {
          warnOnce(target, prop, unresolved)
        } else if (unresolved === 'error') {
          throw new ReferenceError(unresolvedMessage(prop))
        } else if (unresolved !== 'silent') {
          warnOnce(target, prop, defaultWarn)
        }
      }
      return fixGlobalThis(globalThis[prop])
    },
    set(target, prop, value) {
      target[prop] = value
      if (typeof prop === 'string' && userProps.has(prop) && synth) {
        synth[prop] = value
      }
      return true
    },
  })
}

/** Global functions already wrapped for a fixed `globalThis` receiver. */
const boundGlobals = new WeakMap()

/**
 * Wraps a global function so it keeps `globalThis` as its receiver.
 * @param {Function} fn
 * @returns {Function}
 * */
function fixGlobalThis(fn) {
  if (typeof fn !== 'function') return fn
  let wrapped = boundGlobals.get(fn)
  if (!wrapped) {
    wrapped = new Proxy(fn, {
      apply(target, _thisArg, args) {
        return Reflect.apply(target, globalThis, args)
      },
    })
    boundGlobals.set(fn, wrapped)
  }
  return wrapped
}
