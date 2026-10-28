import { describe, expect, it } from 'vitest'
import type { Flag } from '../schema/index.ts'
import { argUsage, conflictsOf, searchFlags, verifiedCount } from './flags.ts'

const make = (id: string, flag: string, name: string, extra: Partial<Flag> = {}): Flag => ({
  id,
  flag,
  name,
  summary: '',
  group: 'g',
  args: [],
  needs_root: false,
  conflicts: [],
  requires: [],
  supplies_targets: false,
  noise: 'low',
  status: 'current',
  replacement: null,
  goals: [],
  examples: [{ cmd: `x ${flag}`, note: '' }],
  verified: { status: 'unverified', date: null, target: null, note: '' },
  ...extra,
})

const sS = make('n-sS', '-sS', 'SYN scan', { conflicts: ['n-sT'] })
const sT = make('n-sT', '-sT', 'TCP connect scan')
const ss = make('n-sn', '-sn', 'Ping scan', { summary: 'host discovery only' })
const all = [sT, ss, sS]

describe('searchFlags', () => {
  it('returns everything for an empty query', () => {
    expect(searchFlags(all, '  ')).toEqual(all)
  })

  it('puts the exact (case-sensitive) flag first', () => {
    expect(searchFlags(all, '-sS').map((f) => f.id)[0]).toBe('n-sS')
  })

  it('matches every word across name and summary', () => {
    expect(searchFlags(all, 'host only').map((f) => f.id)).toEqual(['n-sn'])
    expect(searchFlags(all, 'scan').map((f) => f.id)).toEqual(['n-sT', 'n-sn', 'n-sS'])
  })
})

describe('conflictsOf', () => {
  it('works in both directions', () => {
    expect(conflictsOf(sS, all)).toEqual(['n-sT'])
    expect(conflictsOf(sT, all)).toEqual(['n-sS'])
    expect(conflictsOf(ss, all)).toEqual([])
  })
})

describe('argUsage', () => {
  it('joins the argument as configured', () => {
    const base = { type: 'string', placeholder: '', required: true } as const
    expect(argUsage(make('n-p', '-p', 'p'), { ...base, name: 'ports', join: 'space' })).toBe('-p <ports>')
    expect(argUsage(make('n-T', '-T', 't'), { ...base, name: 'level', join: 'attached' })).toBe('-T<level>')
    expect(argUsage(make('n-s', '--script', 's'), { ...base, name: 'scripts', join: 'equals' })).toBe('--script=<scripts>')
  })
})

it('counts verified flags', () => {
  const v = make('n-v', '-v', 'v', { verified: { status: 'verified', date: '2026-11-02', target: 'lab', note: 'ok' } })
  expect(verifiedCount([...all, v])).toBe(1)
})
