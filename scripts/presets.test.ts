// Every preset in data/presets must build to exactly its `command`.
import { describe, expect, it } from 'vitest'
import { buildCommand, presetSelection } from '../src/lib/builder.ts'
import { validateDataset } from '../src/lib/validate.ts'
import { readDataFiles } from './read-data.ts'

const { data, issues } = validateDataset(readDataFiles())

it('data is valid', () => {
  expect(issues.filter((i) => i.level === 'error')).toEqual([])
})

for (const file of data.presets) {
  const toolData = data.tools.find((t) => t.tool.id === file.tool)!
  describe(`${file.tool} presets`, () => {
    for (const preset of file.presets) {
      it(preset.id, () => {
        const result = buildCommand(toolData.tool, toolData.flags, presetSelection(preset), preset.target)
        expect(result.command).toBe(preset.command)
        expect(result.warnings.filter((w) => w.kind !== 'root')).toEqual([])
      })
    }
  })
}
