import { Explorer } from './components/Explorer.tsx'
import { Header } from './components/Header.tsx'
import { data, dataIssues } from './data/load.ts'
import { verifiedCount } from './lib/flags.ts'
import { formatIssue } from './lib/validate.ts'

export default function App() {
  const errors = dataIssues.filter((i) => i.level === 'error')
  const allFlags = data.tools.flatMap((t) => t.flags)

  return (
    <>
      <Header verified={verifiedCount(allFlags)} total={allFlags.length} />
      <main>
        {errors.length > 0 && (
          <pre role="alert" className="data-errors">
            {errors.map(formatIssue).join('\n')}
          </pre>
        )}
        {/* One tool for now; a tool switcher comes with M2. */}
        {data.tools[0] && (
          <Explorer
            data={data.tools[0]}
            presets={data.presets.find((p) => p.tool === data.tools[0].tool.id)?.presets ?? []}
          />
        )}
      </main>
      <footer className="site-footer">
        Generate and explain only: nothing runs here. Scan only systems you own or are authorized to test
        (your lab, TryHackMe, scanme.nmap.org at a low rate). Flags marked <span className="badge badge-root">root</span>{' '}
        need sudo on Linux.
      </footer>
    </>
  )
}
