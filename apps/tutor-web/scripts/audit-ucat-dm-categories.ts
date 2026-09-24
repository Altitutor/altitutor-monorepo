import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import type { Json } from '@altitutor/shared'
import {
  buildDecisionMakingCategoryAuditReport,
  type DecisionMakingAuditRecord,
} from '../src/features/ucat/questions/lib/parsers/decisionMakingCategoryAudit'

type PersistedStem = {
  id: string
  stem_text: Json
  status: string
  deleted_at: string | null
  ucat_questions: Array<{
    id: string
    question_text: Json
    deleted_at: string | null
  }>
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function getJson<T>(
  baseUrl: string,
  serviceRoleKey: string,
  path: string,
  query: URLSearchParams,
  range?: string
): Promise<T> {
  const response = await fetch(`${baseUrl}/rest/v1/${path}?${query}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(range ? { Range: range } : {}),
    },
  })
  if (!response.ok) {
    throw new Error(`Read-only audit request failed: ${response.status} ${await response.text()}`)
  }
  return response.json() as Promise<T>
}

async function fetchAuditRecords(): Promise<DecisionMakingAuditRecord[]> {
  const baseUrl = requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/u, '')
  const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY')
  const categories = await getJson<Array<{ id: string }>>(
    baseUrl,
    serviceRoleKey,
    'question_stem_categories',
    new URLSearchParams({
      select: 'id,ucat_sections!inner(name)',
      name: 'eq.Syllogisms',
      'ucat_sections.name': 'eq.Decision Making',
    })
  )
  if (categories.length !== 1 || !categories[0]) {
    throw new Error(`Expected one Decision Making Syllogisms category, found ${categories.length}`)
  }

  const stems: PersistedStem[] = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const page = await getJson<PersistedStem[]>(
      baseUrl,
      serviceRoleKey,
      'question_stems',
      new URLSearchParams({
        select: 'id,stem_text,status,deleted_at,ucat_questions(id,question_text,deleted_at)',
        question_stem_category_id: `eq.${categories[0].id}`,
        order: 'id.asc',
      }),
      `${offset}-${offset + pageSize - 1}`
    )
    stems.push(...page)
    if (page.length < pageSize) break
  }

  return stems.map((stem) => ({
    stem_id: stem.id,
    current_category: 'Syllogisms',
    stem_text: stem.stem_text,
    status: stem.status,
    deleted_at: stem.deleted_at,
    questions: stem.ucat_questions,
  }))
}

async function main(): Promise<void> {
  const outputPath = process.argv[2]
  const report = buildDecisionMakingCategoryAuditReport(await fetchAuditRecords())
  const json = `${JSON.stringify(report, null, 2)}\n`
  if (outputPath) {
    await writeFile(outputPath, json, 'utf8')
  } else {
    process.stdout.write(json)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
