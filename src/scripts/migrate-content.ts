#!/usr/bin/env tsx

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import {
  fetchAllContent,
  MigrationError,
  type ContentFetchResult,
  type ContentType,
  type NormalizedContent
} from '../migrations/audioProjects'

type MigrationReport = {
  type: ContentType
  tableName: string
  sourceCount: number
  migratedCount: number
  inserted: number
  updated: number
  imageMappings: Array<{ source: string; target: string }>
}

async function main() {
  try {
    ensureWranglerAvailable()

    const contentSets = await fetchAllContent()

    if (contentSets.length === 0) {
      console.log('No content sets were returned from WordPress. Nothing to migrate.')
      return
    }

    const sqlStatements: string[] = []
    const reports: MigrationReport[] = []

    for (const set of contentSets) {
      const report = await prepareSqlForContentSet(set, sqlStatements)
      reports.push(report)
    }

    if (sqlStatements.length === 0) {
      console.log('No content required migration.')
      return
    }

    const sqlFilePath = writeTempSqlFile(sqlStatements.join('\n\n'))
    try {
      executeSqlFile(sqlFilePath)
    } finally {
      fs.rmSync(sqlFilePath, { force: true })
    }

    logSummary(reports)
  } catch (error) {
    if (error instanceof MigrationError) {
      console.error(`[content-migration] ${error.message}`)
      if (error.cause) {
        console.error('Cause:', error.cause)
      }
      process.exitCode = 1
      return
    }

    if (error instanceof Error) {
      console.error('[content-migration] Migration failed')
      console.error(error.message)
    } else {
      console.error('[content-migration] Migration failed with unknown error')
      console.error(error)
    }
    process.exitCode = 1
  }
}

function ensureWranglerAvailable(): void {
  const result = spawnSync('npx', ['wrangler', '--version'], {
    stdio: 'ignore'
  })

  if (result.status !== 0) {
    throw new Error(
      'Wrangler CLI is not available. Ensure dependencies are installed and you are authenticated with Cloudflare.'
    )
  }
}

async function prepareSqlForContentSet(
  set: ContentFetchResult,
  statements: string[]
): Promise<MigrationReport> {
  const slugs = set.normalizedProjects.map((project) => project.slug)
  const existingSlugs = await fetchExistingSlugs(set.tableName, slugs)

  let inserted = 0
  let updated = 0
  const seen = new Set<string>()

  for (const project of set.normalizedProjects) {
    if (seen.has(project.slug)) {
      continue
    }
    seen.add(project.slug)

    if (existingSlugs.has(project.slug)) {
      updated += 1
    } else {
      inserted += 1
    }

    statements.push(
      buildUpsertStatement(
        set.tableName,
        project,
        set.extraColumns
      )
    )
  }

  return {
    type: set.type,
    tableName: set.tableName,
    sourceCount: set.sourceCount,
    migratedCount: set.migratedCount,
    inserted,
    updated,
    imageMappings: set.imageMappings
  }
}

async function fetchExistingSlugs(
  tableName: string,
  slugs: string[]
): Promise<Set<string>> {
  if (slugs.length === 0) {
    return new Set()
  }

  const uniqueSlugs = Array.from(new Set(slugs))
  const chunkSize = 100
  const existing = new Set<string>()

  for (let index = 0; index < uniqueSlugs.length; index += chunkSize) {
    const chunk = uniqueSlugs.slice(index, index + chunkSize)
    const slugList = chunk.map((slug) => sqlString(slug)).join(', ')
    const command = `SELECT slug FROM ${tableName} WHERE slug IN (${slugList});`
    const rows = runWranglerQuery(command)

    rows.forEach((row) => {
      const slug = row.slug
      if (typeof slug === 'string') {
        existing.add(slug)
      }
    })
  }

  return existing
}

function runWranglerQuery(sql: string): Array<Record<string, unknown>> {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'labcat_nz', '--remote', '--json', '--command', sql],
    { encoding: 'utf8' }
  )

  if (result.status !== 0) {
    const stderr = typeof result.stderr === 'string'
      ? result.stderr
      : Buffer.isBuffer(result.stderr)
        ? result.stderr.toString()
        : ''
    throw new Error(
      ['Wrangler query failed.', stderr.trim() ? `\n${stderr.trim()}` : ''].join('')
    )
  }

  const output = result.stdout.trim()
  if (!output) {
    return []
  }

  const parsed = JSON.parse(output)

  if (Array.isArray(parsed)) {
    const [firstResult] = parsed
    if (!firstResult?.success) {
      throw new Error('Wrangler query reported failure.')
    }
    return firstResult.results ?? []
  }

  const typed = parsed as {
    success?: boolean
    result?: Array<{ success?: boolean; results?: Array<Record<string, unknown>> }>
  }

  const [firstResult] = typed.result ?? []
  if (!typed.success || !firstResult?.success) {
    throw new Error('Unexpected Wrangler JSON response.')
  }

  return firstResult.results ?? []
}

function buildUpsertStatement(
  tableName: string,
  project: NormalizedContent,
  extraColumns: Array<keyof NormalizedContent>
): string {
  const baseColumns = [
    'slug',
    'status',
    'type',
    'title',
    'featuredImage',
    'featuredImages',
    'created',
    'modified'
  ]

  const baseValues = [
    sqlString(project.slug),
    sqlString(project.status),
    sqlString(project.type),
    sqlString(project.title),
    sqlString(project.featuredImage),
    sqlString(
      project.featuredImages ? JSON.stringify(project.featuredImages) : null
    ),
    sqlString(project.created),
    sqlString(project.modified)
  ]

  const updateAssignments = [
    'status = excluded.status',
    'type = excluded.type',
    'title = excluded.title',
    'featuredImage = excluded.featuredImage',
    'featuredImages = excluded.featuredImages',
    'modified = excluded.modified'
  ]

  for (const column of extraColumns) {
    const columnName = String(column)
    baseColumns.push(columnName)
    baseValues.push(sqlString(project[column]))
    updateAssignments.push(`${columnName} = excluded.${columnName}`)
  }

  return [
    `INSERT INTO ${tableName} (`,
    `  ${baseColumns.join(', ')}`,
    ') VALUES (',
    `  ${baseValues.join(', ')}`,
    ') ON CONFLICT(slug) DO UPDATE SET',
    `  ${updateAssignments.join(',\n  ')};`
  ].join('\n')
}

function sqlString(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return `'${String(value).replace(/'/g, "''")}'`
}

function writeTempSqlFile(sql: string): string {
  const filePath = path.join(
    os.tmpdir(),
    `content-migration-${Date.now()}.sql`
  )
  fs.writeFileSync(filePath, sql, 'utf8')
  return filePath
}

function executeSqlFile(filePath: string): void {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'labcat_nz', '--remote', '--file', filePath],
    { stdio: 'inherit' }
  )

  if (result.status !== 0) {
    throw new Error('Wrangler execution failed.')
  }
}

function logSummary(reports: MigrationReport[]): void {
  console.log('Content Migration Summary')
  console.log('-------------------------')

  let totalInserted = 0
  let totalUpdated = 0

  for (const report of reports) {
    totalInserted += report.inserted
    totalUpdated += report.updated

    console.log(`${report.type} → ${report.tableName}`)
    console.log(`  Source items: ${report.sourceCount}`)
    console.log(`  Migrated items: ${report.migratedCount}`)
    console.log(`  Inserted rows: ${report.inserted}`)
    console.log(`  Updated rows: ${report.updated}`)

    if (report.imageMappings.length > 0) {
      console.log('  Image URL mappings:')
      report.imageMappings.forEach((mapping) => {
        console.log(`    - ${mapping.source} -> ${mapping.target}`)
      })
    } else {
      console.log('  Image URL mappings: none')
    }

    console.log('')
  }

  console.log('Overall totals')
  console.log(`  Inserted rows: ${totalInserted}`)
  console.log(`  Updated rows: ${totalUpdated}`)
}

await main()

