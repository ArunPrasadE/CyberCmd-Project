import type { Flag } from '../schema/index.ts'

export function Badges({ flag, compact = false }: { flag: Flag; compact?: boolean }) {
  return (
    <span className="badges">
      {flag.status !== 'current' && <span className={`badge badge-${flag.status}`}>{flag.status}</span>}
      {flag.needs_root && (
        <span className="badge badge-root" title="Needs root: run with sudo on Linux">
          root
        </span>
      )}
      {!compact && <span className={`badge badge-noise-${flag.noise}`}>noise: {flag.noise}</span>}
      {flag.verified.status === 'verified' && (
        <span className="badge badge-verified" title="Run and checked in my lab">
          verified
        </span>
      )}
    </span>
  )
}
