import { z } from 'zod'

// Ids are case-sensitive on purpose: Nmap has -v/-V and -d/-D.
// Flag ids are "<tool>-<name>", e.g. nmap-sS, nmap-max-retries.
export const Id = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[A-Za-z0-9]+)*$/, 'use letters, digits and single hyphens, starting with a lowercase letter (e.g. nmap-sS)')

export const ToolId = z.string().regex(/^[a-z][a-z0-9]*$/, 'lowercase letters and digits only (e.g. nmap)')

export const NonEmpty = z.string().trim().min(1, 'must not be empty')

// Draft taxonomy from the spec (used from M3).
export const Goal = z.enum([
  'recon',
  'enumeration',
  'vuln-assessment',
  'exploitation',
  'post-exploitation',
  'monitoring',
  'forensics',
])
