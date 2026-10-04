import { readFileSync, writeFileSync, renameSync, chmodSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve('.env')
export function saveOpenAIKey(key: string) {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const updated = current.replace(/^OPENAI_API_KEY=.*$/m, `OPENAI_API_KEY=${key}`)
  const text = /^OPENAI_API_KEY=/m.test(current) ? updated : `${current.trimEnd()}\nOPENAI_API_KEY=${key}\n`
  const temporary = `${file}.pending`
  writeFileSync(temporary, text, { mode: 0o600 })
  renameSync(temporary, file)
  chmodSync(file, 0o600)
  process.env.OPENAI_API_KEY = key
}
