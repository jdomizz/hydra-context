import { describe, expect, it, vi } from 'vitest'
import { createBridge } from './bridge.js'
import { HydraContext } from './context.js'

describe('HydraContext', () => {
  it('exposes its engine and returns itself from bindings', async () => {
    const synth = { osc: vi.fn() }
    const hydra = { synth }
    const scope = Object.create(null)
    const context = new HydraContext(hydra, { scope })

    expect(context).toBeInstanceOf(HydraContext)
    expect(context.hydra).toBe(hydra)
    expect(context.synth).toBe(synth)
    expect(context.scope).toBe(scope)
    expect(context.bind('speed', 1)).toBe(context)
    expect(context.bindLive('freq', () => 2)).toBe(context)
    expect(context.unbind('speed')).toBe(context)
  })

  it('persists assignments and isolates contexts', async () => {
    const synth = { osc: vi.fn() }
    const context = new HydraContext({ synth })
    await context.eval('x = 42')
    await context.eval('osc(x)')
    expect(synth.osc).toHaveBeenCalledWith(42)
    const other = new HydraContext({ synth })
    await other.eval('osc(x)')
    expect(synth.osc).toHaveBeenLastCalledWith(undefined)
  })

  it('rejects unknown identifiers in error mode', async () => {
    const context = new HydraContext({ synth: { osc: vi.fn() } }, { unresolved: 'error' })
    await expect(context.eval('missingName')).rejects.toBeInstanceOf(ReferenceError)
  })

  it('reuses a provided scope', async () => {
    const synth = { osc: vi.fn() }
    const scope = Object.create(null)
    const context = new HydraContext({ synth }, { scope })
    context.bind('mouse', { x: 100, y: 200 })
    await context.eval('osc(mouse.x, mouse.y)')
    expect(synth.osc).toHaveBeenCalledWith(100, 200)
  })

  it('supports live bindings and unbind', async () => {
    const synth = { osc: vi.fn() }
    const context = new HydraContext({ synth })
    let value = 1
    context.bindLive('freq', () => value)
    await context.eval('osc(freq)')
    value = 2
    await context.eval('osc(freq)')
    context.unbind('freq')
    await context.eval('osc(freq)')
    expect(synth.osc).toHaveBeenNthCalledWith(1, 1)
    expect(synth.osc).toHaveBeenNthCalledWith(2, 2)
    expect(synth.osc).toHaveBeenNthCalledWith(3, undefined)
  })

  it('lets a sketch overwrite a live binding and restores on re-bind', async () => {
    const synth = { osc: vi.fn() }
    const context = new HydraContext({ synth })
    let value = 1
    context.bindLive('freq', () => value)
    await context.eval('freq = 440; osc(freq)')
    expect(synth.osc).toHaveBeenCalledWith(440)
    context.bindLive('freq', () => value)
    await context.eval('osc(freq)')
    expect(synth.osc).toHaveBeenLastCalledWith(1)
  })

  it('forwards live binding writes to a sink and stays live', async () => {
    const synth = { osc: vi.fn() }
    const context = new HydraContext({ synth })
    const store = { seed: 0.2 }
    const writes = []
    context.bindLive(
      'seed',
      () => store.seed,
      v => {
        writes.push(v)
        store.seed = v
      }
    )
    await context.eval('seed = 0.7; osc(seed)')
    expect(writes).toEqual([0.7])
    expect(synth.osc).toHaveBeenCalledWith(0.7)
    await context.eval('osc(seed)')
    expect(synth.osc).toHaveBeenLastCalledWith(0.7)
  })

  it('binds editor globals into the scope by default', async () => {
    const hydra = { synth: {} }
    const context = new HydraContext(hydra)
    await context.eval('captured = [_hydra, hydraSynth]')
    expect(context.scope.captured).toEqual([hydra, hydra])
    expect(globalThis._hydra).toBeUndefined()
  })

  it('can attach an engine after construction', async () => {
    const synth = { osc: vi.fn() }
    const context = new HydraContext()
    context.bind('x', 42)
    const hydra = { synth }

    expect(context.attach(hydra)).toBe(context)
    expect(context.hydra).toBe(hydra)
    expect(context.synth).toBe(synth)
    expect(context.scope._hydra).toBe(hydra)
    expect(context.scope.hydraSynth).toBe(hydra)
    await context.eval('osc(x)')
    expect(synth.osc).toHaveBeenCalledWith(42)
  })

  it('reports undefined identifiers through an unresolved function', async () => {
    const warns = []
    const context = new HydraContext({ synth: {} }, { unresolved: message => warns.push(message) })
    await context.eval('nothing = missing')
    expect(warns.some(message => message.includes("'missing'"))).toBe(true)
  })

  it('runs a function under the bridge and restores globals', async () => {
    const hydra = { synth: {} }
    const context = new HydraContext(hydra, { bridge: createBridge() })
    const result = await context.withBridge(() => Promise.resolve(42))
    expect(result).toBe(42)
    expect(globalThis._hydra).toBeUndefined()
  })

  it('throws when running the bridge without an engine', () => {
    const context = new HydraContext()
    expect(() => context.withBridge(() => {})).toThrow('withBridge requires a hydra instance')
  })
})
