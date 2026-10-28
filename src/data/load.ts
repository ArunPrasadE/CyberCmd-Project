// The only file that knows the data is YAML. Switching to JSON/TS data means changing this file.
import { validateDataset, type Dataset, type Issue } from '../lib/validate.ts'

const raw = import.meta.glob<string>('/data/**/*.{yaml,yml}', { query: '?raw', import: 'default', eager: true })

const result = validateDataset(Object.entries(raw).map(([path, text]) => ({ path, text })))

export const data: Dataset = result.data
export const dataIssues: Issue[] = result.issues
