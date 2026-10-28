import { useEffect, useMemo, useState } from 'react'
import { blockedBy, buildCommand, presetSelection, type Selection } from '../lib/builder.ts'
import { searchFlags } from '../lib/flags.ts'
import type { ToolData } from '../lib/validate.ts'
import type { Flag, Preset } from '../schema/index.ts'
import { ArgDialog } from './ArgDialog.tsx'
import { Badges } from './Badges.tsx'
import { CommandBar } from './CommandBar.tsx'
import { FlagDetail } from './FlagDetail.tsx'
import { PresetList } from './PresetList.tsx'

// Menu entry for presets. Group ids must start with a letter, so this can't collide.
const PRESETS = '_presets'

// The flag shown in the detail pane lives in the URL hash (#nmap-sS), so links can be shared and Back works.
function useHash(): [string, (id: string) => void] {
  const read = () => decodeURIComponent(window.location.hash.slice(1))
  const [hash, setHash] = useState(read)
  useEffect(() => {
    const onChange = () => setHash(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const set = (id: string) => {
    if (id) window.location.hash = id
    else history.pushState(null, '', window.location.pathname + window.location.search)
    setHash(id)
  }
  return [hash, set]
}

export function Explorer({ data, presets }: { data: ToolData; presets: Preset[] }) {
  const { tool, flags } = data
  const byId = useMemo(() => new Map(flags.map((f) => [f.id, f])), [flags])

  // Detail pane
  const [detailId, setDetailId] = useHash()
  const detail = byId.get(detailId)
  // A clicked group wins; otherwise show the open flag's group (from a link, rule chip or Back).
  const [pickedGroup, setPickedGroup] = useState<string | null>(null)
  const groupId = pickedGroup ?? detail?.group ?? tool.groups[0].id
  const showDetail = (id: string) => {
    if (id) setPickedGroup(null)
    setDetailId(id)
  }

  // Search
  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''
  const visible = searching ? searchFlags(flags, query) : flags.filter((f) => f.group === groupId)
  const group = tool.groups.find((g) => g.id === groupId)

  // Builder
  const [selection, setSelection] = useState<Selection>({})
  const [target, setTarget] = useState('')
  const [editing, setEditing] = useState<Flag | null>(null) // flag whose popup is open
  const result = buildCommand(tool, flags, selection, target)
  const selectedCount = Object.keys(selection).length

  const setFlag = (id: string, values: Record<string, string> | null) => {
    setSelection((prev) => {
      const next = { ...prev }
      if (values) next[id] = values
      else delete next[id]
      return next
    })
  }

  // Click a tile: flags with values open the popup; others toggle.
  const toggle = (f: Flag) => {
    if (blockedBy(f, flags, selection).length > 0) return
    if (f.args.length > 0) setEditing(f)
    else setFlag(f.id, f.id in selection ? null : {})
  }

  const flagText = (ids: string[]) => ids.map((id) => byId.get(id)?.flag ?? id).join(', ')
  const showingPresets = groupId === PRESETS && !searching

  return (
    <>
      <div className={`explorer${detail ? ' has-detail' : ''}`}>
        <nav className="groups" aria-label={`${tool.name} option groups`}>
          <ul>
            {presets.length > 0 && (
              <li className="presets-entry">
                <button
                  type="button"
                  aria-current={showingPresets ? 'true' : undefined}
                  onClick={() => {
                    setQuery('')
                    setPickedGroup(PRESETS)
                  }}
                >
                  <span>Presets</span>
                  <span className="count">{presets.length}</span>
                </button>
              </li>
            )}
            {tool.groups.map((g) => {
              const inGroup = flags.filter((f) => f.group === g.id)
              const picked = inGroup.filter((f) => f.id in selection).length
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    aria-current={!searching && g.id === groupId ? 'true' : undefined}
                    onClick={() => {
                      setQuery('')
                      setPickedGroup(g.id)
                    }}
                  >
                    <span>{g.name}</span>
                    <span className={`count${picked ? ' has-picked' : ''}`}>
                      {picked ? `${picked}/${inGroup.length}` : inGroup.length}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <section className="flags" aria-label="Flags">
          <div className="search">
            <input
              type="search"
              placeholder={`Search ${flags.length} ${tool.name} flags: -sV, version, UDP…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search flags"
            />
          </div>
          <h2 className="flags-title">
            {searching
              ? `${visible.length} result${visible.length === 1 ? '' : 's'}`
              : showingPresets
                ? 'Presets'
                : group?.name}
          </h2>
          {group?.summary && !searching && <p className="muted">{group.summary}</p>}

          {showingPresets ? (
            <PresetList
              presets={presets}
              flags={flags}
              onLoad={(p) => {
                setSelection(presetSelection(p))
                setTarget(p.target)
              }}
            />
          ) : visible.length === 0 ? (
            <p className="muted">No flag matches “{query}”.</p>
          ) : (
            <ul className="grid">
              {visible.map((f) => {
                const selected = f.id in selection
                const blocked = blockedBy(f, flags, selection)
                const values = selection[f.id]
                const valueText = values && Object.values(values).filter(Boolean).join(' ')
                return (
                  <li
                    key={f.id}
                    className={`tile-wrap${selected ? ' is-selected' : ''}${blocked.length ? ' is-blocked' : ''}${f.id === detailId ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="tile"
                      onClick={() => toggle(f)}
                      aria-pressed={selected}
                      aria-disabled={blocked.length > 0 || undefined}
                      title={blocked.length ? `Can't combine with ${flagText(blocked)}` : undefined}
                    >
                      <span className="tile-flag">
                        {f.flag}
                        {valueText && <span className="tile-value"> {valueText}</span>}
                      </span>
                      <span className="tile-name">{f.name}</span>
                      {blocked.length > 0 ? (
                        <span className="tile-blocked">Can't combine with {flagText(blocked)}</span>
                      ) : (
                        <Badges flag={f} compact />
                      )}
                    </button>
                    <button
                      type="button"
                      className="info"
                      onClick={() => showDetail(f.id)}
                      aria-label={`About ${f.flag}`}
                      title={`About ${f.flag}`}
                    >
                      i
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {detail && (
          <aside className="detail-pane">
            <FlagDetail
              flag={detail}
              flags={flags}
              selected={detail.id in selection}
              blockedBy={flagText(blockedBy(detail, flags, selection))}
              onToggle={() => toggle(detail)}
              onSelect={showDetail}
              onClose={() => showDetail('')}
            />
          </aside>
        )}
      </div>

      <CommandBar
        result={result}
        count={selectedCount}
        target={target}
        onTarget={setTarget}
        onClear={() => setSelection({})}
      />

      {editing && (
        <ArgDialog
          flag={editing}
          initial={selection[editing.id]}
          onSave={(values) => {
            setFlag(editing.id, values)
            setEditing(null)
          }}
          onRemove={() => {
            setFlag(editing.id, null)
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  )
}
