import { describe, expect, it } from 'vitest'
import { validateDataset, type SourceFile } from './validate.ts'

const TOOL = `
id: demo
name: "Demo"
binary: "demo"
summary: "Test tool"
groups:
  - id: scan
    name: "Scan"
  - id: timing
    name: "Timing"
`

const flag = (over: string, id = 'demo-a', fl = '-a') => `
- id: ${id}
  flag: "${fl}"
  name: "A"
  summary: "Does A"
  group: scan
  needs_root: false
  noise: low
  status: current
  examples:
    - cmd: "demo ${fl} host"
  verified:
    status: unverified
${over}`

function run(extra: Record<string, string> = {}, scan = flag('')) {
  const files: SourceFile[] = Object.entries({
    'data/tools/demo/_tool.yaml': TOOL,
    'data/tools/demo/scan.yaml': scan,
    ...extra,
  }).map(([path, text]) => ({ path, text }))
  const result = validateDataset(files)
  return { ...result, errors: result.issues.filter((i) => i.level === 'error') }
}

const messages = (r: ReturnType<typeof run>) => r.errors.map((e) => `${e.path}: ${e.message}`).join('\n')

describe('validateDataset', () => {
  it('accepts a valid tool and applies defaults', () => {
    const r = run()
    expect(r.issues).toEqual([])
    const f = r.data.tools[0].flags[0]
    expect(f.args).toEqual([])
    expect(f.replacement).toBeNull()
    expect(f.verified).toEqual({ status: 'unverified', date: null, target: null, note: '' })
  })

  it('reports tabs in plain words with a line number', () => {
    const r = run({}, '- id: demo-a\n\tflag: "-a"\n')
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatchObject({ line: 2, message: expect.stringMatching(/tab/) })
  })

  it('reports only the first YAML syntax error, with a hint', () => {
    const r = run({}, '- id: demo-a\n  note: Use for: ports\n')
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatchObject({ line: 2, message: expect.stringMatching(/unquoted colon/) })
  })

  it('rejects duplicate keys instead of silently keeping the last one', () => {
    const r = run({}, flag('  noise: high'))
    expect(messages(r)).toMatch(/unique/i)
  })

  it('names the file, line and field for a wrong type', () => {
    const r = run({}, flag('').replace('needs_root: false', 'needs_root: "yes"'))
    expect(r.errors[0]).toMatchObject({ file: 'data/tools/demo/scan.yaml', path: '[0].needs_root', line: 7 })
  })

  it('rejects unknown keys (typos)', () => {
    const r = run({}, flag('  need_root: true'))
    expect(messages(r)).toMatch(/need_root/)
  })

  it('requires date, target and note once a flag is verified', () => {
    const r = run({}, flag('').replace('status: unverified', 'status: verified'))
    expect(r.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(['[0].verified.date', '[0].verified.target', '[0].verified.note']),
    )
  })

  it('rejects an unknown group and a mismatched file name', () => {
    const r = run({ 'data/tools/demo/nope.yaml': flag('', 'demo-b', '-b') })
    expect(messages(r)).toMatch(/"nope" is not a group id/)
    expect(messages(r)).toMatch(/group is "scan" but the file is nope.yaml/)
  })

  it('rejects duplicate ids and flags across files', () => {
    const timing = flag('').replace('group: scan', 'group: timing')
    const r = run({ 'data/tools/demo/timing.yaml': timing })
    expect(messages(r)).toMatch(/duplicate id "demo-a"/)
    expect(messages(r)).toMatch(/"-a" is already defined/)
  })

  it('rejects ids without the tool prefix', () => {
    const r = run({}, flag('', 'other-a'))
    expect(messages(r)).toMatch(/must start with "demo-"/)
  })

  it('checks conflicts, requires and replacement references', () => {
    const r = run({}, flag('  conflicts: [demo-zz, demo-a]\n  requires: [demo-zz]'))
    expect(messages(r)).toMatch(/conflicts\[0\]: unknown flag id "demo-zz"/)
    expect(messages(r)).toMatch(/cannot list itself in conflicts/)
    expect(messages(r)).toMatch(/both conflicts and requires/)
  })

  it('allows a replacement only on deprecated or removed flags', () => {
    const two = flag('  replacement: demo-b') + flag('', 'demo-b', '-b')
    expect(messages(run({}, two))).toMatch(/only deprecated or removed/)
    expect(run({}, two.replace('status: current', 'status: deprecated')).errors).toEqual([])
  })

  it('warns when an example does not use the flag', () => {
    const r = run({}, flag('').replace('demo -a host', 'demo host'))
    expect(r.errors).toEqual([])
    expect(r.issues[0]).toMatchObject({ level: 'warning', path: '[0].examples[0].cmd' })
  })

  it('validates choice args', () => {
    const arg = `  args:\n    - name: level\n      type: choice\n      join: attached`
    expect(messages(run({}, flag(arg)))).toMatch(/needs a non-empty choices list/)
    const dup = `${arg}\n      choices:\n        - { value: "1", note: "One" }\n        - { value: "1" }`
    expect(messages(run({}, flag(dup)))).toMatch(/duplicate choice "1"/)
    expect(run({}, flag(`${arg}\n      choices: [{ value: "1", note: "One" }]`)).errors).toEqual([])
  })

  it('orders flags by group order in _tool.yaml', () => {
    const timing = flag('', 'demo-t', '-t').replace('group: scan', 'group: timing')
    const r = run({ 'data/tools/demo/timing.yaml': timing })
    expect(r.data.tools[0].flags.map((f) => f.id)).toEqual(['demo-a', 'demo-t'])
  })

  describe('presets', () => {
    const withArg = flag(`  args:\n    - name: ports\n      type: number`)
    const preset = (flags: string) => ({
      'data/presets/demo.yaml': `
tool: demo
presets:
  - id: demo-p
    name: "P"
    summary: "S"
    target: "host"
    command: "demo -a 1 host"
    flags:
${flags}`,
    })

    it('accepts a valid preset', () => {
      const r = run(preset('      - id: demo-a\n        args: { ports: 80 }'), withArg)
      expect(r.issues).toEqual([])
    })

    it('rejects unknown flags, missing, unknown and mistyped args', () => {
      expect(messages(run(preset('      - id: demo-zz'), withArg))).toMatch(/unknown flag id "demo-zz"/)
      expect(messages(run(preset('      - id: demo-a'), withArg))).toMatch(/missing required arg "ports"/)
      expect(messages(run(preset('      - id: demo-a\n        args: { ports: 1, x: 2 }'), withArg))).toMatch(/no arg "x"/)
      expect(messages(run(preset('      - id: demo-a\n        args: { ports: abc }'), withArg))).toMatch(/must be a number/)
    })

    it('rejects presets that combine conflicting flags', () => {
      const two = flag('  conflicts: [demo-b]') + flag('', 'demo-b', '-b')
      const r = run(preset('      - id: demo-a\n      - id: demo-b'), two)
      expect(messages(r)).toMatch(/"-b" can't be combined with "-a"/)
    })

    it('rejects presets for an unknown tool', () => {
      const r = run({ 'data/presets/x.yaml': 'tool: ghost\npresets: []' })
      expect(messages(r)).toMatch(/unknown tool "ghost"/)
    })
  })

  it('rejects files in unexpected places', () => {
    expect(messages(run({ 'data/stray.yaml': 'a: 1' }))).toMatch(/unexpected file/)
  })
})
