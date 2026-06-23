import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { generatedContentToProseMirror } from '../src/features/ucat/questions/lib/ai-generation/content-blocks'
import { GeneratedCandidateResponseSchema, type GeneratedContentBlock } from '../src/features/ucat/questions/lib/ai-generation/schema'

function arg(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index >= 0 ? process.argv[index + 1] : null
  if (!value) throw new Error(`Missing --${name}`)
  return value
}

async function main() {
  const input = resolve(arg('input'))
  const output = resolve(arg('output'))
  const lines = (await readFile(input, 'utf8')).trim().split('\n')
  const record = JSON.parse(lines.at(-1) ?? '{}') as { parsedResponse?: unknown }
  const parsed = GeneratedCandidateResponseSchema.parse(record.parsedResponse)
  const stem = parsed.stems[0]
  if (!stem) throw new Error('Benchmark record has no stem')

  const values: unknown[] = [
    stem.stemText,
    ...stem.questions.flatMap((question) => [question.questionText, ...question.options.map((option) => option.answerText)]),
  ]
  const blocks = values.flatMap((value) => Array.isArray(value) ? value : []) as GeneratedContentBlock[]
  await mkdir(output, { recursive: true })

  let visualIndex = 0
  for (const block of blocks) {
    if (block.type !== 'visual') continue
    const doc = generatedContentToProseMirror([block]) as {
      content?: Array<{ attrs?: { src?: string } }>
    }
    const src = doc.content?.[0]?.attrs?.src
    if (!src?.startsWith('data:image/svg+xml;charset=utf-8,')) continue
    visualIndex += 1
    await writeFile(
      resolve(output, `visual-${visualIndex}-${block.visualType}.svg`),
      decodeURIComponent(src.slice('data:image/svg+xml;charset=utf-8,'.length)),
      'utf8'
    )
  }

  const tables = blocks.filter((block): block is Extract<GeneratedContentBlock, { type: 'table' }> => block.type === 'table')
  if (tables.length > 0) {
    const html = tables.map((table) => `<h2>${table.caption ?? 'Table'}</h2><table border="1" cellpadding="8"><thead><tr>${table.columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('\n')
    await writeFile(resolve(output, 'tables.html'), `<!doctype html><meta charset="utf-8"><body>${html}</body>`, 'utf8')
  }

  console.log(JSON.stringify({ output, visuals: visualIndex, tables: tables.length }, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
