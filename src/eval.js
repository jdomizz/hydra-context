import { createScopeProxy } from './scope.js'

/**
 * Evaluates code in a `with`-scope against a synth.
 * @param {string} code
 * @param {any} synth
 * @param {Object} [scope]
 * @param {Object} [options] Forwarded to the scope proxy.
 * @returns {Promise<unknown>}
 */
export function hydraEval(code, synth, scope, options) {
  const proxy = createScopeProxy(synth, scope ?? Object.create(null), options)
  try {
    const fn = new Function('__scope', `return (async function(){with(__scope){${code}\n}})()`)
    return fn(proxy)
  } catch (error) {
    return Promise.reject(error)
  }
}

/** V8 stack lines the eval wrapper adds above the user code. */
const V8_WRAPPER_LINE_OFFSET = 'function anonymous(__scope\n) {\n'.split('\n').length - 1

/**
 * Maps a V8 error stack to a 1-based user-code line; V8-only.
 * @param {Error} error
 * @param {string} code
 * @returns {number|undefined}
 */
export function userCodeLine(error, code) {
  try {
    if (!error || typeof error?.stack !== 'string' || typeof code !== 'string') return undefined
    const maxLine = code.split('\n').length
    for (const frame of error.stack.split('\n')) {
      if (!/^\s*at\s/.test(frame)) continue
      const match = /<anonymous>:(\d+):\d+/.exec(frame)
      if (!match) continue
      const line = Number(match[1]) - V8_WRAPPER_LINE_OFFSET
      if (line >= 1 && line <= maxLine) return line
    }
    return undefined
  } catch {
    return undefined
  }
}
