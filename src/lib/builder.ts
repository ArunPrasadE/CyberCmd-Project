import type { Flag, Preset, Tool } from '../schema/index.ts'
import { conflictsOf } from './flags.ts'

// Selected flag id -> its argument values (by arg name). Flags without args map to {}.
export type Selection = Record<string, Record<string, string>>

export type Warning =
  | { kind: 'root'; flags: string[] } // flag texts, e.g. ["-sS", "-O"]
  | { kind: 'target' }
  | { kind: 'missing-arg'; flag: string; arg: string }
  | { kind: 'requires'; flag: string; needs: string[] }

export interface BuildResult {
  command: string
  warnings: Warning[]
  complete: boolean // false when a target or required value is missing
}

export const TARGET_PLACEHOLDER = '<target>'

// Single-quote values the shell would otherwise split or expand (spaces, *, ;, $ ...).
export function quoteArg(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function presetSelection(preset: Preset): Selection {
  return Object.fromEntries(
    preset.flags.map((f) => [f.id, Object.fromEntries(Object.entries(f.args).map(([k, v]) => [k, String(v)]))]),
  )
}

// Selected flags that stop `flag` from being added.
export function blockedBy(flag: Flag, flags: Flag[], selection: Selection): string[] {
  if (flag.id in selection) return []
  return conflictsOf(flag, flags).filter((id) => id in selection)
}

// Flags are emitted in data order (group order, then file order), so the same selection
// always gives the same command.
export function buildCommand(tool: Tool, flags: Flag[], selection: Selection, target: string): BuildResult {
  const chosen = flags.filter((f) => f.id in selection)
  const warnings: Warning[] = []
  const parts: string[] = [tool.binary]

  for (const flag of chosen) {
    const values = selection[flag.id]
    let text = flag.flag
    for (const arg of flag.args) {
      const value = values[arg.name]?.trim() ?? ''
      if (!value) {
        if (arg.required) warnings.push({ kind: 'missing-arg', flag: flag.flag, arg: arg.name })
        continue
      }
      const sep = arg.join === 'attached' ? '' : arg.join === 'equals' ? '=' : ' '
      text += sep + quoteArg(value)
    }
    parts.push(text)

    const missing = flag.requires.filter((id) => !(id in selection))
    if (missing.length > 0) {
      const byId = new Map(flags.map((f) => [f.id, f.flag]))
      warnings.push({ kind: 'requires', flag: flag.flag, needs: missing.map((id) => byId.get(id) ?? id) })
    }
  }

  const needsTarget = chosen.length > 0 && !chosen.some((f) => f.supplies_targets)
  const t = target.trim()
  if (needsTarget) {
    parts.push(t ? t.split(/\s+/).map(quoteArg).join(' ') : TARGET_PLACEHOLDER)
    if (!t) warnings.push({ kind: 'target' })
  }

  const root = chosen.filter((f) => f.needs_root).map((f) => f.flag)
  if (root.length > 0) warnings.unshift({ kind: 'root', flags: root })

  return {
    command: parts.join(' '),
    warnings,
    complete: chosen.length > 0 && !warnings.some((w) => w.kind !== 'root'),
  }
}
