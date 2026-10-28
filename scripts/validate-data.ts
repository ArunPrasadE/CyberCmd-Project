// npm run validate: checks every YAML file under data/. Exit code 1 on errors (CI gate).
import { formatIssue, validateDataset } from '../src/lib/validate.ts'
import { readDataFiles } from './read-data.ts'

const files = readDataFiles()
const { data, issues } = validateDataset(files)

for (const issue of issues) console.log(formatIssue(issue))

const errors = issues.filter((i) => i.level === 'error').length
const warnings = issues.length - errors
const flags = data.tools.reduce((n, t) => n + t.flags.length, 0)
const verified = data.tools.reduce((n, t) => n + t.flags.filter((f) => f.verified.status === 'verified').length, 0)
const presets = data.presets.reduce((n, p) => n + p.presets.length, 0)

console.log(
  `\n${files.length} files, ${data.tools.length} tool(s), ${flags} flags (${verified} verified), ${presets} presets` +
    ` | ${errors} error(s), ${warnings} warning(s)`,
)
process.exit(errors > 0 ? 1 : 0)
