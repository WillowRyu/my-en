import { readFileSync } from 'node:fs'
import ts from 'typescript'
export async function loadContent() {
  const source = readFileSync(new URL('../src/content.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } })
  return import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'))
}
