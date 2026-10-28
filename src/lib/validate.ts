import { LineCounter, parseDocument, type Document } from 'yaml'
import type { z } from 'zod'
import { FlagFile, PresetFile, Tool, type Flag } from '../schema/index.ts'

export interface SourceFile {
  path: string // e.g. "data/tools/nmap/timing.yaml"
  text: string
}

export interface Issue {
  level: 'error' | 'warning'
  file: string
  line?: number
  path: string // e.g. "[3].needs_root"
  message: string
}

export interface ToolData {
  tool: Tool
  flags: Flag[] // ordered by group order in _tool.yaml, then file order
}

export interface Dataset {
  tools: ToolData[]
  presets: PresetFile[]
}

type PathKey = string | number

interface Parsed<T> {
  file: string
  value: T
  at: (path: PathKey[]) => number | undefined
}

export function validateDataset(files: SourceFile[]): { data: Dataset; issues: Issue[] } {
  const issues: Issue[] = []
  const report = (level: Issue['level'], file: string, line: number | undefined, path: PathKey[], message: string) =>
    issues.push({ level, file, line, path: formatPath(path), message })

  // 1. Sort files by role and parse them against their schema.
  const tools = new Map<string, Parsed<Tool>>()
  const flagFiles = new Map<string, { group: string; parsed: Parsed<Flag[]> }[]>()
  const presetFiles: Parsed<PresetFile>[] = []

  for (const src of files) {
    const file = normalizePath(src.path)
    let m: RegExpMatchArray | null
    if ((m = file.match(/^data\/tools\/([^/]+)\/_tool\.ya?ml$/))) {
      const parsed = parse(file, src.text, Tool, report)
      if (parsed) {
        if (parsed.value.id !== m[1]) {
          report('error', file, parsed.at(['id']), ['id'], `tool id "${parsed.value.id}" must match its folder name "${m[1]}"`)
        }
        tools.set(m[1], parsed)
      }
    } else if ((m = file.match(/^data\/tools\/([^/]+)\/([^/_][^/]*)\.ya?ml$/))) {
      const parsed = parse(file, src.text, FlagFile, report)
      if (parsed) {
        const list = flagFiles.get(m[1]) ?? []
        list.push({ group: m[2], parsed })
        flagFiles.set(m[1], list)
      }
    } else if (/^data\/presets\/[^/]+\.ya?ml$/.test(file)) {
      const parsed = parse(file, src.text, PresetFile, report)
      if (parsed) presetFiles.push(parsed)
    } else {
      report('error', file, undefined, [], 'unexpected file: tools go in data/tools/<tool>/, presets in data/presets/')
    }
  }

  // 2. Cross-reference checks per tool.
  const data: Dataset = { tools: [], presets: [] }
  const flagsByTool = new Map<string, Map<string, Flag>>()

  for (const toolDir of flagFiles.keys()) {
    if (!tools.has(toolDir)) {
      report('error', `data/tools/${toolDir}/_tool.yaml`, undefined, [], 'missing _tool.yaml for this tool folder')
    }
  }

  for (const [toolDir, toolParsed] of tools) {
    const tool = toolParsed.value
    const groupOrder = new Map<string, number>()
    tool.groups.forEach((g, i) => {
      if (groupOrder.has(g.id)) {
        report('error', toolParsed.file, toolParsed.at(['groups', i, 'id']), ['groups', i, 'id'], `duplicate group id "${g.id}"`)
      } else {
        groupOrder.set(g.id, i)
      }
    })

    // Collect flags, remembering where each one came from.
    const located: { flag: Flag; parsed: Parsed<Flag[]>; index: number }[] = []
    for (const { group, parsed } of flagFiles.get(toolDir) ?? []) {
      if (!groupOrder.has(group)) {
        report('error', parsed.file, undefined, [], `file name "${group}" is not a group id in ${toolParsed.file}`)
      }
      parsed.value.forEach((flag, index) => {
        located.push({ flag, parsed, index })
        if (flag.group !== group) {
          report('error', parsed.file, parsed.at([index, 'group']), [index, 'group'], `group is "${flag.group}" but the file is ${group}.yaml`)
        }
      })
    }

    const byId = new Map<string, { file: string; line?: number }>()
    const byFlag = new Map<string, string>()
    const flags = new Map<string, Flag>()
    for (const { flag, parsed, index } of located) {
      const where = (...p: PathKey[]) => parsed.at([index, ...p])
      const err = (p: PathKey[], msg: string) => report('error', parsed.file, where(...p), [index, ...p], msg)

      if (!flag.id.startsWith(`${tool.id}-`)) err(['id'], `id must start with "${tool.id}-"`)
      const prev = byId.get(flag.id)
      if (prev) err(['id'], `duplicate id "${flag.id}" (first defined in ${prev.file}${prev.line ? `:${prev.line}` : ''})`)
      else byId.set(flag.id, { file: parsed.file, line: where('id') })
      const prevFlag = byFlag.get(flag.flag)
      if (prevFlag) err(['flag'], `"${flag.flag}" is already defined by ${prevFlag}`)
      else byFlag.set(flag.flag, flag.id)
      flags.set(flag.id, flag)

      const argNames = new Set<string>()
      flag.args.forEach((a, i) => {
        if (argNames.has(a.name)) err(['args', i, 'name'], `duplicate arg name "${a.name}"`)
        argNames.add(a.name)
        const values = new Set<string>()
        a.choices?.forEach((c, j) => {
          if (values.has(c.value)) err(['args', i, 'choices', j, 'value'], `duplicate choice "${c.value}"`)
          values.add(c.value)
        })
      })
    }

    // References can point at flags in any group of the same tool.
    for (const { flag, parsed, index } of located) {
      const err = (p: PathKey[], msg: string) => report('error', parsed.file, parsed.at([index, ...p]), [index, ...p], msg)
      for (const key of ['conflicts', 'requires'] as const) {
        flag[key].forEach((ref, i) => {
          if (ref === flag.id) err([key, i], `a flag cannot list itself in ${key}`)
          else if (!flags.has(ref)) err([key, i], `unknown flag id "${ref}"`)
        })
      }
      for (const ref of flag.conflicts) {
        if (flag.requires.includes(ref)) err(['conflicts'], `"${ref}" is in both conflicts and requires`)
      }
      if (flag.replacement !== null) {
        if (flag.replacement === flag.id) err(['replacement'], 'a flag cannot replace itself')
        else if (!flags.has(flag.replacement)) err(['replacement'], `unknown flag id "${flag.replacement}"`)
      }
      if (flag.status === 'current') {
        flag.examples.forEach((ex, i) => {
          if (!ex.cmd.includes(flag.flag)) {
            report('warning', parsed.file, parsed.at([index, 'examples', i, 'cmd']), [index, 'examples', i, 'cmd'], `example does not contain "${flag.flag}"`)
          }
        })
      }
    }

    const ordered = located
      .map((l) => l.flag)
      .sort((a, b) => (groupOrder.get(a.group) ?? Infinity) - (groupOrder.get(b.group) ?? Infinity))
    data.tools.push({ tool, flags: ordered })
    flagsByTool.set(tool.id, flags)
  }

  // 3. Presets must use real flags with valid arguments.
  const presetIds = new Map<string, string>()
  for (const parsed of presetFiles) {
    const { tool, presets } = parsed.value
    const flags = flagsByTool.get(tool)
    if (!flags) {
      report('error', parsed.file, parsed.at(['tool']), ['tool'], `unknown tool "${tool}"`)
      continue
    }
    presets.forEach((preset, p) => {
      const base: PathKey[] = ['presets', p]
      const err = (sub: PathKey[], msg: string, level: Issue['level'] = 'error') =>
        report(level, parsed.file, parsed.at([...base, ...sub]), [...base, ...sub], msg)

      if (!preset.id.startsWith(`${tool}-`)) err(['id'], `id must start with "${tool}-"`)
      const prev = presetIds.get(preset.id)
      if (prev) err(['id'], `duplicate preset id "${preset.id}" (first defined in ${prev})`)
      else presetIds.set(preset.id, parsed.file)

      const suppliesTargets = preset.flags.some((pf) => flags.get(pf.id)?.supplies_targets)
      if (!preset.target.trim() && !suppliesTargets) err(['target'], 'needs a target (or a flag such as -iL that supplies targets)')

      const seen = new Set<string>()
      preset.flags.forEach((pf, i) => {
        const fp = (...sub: PathKey[]) => ['flags', i, ...sub]
        if (seen.has(pf.id)) err(fp('id'), `"${pf.id}" is listed twice`)
        seen.add(pf.id)
        const flag = flags.get(pf.id)
        if (!flag) {
          err(fp('id'), `unknown flag id "${pf.id}"`)
          return
        }
        if (flag.status === 'removed') err(fp('id'), `"${flag.flag}" was removed from ${tool}`)
        if (flag.status === 'deprecated') err(fp('id'), `"${flag.flag}" is deprecated`, 'warning')

        for (const name of Object.keys(pf.args)) {
          if (!flag.args.some((a) => a.name === name)) err(fp('args', name), `"${flag.flag}" has no arg "${name}"`)
        }
        const clash = preset.flags.slice(0, i).find((other) => conflictsWith(flag, other.id, flags))
        if (clash) err(fp('id'), `"${flag.flag}" can't be combined with "${flags.get(clash.id)?.flag}"`)

        for (const arg of flag.args) {
          const value = pf.args[arg.name]
          if (value === undefined) {
            if (arg.required) err(fp('args'), `missing required arg "${arg.name}" for "${flag.flag}"`)
          } else if (arg.type === 'number' && !Number.isFinite(Number(value))) {
            err(fp('args', arg.name), `"${arg.name}" must be a number`)
          } else if (arg.type === 'choice' && !arg.choices?.some((c) => c.value === String(value))) {
            err(fp('args', arg.name), `"${arg.name}" must be one of: ${arg.choices?.map((c) => c.value).join(', ')}`)
          }
        }
      })
    })
    data.presets.push(parsed.value)
  }

  return { data, issues }
}

// Conflicts work both ways.
function conflictsWith(flag: Flag, otherId: string, flags: Map<string, Flag>): boolean {
  return flag.conflicts.includes(otherId) || (flags.get(otherId)?.conflicts.includes(flag.id) ?? false)
}

function parse<S extends z.ZodType>(
  file: string,
  text: string,
  schema: S,
  report: (level: Issue['level'], file: string, line: number | undefined, path: PathKey[], message: string) => void,
): Parsed<z.output<S>> | null {
  const tabLine = text.split(/\r?\n/).findIndex((l) => /^ *\t/.test(l))
  if (tabLine >= 0) {
    report('error', file, tabLine + 1, [], 'tab used for indentation: YAML needs spaces (2 per level)')
    return null
  }
  const lineCounter = new LineCounter()
  const doc = parseDocument(text, { lineCounter, prettyErrors: true, uniqueKeys: true })
  if (doc.errors.length > 0) {
    // Later parse errors are usually knock-on effects of the first one.
    const e = doc.errors[0]
    const hint = e.code === 'DUPLICATE_KEY' ? '' : ' (check this line and the one above: unquoted colon, missing space after a colon, misaligned dash?)'
    report('error', file, e.linePos?.[0].line, [], firstLine(e.message).replace(/ at line \d+, column \d+:?$/, '') + hint)
    return null
  }
  const at = (path: PathKey[]) => lineOf(doc, lineCounter, path)
  const result = schema.safeParse(doc.toJS())
  if (!result.success) {
    for (const i of result.error.issues) {
      const path = i.path.filter((k): k is PathKey => typeof k !== 'symbol')
      report('error', file, at(path), path, i.message)
    }
    return null
  }
  return { file, value: result.data, at }
}

// Line of the deepest YAML node that exists along the path (1-based).
function lineOf(doc: Document, lc: LineCounter, path: PathKey[]): number | undefined {
  for (let n = path.length; n >= 0; n--) {
    const node = n === 0 ? doc.contents : doc.getIn(path.slice(0, n), true)
    const range = (node as { range?: [number, number, number] } | null | undefined)?.range
    if (range) return lc.linePos(range[0]).line
  }
  return undefined
}

// Callers pass repo-relative paths; tolerate "/data/..", "./data/.." and backslashes.
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.?\//, '')
}

function formatPath(path: PathKey[]): string {
  return path.map((k) => (typeof k === 'number' ? `[${k}]` : `.${k}`)).join('').replace(/^\./, '')
}

function firstLine(s: string): string {
  return s.split('\n')[0]
}

export function formatIssue(i: Issue): string {
  const where = i.line ? `${i.file}:${i.line}` : i.file
  const field = i.path ? `  ${i.path}:` : ''
  return `${i.level === 'error' ? 'ERROR' : 'warn '}  ${where}${field} ${i.message}`
}
