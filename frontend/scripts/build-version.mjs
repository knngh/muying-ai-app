import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const version = {
  commit: git('rev-parse', 'HEAD'),
  dirty: Boolean(git('status', '--porcelain')),
  builtAt: new Date().toISOString(),
}
writeFileSync(new URL('../dist/version.json', import.meta.url), `${JSON.stringify(version, null, 2)}\n`)
