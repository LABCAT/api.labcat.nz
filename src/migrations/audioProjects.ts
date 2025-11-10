import { eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { audioProjects } from '../db/schema'

const AUDIO_PROJECTS_SOURCE =
  'https://mysite.labcat.nz/wp-json/wp/v2/audio-projects'
const R2_BASE_URL = 'https://images.labcat.nz'
const AUDIO_PROJECTS_FOLDER = 'audio-projects'

type WordPressAudioProject = {
  slug: string
  status: string
  type: string
  title: { rendered: string }
  content?: { rendered?: string | null }
  featuredImage?: string | null
  featuredImages?: string[] | null
  date_gmt?: string
  modified_gmt?: string
  reactComponent?: string | null
}

export type MigratedAudioProject = {
  slug: string
  status: string
  type: string
  title: string
  featuredImage: string | null
  featuredImages: string[] | null
  content: string | null
  created: string
  modified: string
}

export type MigrationFetchResult = {
  sourceCount: number
  migratedCount: number
  normalizedProjects: MigratedAudioProject[]
  imageMappings: Array<{ source: string; target: string }>
}

export type MigrationSummary = {
  sourceCount: number
  migratedCount: number
  inserted: number
  updated: number
  imageMappings: Array<{ source: string; target: string }>
}

export class MigrationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'MigrationError'
  }
}

export async function fetchNormalizedAudioProjects(): Promise<MigrationFetchResult> {
  const response = await fetch(AUDIO_PROJECTS_SOURCE)
  if (!response.ok) {
    throw new MigrationError(
      `Failed to fetch audio projects: ${response.status} ${response.statusText}`
    )
  }

  const rawProjects = (await response.json()) as WordPressAudioProject[]
  const normalized = rawProjects.map(normalizeAudioProject)
  const imageMappings = createImageMappings(rawProjects, normalized)

  return {
    sourceCount: rawProjects.length,
    migratedCount: normalized.length,
    normalizedProjects: normalized,
    imageMappings
  }
}

export async function migrateAudioProjects(db: Database): Promise<MigrationSummary> {
  const {
    normalizedProjects,
    imageMappings,
    sourceCount,
    migratedCount
  } = await fetchNormalizedAudioProjects()

  let inserted = 0
  let updated = 0

  for (const project of normalizedProjects) {
    const existingRecord = await db
      .select({ id: audioProjects.id })
      .from(audioProjects)
      .where(eq(audioProjects.slug, project.slug))
      .limit(1)

    if (existingRecord.length > 0) {
      await db
        .update(audioProjects)
        .set({
          status: project.status,
          type: project.type,
          title: project.title,
          featuredImage: project.featuredImage,
          featuredImages: project.featuredImages,
          content: project.content,
          modified: project.modified
        })
        .where(eq(audioProjects.id, existingRecord[0].id))
      updated += 1
    } else {
      await db.insert(audioProjects).values(project)
      inserted += 1
    }
  }

  return {
    sourceCount,
    migratedCount,
    inserted,
    updated,
    imageMappings
  }
}

function normalizeAudioProject(
  project: WordPressAudioProject
): MigratedAudioProject {
  return {
    slug: project.slug,
    status: project.status,
    type: project.type,
    title: decodeHtmlEntities(stripHtml(project.title.rendered)),
    featuredImage: convertImageUrl(project.featuredImage),
    featuredImages: convertImageArray(project.featuredImages),
    content: project.content?.rendered ?? null,
    created: project.date_gmt ?? new Date().toISOString(),
    modified: project.modified_gmt ?? new Date().toISOString()
  }
}

function convertImageArray(values?: string[] | null): string[] | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null
  }

  const converted = values
    .map((value) => convertImageUrl(value))
    .filter((value): value is string => Boolean(value))

  return converted.length > 0 ? converted : null
}

export function convertImageUrl(value?: string | null): string | null {
  if (!value) {
    return null
  }

  if (value.startsWith(`${R2_BASE_URL}/${AUDIO_PROJECTS_FOLDER}/`)) {
    return value
  }

  try {
    const url = new URL(value)
    const filename = url.pathname.split('/').pop()
    if (!filename) {
      return null
    }
    return `${R2_BASE_URL}/${AUDIO_PROJECTS_FOLDER}/${filename}`
  } catch {
    return null
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '')
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()
}

function createImageMappings(
  raw: WordPressAudioProject[],
  normalized: MigratedAudioProject[]
): Array<{ source: string; target: string }> {
  const mappings: Array<{ source: string; target: string }> = []

  normalized.forEach((project, index) => {
    const sourceProject = raw[index]
    if (!sourceProject) {
      return
    }

    if (project.featuredImage && sourceProject.featuredImage) {
      mappings.push({
        source: sourceProject.featuredImage,
        target: project.featuredImage
      })
    }

    if (
      project.featuredImages &&
      Array.isArray(sourceProject.featuredImages) &&
      sourceProject.featuredImages.length > 0
    ) {
      for (let i = 0; i < project.featuredImages.length; i += 1) {
        const targetImage = project.featuredImages[i]
        const sourceImage = sourceProject.featuredImages[i]
        if (targetImage && sourceImage) {
          mappings.push({ source: sourceImage, target: targetImage })
        }
      }
    }
  })

  return mappings
}
