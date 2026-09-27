import { describe, expect, it } from 'vitest'
import * as publicApi from './index.js'

describe('public API', () => {
  it('exports HydraContext, userCodeLine, and publishHydraGlobals', () => {
    expect(Object.keys(publicApi)).toEqual(['HydraContext', 'userCodeLine', 'publishHydraGlobals'])
  })
})
