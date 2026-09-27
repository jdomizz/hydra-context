import { describe, expect, it, vi } from 'vitest'
import { bindScope, bindLiveScope, createScopeProxy, unbindScope } from './scope.js'

/** Creates a scope proxy over a fresh scope by default. */
const makeProxy = (synth, scope = Object.create(null), options) =>
  createScopeProxy(synth, scope, options)

describe('createScopeProxy', () => {
  it('prioritizes synth properties over globals', () => {
    globalThis.priority = 'global'
    const proxy = makeProxy({ priority: 'synth' })
    expect(proxy.priority).toBe('synth')
    delete globalThis.priority
  })

  it('falls back to globals', () => {
    const proxy = makeProxy({})
    expect(proxy.Math).toBe(Math)
  })

  it('exposes the synth as synth', () => {
    const synth = {}
    const proxy = makeProxy(synth)
    expect(proxy.synth).toBe(synth)
  })

  for (const prop of ['time', 'speed', 'bpm']) {
    it(`reads ${prop} live on every access`, () => {
      const synth = { [prop]: 0 }
      const proxy = makeProxy(synth)
      expect(proxy[prop]).toBe(0)
      synth[prop] = 42
      expect(proxy[prop]).toBe(42)
    })
  }

  it('binds synth methods to the synth', () => {
    const synth = {
      base: 21,
      double() {
        return this.base * 2
      },
    }
    const proxy = makeProxy(synth)
    expect(proxy.double()).toBe(42)
  })

  it('binds global functions to globalThis', () => {
    globalThis.checkThis = function () {
      return this === globalThis
    }
    const proxy = makeProxy({})
    expect(proxy.checkThis()).toBe(true)
    delete globalThis.checkThis
  })

  it('resolves symbol keys from the scope', () => {
    const scope = Object.create(null)
    const symbol = Symbol('id')
    scope[symbol] = 'scoped'
    const proxy = makeProxy({}, scope)
    expect(proxy[symbol]).toBe('scoped')
  })

  it('lets an explicitly bound name override a live engine name', () => {
    const scope = Object.create(null)
    bindScope(scope, 'time', 5)
    const proxy = makeProxy({ time: 10 }, scope)
    expect(proxy.time).toBe(5)
  })

  it('re-reads live bindings on every access', () => {
    const scope = Object.create(null)
    let n = 0
    bindLiveScope(scope, 'tick', () => n)
    const proxy = makeProxy({}, scope)
    expect(proxy.tick).toBe(0)
    n = 42
    expect(proxy.tick).toBe(42)
  })

  it('lets a sketch overwrite a static binding', () => {
    const scope = Object.create(null)
    bindScope(scope, 'seed', 0.5)
    const proxy = makeProxy({}, scope)
    proxy.seed = 0.9
    expect(proxy.seed).toBe(0.9)
  })

  it('replaces a live binding with a static value on assignment', () => {
    const scope = Object.create(null)
    let calls = 0
    bindLiveScope(scope, 'freq', () => ++calls)
    const proxy = makeProxy({}, scope)
    expect(proxy.freq).toBe(1)
    proxy.freq = 440
    expect(proxy.freq).toBe(440)
    expect(calls).toBe(1)
  })

  it('calls a sink on assignment and keeps the live read', () => {
    const store = { seed: 0.2 }
    const writes = []
    const scope = Object.create(null)
    bindLiveScope(
      scope,
      'seed',
      () => store.seed,
      v => {
        writes.push(v)
        store.seed = v
      }
    )
    const proxy = makeProxy({}, scope)
    expect(proxy.seed).toBe(0.2)
    proxy.seed = 0.9
    expect(writes).toEqual([0.9])
    expect(proxy.seed).toBe(0.9)
    store.seed = 0.4
    expect(proxy.seed).toBe(0.4)
  })

  it('restores a live read after re-bind and unbind', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scope = Object.create(null)
    let calls = 0
    bindLiveScope(scope, 'freq', () => ++calls)
    const proxy = makeProxy({}, scope)
    expect(proxy.freq).toBe(1)
    proxy.freq = 440
    expect(proxy.freq).toBe(440)
    bindLiveScope(scope, 'freq', () => ++calls)
    expect(proxy.freq).toBe(2)
    unbindScope(scope, 'freq')
    expect(proxy.freq).toBeUndefined()
    warn.mockRestore()
  })

  it('mirrors user props when overwriting a live binding', () => {
    const synth = { speed: 1 }
    const scope = Object.create(null)
    bindLiveScope(scope, 'speed', () => 2)
    const proxy = makeProxy(synth, scope)
    expect(proxy.speed).toBe(2)
    proxy.speed = 3
    expect(proxy.speed).toBe(3)
    expect(synth.speed).toBe(3)
  })

  it('restores synth resolution after unbind', () => {
    const scope = Object.create(null)
    bindScope(scope, 'time', 5)
    const proxy = makeProxy({ time: 10 }, scope)
    expect(proxy.time).toBe(5)
    unbindScope(scope, 'time')
    expect(proxy.time).toBe(10)
  })

  it('does not pin live engine names after assignment', () => {
    const synth = { time: 10 }
    const scope = Object.create(null)
    const proxy = makeProxy(synth, scope)
    proxy.time = 0
    synth.time = 42
    expect(proxy.time).toBe(42)
  })

  it('mirrors user properties and keeps bare assignments on the scope', () => {
    const synth = { speed: 1, bpm: 30 }
    const scope = Object.create(null)
    const proxy = makeProxy(synth, scope)
    proxy.speed = 2
    proxy.bpm = 60
    proxy.x = 42
    expect(synth.speed).toBe(2)
    expect(synth.bpm).toBe(60)
    expect(scope.x).toBe(42)
    expect(synth.x).toBeUndefined()
  })

  it('warns once per scope', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const proxyA = makeProxy({})
    const proxyB = makeProxy({})
    expect(proxyA.missingName).toBeUndefined()
    expect(proxyA.missingName).toBeUndefined()
    expect(proxyB.missingName).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('reports unresolved identifiers through an unresolved function', () => {
    const warns = []
    const proxy = makeProxy({}, Object.create(null), {
      unresolved: message => warns.push(message),
    })
    expect(proxy.missingName).toBeUndefined()
    expect(warns).toHaveLength(1)
    expect(warns[0]).toContain('missingName')
  })

  it('reports an unresolved function only once per scope and name', () => {
    const warns = []
    const proxy = makeProxy({}, Object.create(null), {
      unresolved: message => warns.push(message),
    })
    expect(proxy.missingName).toBeUndefined()
    expect(proxy.missingName).toBeUndefined()
    expect(warns).toHaveLength(1)
  })

  it('throws a ReferenceError in error mode', () => {
    const proxy = makeProxy({}, Object.create(null), { unresolved: 'error' })
    expect(() => proxy.missingName).toThrow(/missingName/)
  })

  it('stays silent in silent mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const proxy = makeProxy({}, Object.create(null), { unresolved: 'silent' })
    expect(proxy.missingName).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
