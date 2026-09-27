import { describe, expect, it, vi } from 'vitest'
import { hydraEval, userCodeLine } from './eval.js'

describe('hydraEval', () => {
  it('supports chained methods and source buffers', async () => {
    const out = vi.fn()
    const init = vi.fn()
    const synth = { osc: () => ({ out }), s0: { init } }
    await hydraEval('s0.init({}); osc(10).out()', synth)
    expect(init).toHaveBeenCalled()
    expect(out).toHaveBeenCalled()
  })

  it('supports async code and user property assignment', async () => {
    const synth = { osc: vi.fn(), speed: 1 }
    await hydraEval('await Promise.resolve(); speed = 2; osc(speed)', synth)
    expect(synth.speed).toBe(2)
    expect(synth.osc).toHaveBeenCalledWith(2)
  })

  it('rejects syntax errors and returns promises', async () => {
    expect(hydraEval('42', {})).toBeInstanceOf(Promise)
    await expect(hydraEval('((((', {})).rejects.toBeInstanceOf(SyntaxError)
  })

  it('keeps bare assignments in the scope', async () => {
    const synth = { osc: vi.fn() }
    const scope = Object.create(null)
    await hydraEval('x = 42; osc(x)', synth, scope)
    expect(scope.x).toBe(42)
    expect(synth.x).toBeUndefined()
  })

  it('persists bare assignments and does not persist declarations', async () => {
    const synth = { osc: vi.fn() }
    const scope = Object.create(null)
    await hydraEval('x = 42', synth, scope)
    await hydraEval('osc(x)', synth, scope)
    await hydraEval('const local = 1', synth, scope)
    await hydraEval('result = typeof local', synth, scope)
    expect(scope.result).toBe('undefined')
    expect(synth.osc).toHaveBeenCalledWith(42)
  })

  it('mirrors user properties to the synth', async () => {
    const synth = { speed: 1, bpm: 30 }
    const scope = Object.create(null)
    await hydraEval('speed = 2; bpm = 60', synth, scope)
    expect(synth.speed).toBe(2)
    expect(synth.bpm).toBe(60)
  })
})

describe('userCodeLine', () => {
  it('maps an eval error to the user line', async () => {
    const code = ['const a = 1', 'const b = 2', 'throw new Error("boom")'].join('\n')
    let error
    try {
      await hydraEval(code, {})
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(Error)
    expect(userCodeLine(error, code)).toBe(3)
  })

  it('returns undefined for invalid input', () => {
    expect(userCodeLine(undefined, 'code')).toBeUndefined()
    expect(userCodeLine({}, 'code')).toBeUndefined()
    expect(userCodeLine(new Error('x'), null)).toBeUndefined()
  })

  it('returns undefined when no stack frame maps to the wrapper', () => {
    const error = { stack: 'Error: x\n    at file:///src/foo.js:10:5' }
    expect(userCodeLine(error, 'const a = 1')).toBeUndefined()
  })

  it('returns undefined when the mapped line is outside the user code', () => {
    const error = { stack: 'Error: x\n    at <anonymous>:10:1' }
    expect(userCodeLine(error, 'const a = 1')).toBeUndefined()
  })
})
