import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { SourceFile } from '../src/lib/validate.ts'

export const root = join(import.meta.dirname, '..')

// Every YAML file under data/, with repo-relative forward-slash paths.
export function readDataFiles(): SourceFile[] {
  return readdirSync(join(root, 'data'), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.ya?ml$/.test(e.name))
    .map((e) => {
      const full = join(e.parentPath, e.name)
      return { path: relative(root, full).replace(/\\/g, '/'), text: readFileSync(full, 'utf8') }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}
