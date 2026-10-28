import { z } from 'zod'
import { Id, NonEmpty, ToolId } from './common.ts'

export const Group = z.strictObject({
  id: Id,
  name: NonEmpty,
  summary: z.string().default(''),
})

// data/tools/<tool>/_tool.yaml
export const Tool = z.strictObject({
  id: ToolId,
  name: NonEmpty,
  binary: NonEmpty, // what you type in the terminal, e.g. "nmap"
  summary: NonEmpty,
  homepage: z.url().optional(),
  groups: z.array(Group).min(1),
})

export type Group = z.output<typeof Group>
export type Tool = z.output<typeof Tool>
