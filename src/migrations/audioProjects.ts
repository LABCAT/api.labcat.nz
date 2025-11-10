import { eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import {
  pages,
  buildingBlocks,
  animations,
  creativeCoding,
  audioProjects
} from '../db/schema'

const R2_BASE_URL = 'https://images.labcat.nz'

const CONTENT_CONFIGS: ContentConfig[] = [
  {
    type: 'pages',
    source:
      'https://mysite.labcat.nz/wp-json/wp/v2/pages?per_page=99&_embed=1',
    tableName: 'pages',
    table: pages,
    r2Folder: 'pages',
    extraColumns: ['reactComponent'],
    mapExtras: (project) => ({
      reactComponent: extractString(
        project.reactComponent ?? (project as Record<string, unknown>).react_component
      )
    })
  },
  {
    type: 'building-blocks',
    source:
      'https://mysite.labcat.nz/wp-json/wp/v2/building-blocks?per_page=99&_embed=1',
    tableName: 'building_blocks',
    table: buildingBlocks,
    r2Folder: 'building-blocks',
    extraColumns: [],
    mapExtras: () => ({})
  },
  {
    type: 'animations',
    source:
      'https://mysite.labcat.nz/wp-json/wp/v2/animations?per_page=99&_embed=1',
    tableName: 'animations',
    table: animations,
    r2Folder: 'animations',
    extraColumns: ['animationLink'],
    mapExtras: (project) => ({
      animationLink:
        extractString(project.animationLink) ??
        extractString((project as Record<string, unknown>).animation_link) ??
        extractString((project as Record<string, unknown>).animationURL)
    })
  },
  {
    type: 'creative-coding',
    source:
      'https://mysite.labcat.nz/wp-json/wp/v2/creative-coding?per_page=99&_embed=1',
    tableName: 'creative_coding',
    table: creativeCoding,
    r2Folder: 'creative-coding',
    extraColumns: ['content'],
    mapExtras: (project) => ({
      content: extractRendered(project.content)
    })
  },
  {
    type: 'audio-projects',
    source:
      'https://mysite.labcat.nz/wp-json/wp/v2/audio-projects?per_page=99&_embed=1',
    tableName: 'audio_projects',
    table: audioProjects,
    r2Folder: 'audio-projects',
    extraColumns: ['content'],
    mapExtras: (project) => ({
      content: extractRendered(project.content)
    })
  }
] as const

export type ContentType = (typeof CONTENT_CONFIGS)[number]['type']

type WordPressBase = {
  slug: string
  status: string
  type: string
  title: { rendered: string }
  content?: { rendered?: string | null } | null
  featuredImage?: string | null
  featured_image?: string | null
  featuredImages?: string[] | null
  featured_images?: string[] | null
  date_gmt?: string | null
  modified_gmt?: string | null
  [key: string]: unknown
}

type NormalizedBase = {
  slug: string
  status: string
  type: string
  title: string
  featuredImage: string | null
  featuredImages: string[] | null
  created: string
  modified: string
}

export type NormalizedContent = NormalizedBase & {
  content?: string | null
  reactComponent?: string | null
  animationLink?: string | null
}

export type ContentFetchResult = {
  type: ContentType
  tableName: string
  normalizedProjects: NormalizedContent[]
  sourceCount: number
  migratedCount: number
  imageMappings: Array<{ source: string; target: string }>
  extraColumns: Array<keyof NormalizedContent>
}

export type MigrationSummary = {
  sourceCount: number
  migratedCount: number
  inserted: number
  updated: number
  imageMappings: Array<{ source: string; target: string }>
}

export type ContentMigrationSummary = {
  type: ContentType
  tableName: string
  summary: MigrationSummary
}

export type MigratedAudioProject = NormalizedContent & { content: string | null }

export type MigrationFetchResult = Omit<
  ContentFetchResult,
  'type' | 'normalizedProjects'
> & {
  type: 'audio-projects'
  normalizedProjects: MigratedAudioProject[]
}

export class MigrationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'MigrationError'
  }
}

export async function fetchAllContent(): Promise<ContentFetchResult[]> {
  const results: ContentFetchResult[] = []

  for (const config of CONTENT_CONFIGS) {
    const result = await fetchNormalizedContent(config)
    results.push(result)
  }

  return results
}

export async function migrateAllContent(
  db: Database
): Promise<ContentMigrationSummary[]> {
  const summaries: ContentMigrationSummary[] = []

  for (const config of CONTENT_CONFIGS) {
    const {
      normalizedProjects,
      imageMappings,
      sourceCount,
      migratedCount
    } = await fetchNormalizedContent(config)

    const { inserted, updated } = await upsertContent(
      db,
      config.table,
      normalizedProjects,
      config.extraColumns
    )

    summaries.push({
      type: config.type,
      tableName: config.tableName,
      summary: {
        sourceCount,
        migratedCount,
        inserted,
        updated,
        imageMappings
      }
    })
  }

  return summaries
}

export async function fetchNormalizedContentSet(
  type: ContentType
): Promise<ContentFetchResult> {
  const config = getConfig(type)
  return fetchNormalizedContent(config)
}

export async function fetchNormalizedAudioProjects(): Promise<MigrationFetchResult> {
  const result = await fetchNormalizedContentSet('audio-projects')
  return {
    type: 'audio-projects',
    tableName: result.tableName,
    normalizedProjects: result.normalizedProjects as MigratedAudioProject[],
    sourceCount: result.sourceCount,
    migratedCount: result.migratedCount,
    imageMappings: result.imageMappings,
    extraColumns: result.extraColumns
  }
}

export async function fetchNormalizedPages(): Promise<ContentFetchResult> {
  return fetchNormalizedContentSet('pages')
}

export async function fetchNormalizedBuildingBlocks(): Promise<ContentFetchResult> {
  return fetchNormalizedContentSet('building-blocks')
}

export async function fetchNormalizedAnimations(): Promise<ContentFetchResult> {
  return fetchNormalizedContentSet('animations')
}

export async function fetchNormalizedCreativeCoding(): Promise<ContentFetchResult> {
  return fetchNormalizedContentSet('creative-coding')
}

async function fetchNormalizedContent(
  config: ContentConfig
): Promise<ContentFetchResult> {
  const response = await fetch(config.source)
  if (!response.ok) {
    throw new MigrationError(
      `Failed to fetch ${config.type}: ${response.status} ${response.statusText}`
    )
  }

  const rawProjects = (await response.json()) as WordPressBase[]
  const normalizedProjects = rawProjects.map<NormalizedContent>((project) => ({
    ...normalizeBase(project, config.r2Folder),
    ...config.mapExtras(project)
  }))

  const imageMappings = createImageMappings(rawProjects, normalizedProjects)

  return {
    type: config.type,
    tableName: config.tableName,
    normalizedProjects,
    sourceCount: rawProjects.length,
    migratedCount: normalizedProjects.length,
    imageMappings,
    extraColumns: config.extraColumns
  }
}

async function upsertContent(
  db: Database,
  table: any,
  projects: NormalizedContent[],
  extraColumns: Array<keyof NormalizedContent>
) {
  let inserted = 0
  let updated = 0

  for (const project of projects) {
    const existing = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.slug, project.slug))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(table)
        .set(buildUpdatePayload(project, extraColumns))
        .where(eq(table.id, existing[0].id))
      updated += 1
    } else {
      await db.insert(table).values(project as any)
      inserted += 1
    }
  }

  return { inserted, updated }
}

function buildUpdatePayload(
  project: NormalizedContent,
  extraColumns: Array<keyof NormalizedContent>
) {
  const basePayload: Record<string, unknown> = {
    status: project.status,
    type: project.type,
    title: project.title,
    featuredImage: project.featuredImage,
    featuredImages: project.featuredImages,
    modified: project.modified
  }

  for (const column of extraColumns) {
    basePayload[column] = project[column]
  }

  return basePayload
}

function normalizeBase(
  project: WordPressBase,
  folder: string
): NormalizedBase {
  return {
    slug: project.slug,
    status: project.status,
    type: project.type,
    title: decodeHtmlEntities(stripHtml(project.title.rendered)),
    featuredImage: convertImageUrl(extractFeaturedImage(project), folder),
    featuredImages: convertImageArray(extractFeaturedImages(project), folder),
    created: project.date_gmt ?? new Date().toISOString(),
    modified: project.modified_gmt ?? new Date().toISOString()
  }
}

function convertImageArray(
  values: string[] | null,
  folder: string
): string[] | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null
  }

  const converted = values
    .map((value) => convertImageUrl(value, folder))
    .filter((value): value is string => Boolean(value))

  return converted.length > 0 ? converted : null
}

export function convertImageUrl(
  value: string | null | undefined,
  folder: string
): string | null {
  if (!value) {
    return null
  }

  if (value.startsWith(`${R2_BASE_URL}/${folder}/`)) {
    return value
  }

  try {
    const url = new URL(value)
    const filename = url.pathname.split('/').pop()
    if (!filename) {
      return null
    }
    return `${R2_BASE_URL}/${folder}/${filename}`
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
  raw: WordPressBase[],
  normalized: NormalizedContent[]
): Array<{ source: string; target: string }> {
  const mappings: Array<{ source: string; target: string }> = []

  normalized.forEach((project, index) => {
    const sourceProject = raw[index]
    if (!sourceProject) {
      return
    }

    const originalFeatured = extractFeaturedImage(sourceProject)
    if (project.featuredImage && originalFeatured) {
      mappings.push({
        source: originalFeatured,
        target: project.featuredImage
      })
    }

    const sourceImages = extractFeaturedImages(sourceProject)
    if (project.featuredImages && sourceImages) {
      for (
        let imageIndex = 0;
        imageIndex < Math.min(sourceImages.length, project.featuredImages.length);
        imageIndex += 1
      ) {
        const sourceImage = sourceImages[imageIndex]
        const targetImage = project.featuredImages[imageIndex]
        if (sourceImage && targetImage) {
          mappings.push({ source: sourceImage, target: targetImage })
        }
      }
    }
  })

  return mappings
}

function extractFeaturedImage(project: WordPressBase): string | null {
  const candidate =
    project.featuredImage ??
    project.featured_image ??
    (project as Record<string, unknown>).featured_media_url

  return typeof candidate === 'string' && candidate.length > 0
    ? candidate
    : null
}

function extractFeaturedImages(project: WordPressBase): string[] | null {
  const candidate =
    project.featuredImages ??
    project.featured_images ??
    (project as Record<string, unknown>).gallery_images

  if (!Array.isArray(candidate) || candidate.length === 0) {
    return null
  }

  return candidate.filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  )
}

function extractRendered(
  content: WordPressBase['content']
): string | null {
  return (content?.rendered ?? null) as string | null
}

function extractString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : null
}

function getConfig(type: ContentType): ContentConfig {
  const config = CONTENT_CONFIGS.find((item) => item.type === type)
  if (!config) {
    throw new Error(`Unknown content type requested: ${type}`)
  }
  return config
}

type ContentConfig = {
  type: ContentType
  source: string
  tableName: string
  table: any
  r2Folder: string
  extraColumns: Array<keyof NormalizedContent>
  mapExtras: (project: WordPressBase) => Partial<NormalizedContent>
}
