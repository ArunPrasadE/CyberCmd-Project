import type { Flag, Preset } from '../schema/index.ts'
import { CopyButton } from './CopyButton.tsx'

interface Props {
  presets: Preset[]
  flags: Flag[]
  onLoad: (preset: Preset) => void
}

export function PresetList({ presets, flags, onLoad }: Props) {
  const byId = new Map(flags.map((f) => [f.id, f]))
  return (
    <ul className="presets">
      {presets.map((p) => {
        const root = p.flags.some((pf) => byId.get(pf.id)?.needs_root)
        return (
          <li key={p.id} className="preset">
            <h3>{p.name}</h3>
            <p className="preset-summary">{p.summary}</p>
            <div className="cmd">
              <code>{p.command}</code>
              <CopyButton text={p.command} />
            </div>
            <div className="preset-footer">
              <span className="badges">
                {root && <span className="badge badge-root">root</span>}
                {p.goals.map((g) => (
                  <span key={g} className="badge badge-goal">
                    {g}
                  </span>
                ))}
              </span>
              <button type="button" className="btn btn-secondary" onClick={() => onLoad(p)}>
                Load into builder
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
