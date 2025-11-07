#!/usr/bin/env tsx

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import initSqlJs from 'sql.js'
import { drizzle } from 'drizzle-orm/sql-js'
import { eq } from 'drizzle-orm'
import { audioProjects } from '../db/schema'
import {
  fetchNormalizedAudioProjects,
  MigrationError
} from '../migrations/audioProjects'

const require = createRequire(import.meta.url)

type ResultRow = {
  id: number
}

type AggregatedResult = {
  sourceCount: number
  migratedCount: number
  inserted: number
  updated: number
  imageMappings: Array<{ source: string; target: string }>
}

async function main() {
  try {
    const dbPath = resolveDatabasePath()
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(getSqlJsDir(), file)
    })

    const databaseFile = fs.existsSync(dbPath)
      ? new Uint8Array(fs.readFileSync(dbPath))
      : undefined

    const sqlite = databaseFile ? new SQL.Database(databaseFile) : new SQL.Database()
    const db = drizzle(sqlite)

    const fetchResult = await fetchNormalizedAudioProjects()
    const { normalizedProjects, imageMappings, sourceCount, migratedCount } =
      fetchResult

    let inserted = 0
    let updated = 0

    for (const project of normalizedProjects) {
      const existing = (await db
        .select({ id: audioProjects.id })
        .from(audioProjects)
        .where(eq(audioProjects.slug, project.slug))
        .limit(1)) as ResultRow[]

      if (existing.length > 0) {
        await db
          .update(audioProjects)
          .set({
            status: project.status,
            type: project.type,
            title: project.title,
            featuredImage: project.featuredImage,
            featuredImages: project.featuredImages,
            content: project.content
          })
          .where(eq(audioProjects.id, existing[0].id))
        updated += 1
      } else {
        await db.insert(audioProjects).values(project)
        inserted += 1
      }
    }

    const exported = sqlite.export()
    fs.writeFileSync(dbPath, Buffer.from(exported))
    sqlite.close()

    const summary: AggregatedResult = {
      sourceCount,
      migratedCount,
      inserted,
      updated,
      imageMappings
    }

    logSummary(summary, dbPath)
  } catch (error) {
    if (error instanceof MigrationError) {
      console.error(`[audio-projects] ${error.message}`)
      if (error.cause) {
        console.error('Cause:', error.cause)
      }
      process.exitCode = 1
      return
    }

    console.error('[audio-projects] Migration failed')
    console.error(error)
    process.exitCode = 1
  }
}

function resolveDatabasePath(): string {
  const args = process.argv.slice(2)
  const dbArgIndex = args.findIndex((arg) => arg === '--db')

  if (dbArgIndex !== -1) {
    const providedPath = args[dbArgIndex + 1]
    if (!providedPath) {
      throw new Error('Missing value for --db option')
    }
    const resolved = path.resolve(providedPath)
    ensureParentDirectory(resolved)
    return resolved
  }

  const defaultPath = findLocalWranglerDatabase()
  if (!defaultPath) {
    throw new Error(
      [
        'Could not find a local D1 database file.',
        'Run `pnpm run db:migrate:dev` first, or supply a path with `--db /path/to/database.sqlite`.'
      ].join(' ')
    )
  }

  return defaultPath
}

function findLocalWranglerDatabase(): string | undefined {
  const directory = path.resolve(
    '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
  )

  if (!fs.existsSync(directory)) {
    return undefined
  }

  const files = fs.readdirSync(directory)
  const sqliteFile = files.find((file) => file.endsWith('.sqlite'))

  if (!sqliteFile) {
    return undefined
  }

  return path.join(directory, sqliteFile)
}

function ensureParentDirectory(filePath: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getSqlJsDir(): string {
  const packageRoot = path.dirname(require.resolve('sql.js/package.json'))
  return path.join(packageRoot, 'dist')
}

function logSummary(result: AggregatedResult, dbPath: string): void {
  console.log('Audio Projects Migration Summary')
  console.log('--------------------------------')
  console.log(`Database: ${dbPath}`)
  console.log(`Source items: ${result.sourceCount}`)
  console.log(`Migrated items: ${result.migratedCount}`)
  console.log(`Inserted rows: ${result.inserted}`)
  console.log(`Updated rows: ${result.updated}`)
  console.log('')
  console.log('Image URL mappings:')
  result.imageMappings.forEach((mapping) => {
    console.log(`- ${mapping.source} -> ${mapping.target}`)
  })
}

await main()
