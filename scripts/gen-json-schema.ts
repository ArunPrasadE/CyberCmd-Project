// npm run schema: writes schemas/*.schema.json from the zod schemas, for VS Code YAML autocomplete.
// Each data file links its schema with a "# yaml-language-server: $schema=..." first line.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { FlagFile, PresetFile, Tool } from '../src/schema/index.ts'

const outDir = join(import.meta.dirname, '..', 'schemas')
mkdirSync(outDir, { recursive: true })

const targets = { tool: Tool, 'flag-file': FlagFile, 'preset-file': PresetFile }
for (const [name, schema] of Object.entries(targets)) {
  // io: 'input' keeps fields with defaults optional, matching what you may leave out in YAML.
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
  writeFileSync(join(outDir, `${name}.schema.json`), JSON.stringify(json, null, 2) + '\n')
  console.log(`schemas/${name}.schema.json`)
}
