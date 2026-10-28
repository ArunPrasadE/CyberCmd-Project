import { z } from 'zod'
import { Goal, Id, NonEmpty, ToolId } from './common.ts'

export const PresetFlag = z.strictObject({
  id: Id,
  args: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
})

export const Preset = z.strictObject({
  id: Id,
  name: NonEmpty,
  summary: NonEmpty,
  flags: z.array(PresetFlag).min(1),
  target: z.string().default(''), // may be empty only when a flag supplies targets (-iL)
  // The exact command the builder must produce (checked by tests from task 6).
  command: NonEmpty,
  goals: z.array(Goal).default([]),
})

// data/presets/<tool>.yaml
export const PresetFile = z.strictObject({
  tool: ToolId,
  presets: z.array(Preset),
})

export type Preset = z.output<typeof Preset>
export type PresetFile = z.output<typeof PresetFile>
