import { describe, expect, it } from 'vitest'
import { publishHydraGlobals, snapshotEngineGlobals } from './globals.js'

describe('publishHydraGlobals', () => {
  it('publishes and restores the hydra surface', () => {
    const hydra = { synth: { osc: () => {}, solid: () => {} } }
    const restore = publishHydraGlobals(hydra)
    expect(globalThis._hydra).toBe(hydra)
    expect(globalThis.hydraSynth).toBe(hydra)
    expect(globalThis.synth).toBe(hydra.synth)
    expect(typeof globalThis.osc).toBe('function')
    restore()
    expect(globalThis._hydra).toBeUndefined()
    expect(globalThis.synth).toBeUndefined()
    expect(globalThis.osc).toBeUndefined()
  })

  it('does not publish mutable state', () => {
    const hydra = { synth: { osc: () => {}, update: () => {}, speed: 1, time: 0 } }
    const restore = publishHydraGlobals(hydra)
    expect(globalThis.osc).toBeTypeOf('function')
    expect(globalThis.update).toBeUndefined()
    expect(globalThis.speed).toBeUndefined()
    expect(globalThis.time).toBeUndefined()
    restore()
  })

  it('restores a pre-existing global value', () => {
    globalThis.synth = 'original'
    const hydra = { synth: { osc: () => {} } }
    const restore = publishHydraGlobals(hydra)
    expect(globalThis.synth).toBe(hydra.synth)
    restore()
    expect(globalThis.synth).toBe('original')
    delete globalThis.synth
  })
})

describe('snapshotEngineGlobals', () => {
  it('restores engine-written names and deletes the ones that were absent', () => {
    globalThis.speed = 'host'
    const restore = snapshotEngineGlobals()
    globalThis.speed = 1
    globalThis.loadScript = () => {}
    globalThis.mouse = {}
    restore()
    expect(globalThis.speed).toBe('host')
    expect(globalThis.loadScript).toBeUndefined()
    expect(globalThis.mouse).toBeUndefined()
    delete globalThis.speed
  })

  it('does not capture names outside the engine surface', () => {
    globalThis.hostValue = 'keep'
    const restore = snapshotEngineGlobals()
    globalThis.hostValue = 'changed'
    restore()
    expect(globalThis.hostValue).toBe('changed')
    delete globalThis.hostValue
  })
})
