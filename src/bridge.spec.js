import { describe, expect, it } from 'vitest'
import { createBridge } from './bridge.js'

describe('withBridge', () => {
  it('publishes for the duration of fn and restores', async () => {
    const bridge = createBridge()
    const hydra = { synth: { osc: () => {} } }
    let inside = null
    await bridge.withBridge(hydra, () => {
      inside = globalThis._hydra
      return Promise.resolve()
    })
    expect(inside).toBe(hydra)
    expect(globalThis._hydra).toBeUndefined()
  })

  it('serializes concurrent runs across engines', async () => {
    const bridge = createBridge()
    const hydraA = { synth: {} }
    const hydraB = { synth: {} }
    let finishA
    const running = bridge.withBridge(hydraA, () => new Promise(resolve => (finishA = resolve)))
    await Promise.resolve()
    expect(globalThis._hydra).toBe(hydraA)
    const queued = bridge.withBridge(hydraB, async () => 'doneB')
    await Promise.resolve()
    expect(globalThis._hydra).toBe(hydraA)
    finishA()
    await running
    expect(await queued).toBe('doneB')
    expect(globalThis._hydra).toBeUndefined()
  })

  it('runs inline when the same engine already holds the bridge', async () => {
    const bridge = createBridge()
    const hydra = { synth: {} }
    const order = []
    await bridge.withBridge(hydra, async () => {
      order.push('outer')
      await bridge.withBridge(hydra, () => order.push('inner'))
      order.push('end')
    })
    expect(order).toEqual(['outer', 'inner', 'end'])
    expect(globalThis._hydra).toBeUndefined()
  })

  it('restores and hands the bridge over when fn rejects', async () => {
    const bridge = createBridge()
    const hydraA = { synth: {} }
    const hydraB = { synth: {} }
    const failing = bridge.withBridge(hydraA, () => Promise.reject(new Error('boom')))
    const ok = bridge.withBridge(hydraB, async () => 'ok')
    await expect(failing).rejects.toThrow('boom')
    expect(await ok).toBe('ok')
    expect(globalThis._hydra).toBeUndefined()
  })

  it('restores pre-existing globals through the published surface', async () => {
    const bridge = createBridge()
    globalThis.synth = 'original'
    const hydra = { synth: { osc: () => {} } }
    await bridge.withBridge(hydra, () => {
      expect(globalThis.synth).toBe(hydra.synth)
    })
    expect(globalThis.synth).toBe('original')
    delete globalThis.synth
  })
})
