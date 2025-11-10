#!/usr/bin/env tsx

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import {
  fetchNormalizedAudioProjects,
  MigrationError,
  type MigratedAudioProject
} from '../migrations/audioProjects'

type WranglerQuerySuccess = {
  success: true
  result: Array<{
    success: true
    results?: Array<Record<string, unknown>>
  }>
}

async function main() {
  try {
    ensureWranglerAvailable()

    const {
      normalizedProjects,
      imageMappings,
      sourceCount,
      migratedCount
    } = await fetchNormalizedAudioProjects()

    if (normalizedProjects.length === 0) {
      console.log('No audio projects returned from WordPress. Nothing to migrate.')
      return
    }

    const existingSlugs = await fetchExistingSlugs(
      normalizedProjects.map((project) => project.slug)
    )

    const inserted = normalizedProjects.reduce((count, project) => {
      return existingSlugs.has(project.slug) ? count : count + 1
    }, 0)
    const updated = normalizedProjects.length - inserted

    const sql = normalizedProjects
      .map((project) => buildUpsertStatement(project))
      .join('\n\n')

    const sqlFilePath = writeTempSqlFile(sql)
    try {
      executeSqlFile(sqlFilePath)
    } finally {
      fs.rmSync(sqlFilePath, { force: true })
    }

    logSummary({
      sourceCount,
      migratedCount,
      inserted,
      updated,
      imageMappings
    })
  } catch (error) {
    if (error instanceof MigrationError) {
      console.error(`[audio-projects] ${error.message}`)
      if (error.cause) {
        console.error('Cause:', error.cause)
      }
      process.exitCode = 1
      return
    }

    if (error instanceof Error) {
      console.error('[audio-projects] Migration failed')
      console.error(error.message)
    } else {
      console.error('[audio-projects] Migration failed with unknown error')
      console.error(error)
    }
    process.exitCode = 1
  }
}

function ensureWranglerAvailable(): void {
  const result = spawnSync('pnpm', ['exec', 'wrangler', '--version'], {
    stdio: 'ignore'
  })

  if (result.status !== 0) {
    throw new Error(
      'Wrangler CLI is not available. Ensure dependencies are installed and you are authenticated with Cloudflare.'
    )
  }
}

async function fetchExistingSlugs(slugs: string[]): Promise<Set<string>> {
  if (slugs.length === 0) {
    return new Set()
  }

  const uniqueSlugs = Array.from(new Set(slugs))
  const chunkSize = 100
  const existing = new Set<string>()

  for (let index = 0; index < uniqueSlugs.length; index += chunkSize) {
    const chunk = uniqueSlugs.slice(index, index + chunkSize)
    const slugList = chunk.map((slug) => sqlString(slug)).join(', ')
    const command = `SELECT slug FROM audio_projects WHERE slug IN (${slugList});`
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
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      'labcat_nz',
      '--remote',
      '--json',
      '--command',
      sql
    ],
    {
      encoding: 'utf8'
    }
  )

  if (result.status !== 0) {
    throw new Error(
      [
        'Wrangler query failed.',
        result.stderr?.trim() ? `\n${result.stderr.trim()}` : ''
      ].join('')
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

  const typed = parsed as WranglerQuerySuccess
  const [firstResult] = typed.result ?? []

  if (!typed.success || !firstResult?.success) {
    throw new Error('Unexpected Wrangler JSON response.')
  }

  return firstResult.results ?? []
}

function buildUpsertStatement(project: MigratedAudioProject): string {
  const featuredImages = project.featuredImages
    ? JSON.stringify(project.featuredImages)
    : null

  return [
    'INSERT INTO audio_projects (',
    '  slug, status, type, title, featuredImage, featuredImages, content, created, modified',
    ') VALUES (',
    [
      sqlString(project.slug),
      sqlString(project.status),
      sqlString(project.type),
      sqlString(project.title),
      sqlString(project.featuredImage),
      sqlString(featuredImages),
      sqlString(project.content),
      sqlString(project.created),
      sqlString(project.modified)
    ].join(', '),
    ') ON CONFLICT(slug) DO UPDATE SET',
    '  status = excluded.status,',
    '  type = excluded.type,',
    '  title = excluded.title,',
    '  featuredImage = excluded.featuredImage,',
    '  featuredImages = excluded.featuredImages,',
    '  content = excluded.content,',
    '  modified = excluded.modified;'
  ].join('\n')
}

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  return `'${value.replace(/'/g, "''")}'`
}

function writeTempSqlFile(sql: string): string {
  const filePath = path.join(
    os.tmpdir(),
    `audio-projects-migration-${Date.now()}.sql`
  )
  fs.writeFileSync(filePath, sql, 'utf8')
  return filePath
}

function executeSqlFile(filePath: string): void {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      'labcat_nz',
      '--remote',
      '--file',
      filePath
    ],
    { stdio: 'inherit' }
  )

  if (result.status !== 0) {
    throw new Error('Wrangler execution failed.')
  }
}

type Summary = {
  sourceCount: number
  migratedCount: number
  inserted: number
  updated: number
  imageMappings: Array<{ source: string; target: string }>
}

function logSummary(summary: Summary): void {
  console.log('Audio Projects Migration Summary')
  console.log('--------------------------------')
  console.log('Target database: production (remote)')
  console.log(`Source items: ${summary.sourceCount}`)
  console.log(`Migrated items: ${summary.migratedCount}`)
  console.log(`Inserted rows: ${summary.inserted}`)
  console.log(`Updated rows: ${summary.updated}`)
  console.log('')
  console.log('Image URL mappings:')
  summary.imageMappings.forEach((mapping) => {
    console.log(`- ${mapping.source} -> ${mapping.target}`)
  })
}

await main()

