import { z } from 'zod'
import { Goal, Id, NonEmpty } from './common.ts'

export const Choice = z.strictObject({
  value: NonEmpty,
  note: z.string().default(''), // what this value means, e.g. "4: Aggressive"
})

export const Arg = z.strictObject({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'lowercase, digits and underscores (e.g. ports)'),
  type: z.enum(['string', 'number', 'choice']).default('string'),
  choices: z.array(Choice).optional(), // only for type: choice
  placeholder: z.string().default(''),
  required: z.boolean().default(true),
  // How the value is joined to the flag:
  //   space    -> -p 80          equals -> --script=vuln
  //   attached -> -T4 / -PS22
  join: z.enum(['space', 'equals', 'attached']).default('space'),
})
  .refine((a) => a.type !== 'choice' || (a.choices?.length ?? 0) > 0, {
    message: 'type: choice needs a non-empty choices list',
    path: ['choices'],
  })

export const Example = z.strictObject({
  cmd: NonEmpty,
  note: z.string().default(''),
})

const IsoDate = z.iso.date('use a quoted date like "2026-11-02"')

// A flag only counts as verified after I ran it and wrote a note.
export const Verified = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('unverified'),
    date: z.null().default(null),
    target: z.null().default(null),
    note: z.string().default(''),
  }),
  z.strictObject({
    status: z.literal('verified'),
    date: IsoDate,
    target: NonEmpty,
    note: NonEmpty,
  }),
])

export const Flag = z.strictObject({
  id: Id,
  flag: z.string().regex(/^--?[A-Za-z0-9]/, 'must start with - or -- (e.g. "-sS")'),
  name: NonEmpty,
  summary: NonEmpty,
  group: Id,
  args: z.array(Arg).default([]),
  needs_root: z.boolean(),
  conflicts: z.array(Id).default([]),
  requires: z.array(Id).default([]),
  supplies_targets: z.boolean().default(false), // e.g. -iL: no target needed on the command line
  noise: z.enum(['low', 'medium', 'high']),
  status: z.enum(['current', 'deprecated', 'removed']),
  replacement: Id.nullable().default(null), // id of the flag to use instead
  goals: z.array(Goal).default([]),
  examples: z.array(Example).min(1, 'add at least one example'),
  verified: Verified,
})
  .refine((f) => f.status !== 'current' || f.replacement === null, {
    message: 'only deprecated or removed flags have a replacement',
    path: ['replacement'],
  })

// data/tools/<tool>/<group>.yaml is a list of flags.
export const FlagFile = z.array(Flag)

export type Arg = z.output<typeof Arg>
export type Flag = z.output<typeof Flag>
