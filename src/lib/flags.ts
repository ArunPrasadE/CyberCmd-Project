import type { Arg, Flag } from '../schema/index.ts'

// Conflicts work both ways: a flag conflicts with what it lists and with every flag that lists it.
export function conflictsOf(flag: Flag, all: Flag[]): string[] {
  const ids = new Set(flag.conflicts)
  for (const other of all) if (other.conflicts.includes(flag.id)) ids.add(other.id)
  return [...ids]
}

// How an argument is written next to its flag: "-p <ports>", "-T<level>", "--script=<scripts>".
export function argUsage(flag: Flag, arg: Arg): string {
  const sep = arg.join === 'attached' ? '' : arg.join === 'equals' ? '=' : ' '
  return `${flag.flag}${sep}<${arg.name}>`
}

export function verifiedCount(flags: Flag[]): number {
  return flags.filter((f) => f.verified.status === 'verified').length
}

// Matches every word of the query against flag, id, name and summary.
// Exact flag matches come first, then flags starting with the query, then the rest in data order.
export function searchFlags(flags: Flag[], query: string): Flag[] {
  const q = query.trim().toLowerCase()
  if (!q) return flags
  const words = q.split(/\s+/)
  const rank = (f: Flag) => {
    const flagText = f.flag.toLowerCase()
    if (f.flag === query.trim()) return 0
    if (flagText === q) return 1
    if (flagText.startsWith(q)) return 2
    return 3
  }
  return flags
    .filter((f) => {
      const text = `${f.flag} ${f.id} ${f.name} ${f.summary}`.toLowerCase()
      return words.every((w) => text.includes(w))
    })
    .map((f, i) => ({ f, i, r: rank(f) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.f)
}
