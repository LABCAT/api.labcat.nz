import { Hono } from 'hono'
import type { Context } from 'hono'
import { asc } from 'drizzle-orm'
import { renderer } from './renderer'
import { getDb } from './db/client'
import {
  pages,
  buildingBlocks,
  animations,
  creativeCoding,
  audioProjects
} from './db/schema'
import type {
  PageRow,
  BuildingBlockRow,
  AnimationRow,
  CreativeCodingRow,
  AudioProjectRow,
  ContentResponse,
  BaseResponse
} from './types/content'

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(renderer)

app.get('/', (c) => {
  return c.render(<h1>Hello!</h1>)
})

app.get('/pages', async (c) => {
  try {
    const db = getDb(c.env.DB)
    const rows = await db.select().from(pages).orderBy(asc(pages.slug))
    const payload = rows.map((row) =>
      formatResponse(row, {
        reactComponent: row.reactComponent ?? null
      })
    )
    return c.json(payload)
  } catch (error) {
    return handleError(c, error, 'pages')
  }
})

app.get('/building-blocks', async (c) => {
  try {
    const db = getDb(c.env.DB)
    const rows = await db
      .select()
      .from(buildingBlocks)
      .orderBy(asc(buildingBlocks.slug))

    return c.json(rows.map((row) => formatResponse(row)))
  } catch (error) {
    return handleError(c, error, 'building blocks')
  }
})

app.get('/animations', async (c) => {
  try {
    const db = getDb(c.env.DB)
    const rows = await db.select().from(animations).orderBy(asc(animations.slug))

    const payload = rows.map((row) =>
      formatResponse(row, {
        animationLink: row.animationLink ?? null
      })
    )

    return c.json(payload)
  } catch (error) {
    return handleError(c, error, 'animations')
  }
})

app.get('/creative-coding', async (c) => {
  try {
    const db = getDb(c.env.DB)
    const rows = await db
      .select()
      .from(creativeCoding)
      .orderBy(asc(creativeCoding.slug))

    const payload = rows.map((row) =>
      formatResponse(row, {
        content: { rendered: row.content ?? null }
      })
    )

    return c.json(payload)
  } catch (error) {
    return handleError(c, error, 'creative coding')
  }
})

app.get('/audio-projects', async (c) => {
  try {
    const db = getDb(c.env.DB)
    const rows = await db
      .select()
      .from(audioProjects)
      .orderBy(asc(audioProjects.slug))

    const payload = rows.map((row) =>
      formatResponse(row, {
        content: { rendered: row.content ?? null }
      })
    )

    return c.json(payload)
  } catch (error) {
    return handleError(c, error, 'audio projects')
  }
})

export default app

/**
 * Shape a DB row into the JSON structure our public API exposes. Keeps the
 * legacy WordPress field names (`title.rendered`, `date_gmt`, etc.) while
 * also returning raw `created`/`modified` for internal use.
 */
const formatResponse = <
  T extends
    | PageRow
    | BuildingBlockRow
    | AnimationRow
    | CreativeCodingRow
    | AudioProjectRow
>(
  row: T,
  extra?: Partial<ContentResponse>
): ContentResponse => {
  const base: BaseResponse = {
    id: row.id,
    slug: row.slug,
    status: row.status,
    type: row.type,
    created: row.created,
    modified: row.modified,
    date_gmt: row.created,
    modified_gmt: row.modified,
    title: { rendered: row.title },
    featuredImage: row.featuredImage ?? null,
    featured_image: row.featuredImage ?? null,
    featuredImages: row.featuredImages ?? [],
    featured_images: row.featuredImages ?? []
  }

  return {
    ...base,
    ...extra
  }
}

/**
 * Shared error handler so every endpoint returns the same structure and status.
 */
const handleError = (c: Context, error: unknown, label: string) => {
  console.error(`[${label}] endpoint failed`, error)
  return c.json(
    {
      error: 'Internal Server Error',
      message: `Unable to load ${label}`
    },
    500
  )
}
