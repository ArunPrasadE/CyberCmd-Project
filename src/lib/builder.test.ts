import { describe, expect, it } from 'vitest'
import type { Flag, Tool } from '../schema/index.ts'
import { blockedBy, buildCommand, quoteArg } from './builder.ts'

const tool: Tool = { id: 'n', name: 'N', binary: 'nmap', summary: 's', groups: [{ id: 'g', name: 'G', summary: '' }] }

const make = (id: string, flag: string, extra: Partial<Flag> = {}): Flag => ({
  id,
  flag,
  name: id,
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
  examples: [{ cmd: flag, note: '' }],
  verified: { status: 'unverified', date: null, target: null, note: '' },
  ...extra,
})

const arg = (name: string, extra = {}) => ({ name, type: 'string', placeholder: '', required: true, join: 'space', ...extra }) as const

const sS = make('n-sS', '-sS', { needs_root: true, conflicts: ['n-sT'] })
const sT = make('n-sT', '-sT')
const p = make('n-p', '-p', { args: [arg('ports')] })
const T = make('n-T', '-T', { args: [arg('level', { join: 'attached' })] })
const script = make('n-script', '--script', { args: [arg('scripts', { join: 'equals' })] })
const iL = make('n-iL', '-iL', { args: [arg('file')], supplies_targets: true })
const vi = make('n-vi', '--version-intensity', { requires: ['n-sV'], args: [arg('level')] })
const flags = [sS, sT, p, T, script, iL, vi]

describe('buildCommand', () => {
  it('builds flags in data order, not selection order', () => {
    const r = buildCommand(tool, flags, { 'n-T': { level: '4' }, 'n-p': { ports: '22,80' }, 'n-sS': {} }, '10.0.0.5')
    expect(r.command).toBe('nmap -sS -p 22,80 -T4 10.0.0.5')
    expect(r.complete).toBe(true)
  })

  it('joins values as configured', () => {
    expect(buildCommand(tool, flags, { 'n-script': { scripts: 'vuln' } }, 'h').command).toBe('nmap --script=vuln h')
  })

  it('warns about root but does not add sudo', () => {
    const r = buildCommand(tool, flags, { 'n-sS': {} }, 'h')
    expect(r.command).toBe('nmap -sS h')
    expect(r.warnings).toEqual([{ kind: 'root', flags: ['-sS'] }])
    expect(r.complete).toBe(true)
  })

  it('shows a placeholder and is incomplete without a target', () => {
    const r = buildCommand(tool, flags, { 'n-sT': {} }, '  ')
    expect(r.command).toBe('nmap -sT <target>')
    expect(r.warnings).toEqual([{ kind: 'target' }])
    expect(r.complete).toBe(false)
  })

  it('needs no target when a flag supplies targets', () => {
    const r = buildCommand(tool, flags, { 'n-iL': { file: 'targets.txt' } }, '')
    expect(r.command).toBe('nmap -iL targets.txt')
    expect(r.complete).toBe(true)
  })

  it('reports missing required values and unmet requires', () => {
    const r = buildCommand(tool, flags, { 'n-p': {}, 'n-vi': { level: '5' } }, 'h')
    expect(r.warnings).toContainEqual({ kind: 'missing-arg', flag: '-p', arg: 'ports' })
    expect(r.warnings).toContainEqual({ kind: 'requires', flag: '--version-intensity', needs: ['n-sV'] })
    expect(r.complete).toBe(false)
  })

  it('accepts several space-separated targets', () => {
    expect(buildCommand(tool, flags, { 'n-sT': {} }, '10.0.0.5  10.0.0.6').command).toBe('nmap -sT 10.0.0.5 10.0.0.6')
  })

  it('is empty-safe', () => {
    expect(buildCommand(tool, flags, {}, '')).toEqual({ command: 'nmap', warnings: [], complete: false })
  })
})

describe('quoteArg', () => {
  it('leaves normal values alone and quotes shell-special ones', () => {
    expect(quoteArg('22,80,443')).toBe('22,80,443')
    expect(quoteArg('RND:5,ME')).toBe('RND:5,ME')
    expect(quoteArg('http-*')).toBe(`'http-*'`)
    expect(quoteArg("it's")).toBe(`'it'\\''s'`)
  })
})

describe('blockedBy', () => {
  it('blocks in both directions and never blocks a selected flag', () => {
    expect(blockedBy(sT, flags, { 'n-sS': {} })).toEqual(['n-sS'])
    expect(blockedBy(sS, flags, { 'n-sT': {} })).toEqual(['n-sT'])
    expect(blockedBy(sS, flags, { 'n-sS': {} })).toEqual([])
    expect(blockedBy(p, flags, { 'n-sS': {} })).toEqual([])
  })
})
