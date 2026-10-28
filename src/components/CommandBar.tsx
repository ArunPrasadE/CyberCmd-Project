import type { BuildResult, Warning } from '../lib/builder.ts'
import { CopyButton } from './CopyButton.tsx'

interface Props {
  result: BuildResult
  count: number
  target: string
  onTarget: (value: string) => void
  onClear: () => void
}

function message(w: Warning) {
  switch (w.kind) {
    case 'root':
      return (
        <>
          Needs root: <code>{w.flags.join(' ')}</code>. Run with sudo on Linux.
        </>
      )
    case 'target':
      return 'Add a target: an IP, hostname or range.'
    case 'missing-arg':
      return (
        <>
          <code>{w.flag}</code> needs a value for {w.arg}. Click the flag to add it.
        </>
      )
    case 'requires':
      return (
        <>
          <code>{w.flag}</code> only works together with <code>{w.needs.join(' ')}</code>.
        </>
      )
  }
}

export function CommandBar({ result, count, target, onTarget, onClear }: Props) {
  return (
    <section className="command-bar" aria-label="Command builder">
      <div className="command-row">
        <label className="target">
          <span>Target</span>
          <input
            type="text"
            value={target}
            onChange={(e) => onTarget(e.target.value)}
            placeholder="e.g. 10.0.0.5 or 192.168.1.0/24"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {count > 0 && (
          <button type="button" className="btn btn-secondary" onClick={onClear}>
            Clear ({count})
          </button>
        )}
      </div>

      {count === 0 ? (
        <p className="command-hint">
          Click flags to build a command. Use <span className="info-sample">i</span> to read about a flag.
        </p>
      ) : (
        <>
          <div className={`cmd command${result.complete ? '' : ' is-incomplete'}`} aria-live="polite">
            <code>{result.command}</code>
            <CopyButton text={result.command} />
          </div>
          {result.warnings.length > 0 && (
            <ul className="warnings">
              {result.warnings.map((w, i) => (
                <li key={i} className={`warning warning-${w.kind}`}>
                  {message(w)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
