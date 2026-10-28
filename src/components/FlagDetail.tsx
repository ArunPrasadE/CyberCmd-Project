import { argUsage, conflictsOf } from '../lib/flags.ts'
import type { Flag } from '../schema/index.ts'
import { Badges } from './Badges.tsx'
import { CopyButton } from './CopyButton.tsx'

interface Props {
  flag: Flag
  flags: Flag[]
  selected: boolean // in the command
  blockedBy: string // flag texts that stop it being added, or ''
  onToggle: () => void
  onSelect: (id: string) => void // show another flag
  onClose: () => void
}

export function FlagDetail({ flag, flags, selected, blockedBy, onToggle, onSelect, onClose }: Props) {
  const byId = new Map(flags.map((f) => [f.id, f]))
  const conflicts = conflictsOf(flag, flags)
  const replacement = flag.replacement ? byId.get(flag.replacement) : undefined

  const flagLinks = (ids: string[]) => (
    <ul className="flag-links">
      {ids.map((id) => (
        <li key={id}>
          <button type="button" onClick={() => onSelect(id)}>
            {byId.get(id)?.flag ?? id}
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <article className="detail" aria-labelledby="detail-title">
      <button type="button" className="detail-close" onClick={onClose} aria-label="Close details">
        ×
      </button>
      <p className="detail-flag">{flag.flag}</p>
      <h2 id="detail-title">{flag.name}</h2>
      <Badges flag={flag} />

      {flag.status !== 'current' && (
        <p className={`notice notice-${flag.status}`}>
          {flag.status === 'removed' ? 'Not in current Nmap.' : 'Deprecated: still accepted, but avoid it.'}
          {replacement && (
            <>
              {' '}Use{' '}
              <button type="button" className="inline-link" onClick={() => onSelect(replacement.id)}>
                {replacement.flag}
              </button>{' '}
              instead.
            </>
          )}
        </p>
      )}

      <p className="detail-summary">{flag.summary}</p>

      <div className="detail-actions">
        {blockedBy ? (
          <p className="tile-blocked">Can't combine with {blockedBy}. Remove it first.</p>
        ) : (
          <button type="button" className={`btn ${selected ? 'btn-secondary' : 'btn-primary'}`} onClick={onToggle}>
            {selected ? (flag.args.length ? 'Edit value' : 'Remove from command') : 'Add to command'}
          </button>
        )}
      </div>

      {flag.args.length > 0 && (
        <section>
          <h3>Arguments</h3>
          {flag.args.map((arg) => (
            <div key={arg.name} className="arg">
              <code>{argUsage(flag, arg)}</code>
              <span className="arg-meta">
                {arg.type}
                {arg.required ? '' : ', optional'}
                {arg.placeholder && (
                  <>
                    , e.g. <code>{arg.placeholder}</code>
                  </>
                )}
              </span>
              {arg.choices && (
                <dl className="choices">
                  {arg.choices.map((c) => (
                    <div key={c.value}>
                      <dt>
                        <code>{c.value}</code>
                      </dt>
                      <dd>{c.note || '—'}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </section>
      )}

      <section>
        <h3>Examples</h3>
        {flag.examples.map((ex) => (
          <div key={ex.cmd} className="example">
            <div className="cmd">
              <code>{ex.cmd}</code>
              <CopyButton text={ex.cmd} />
            </div>
            {ex.note && <p className="example-note">{ex.note}</p>}
          </div>
        ))}
      </section>

      {(conflicts.length > 0 || flag.requires.length > 0) && (
        <section>
          <h3>Rules</h3>
          {conflicts.length > 0 && (
            <div className="rule">
              <span>Can't combine with</span>
              {flagLinks(conflicts)}
            </div>
          )}
          {flag.requires.length > 0 && (
            <div className="rule">
              <span>Needs</span>
              {flagLinks(flag.requires)}
            </div>
          )}
        </section>
      )}

      <section>
        <h3>Lab verification</h3>
        {flag.verified.status === 'verified' ? (
          <p className="verified">
            Verified {flag.verified.date} on {flag.verified.target}: {flag.verified.note}
          </p>
        ) : (
          <p className="muted">Not yet run in my lab. The explanation above is a draft until then.</p>
        )}
      </section>
    </article>
  )
}
