import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Common columns factory to ensure consistent definitions across tables
function commonColumns() {
  return {
    id: integer('id').primaryKey({ autoIncrement: true }),
    created: text('created').notNull().default(sql`CURRENT_TIMESTAMP`),
    modified: text('modified').notNull().default(sql`CURRENT_TIMESTAMP`),
    slug: text('slug').notNull(),
    status: text('status').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    featuredImage: text('featuredImage'),
    // Store JSON array as a string column; Drizzle will type it as string[] when used
    featuredImages: text('featuredImages', { mode: 'json' }).$type<string[] | null>()
  }
}

export const pages = sqliteTable(
  'pages',
  {
    ...commonColumns(),
    reactComponent: text('reactComponent')
  },
  (t) => ({
    slugUnique: uniqueIndex('pages_slug_unique').on(t.slug),
    statusIdx: index('pages_status_idx').on(t.status)
  })
)

export const buildingBlocks = sqliteTable(
  'building_blocks',
  {
    ...commonColumns()
  },
  (t) => ({
    slugUnique: uniqueIndex('building_blocks_slug_unique').on(t.slug),
    statusIdx: index('building_blocks_status_idx').on(t.status)
  })
)

export const animations = sqliteTable(
  'animations',
  {
    ...commonColumns(),
    animationLink: text('animationLink')
  },
  (t) => ({
    slugUnique: uniqueIndex('animations_slug_unique').on(t.slug),
    statusIdx: index('animations_status_idx').on(t.status)
  })
)

export const creativeCoding = sqliteTable(
  'creative_coding',
  {
    ...commonColumns(),
    content: text('content')
  },
  (t) => ({
    slugUnique: uniqueIndex('creative_coding_slug_unique').on(t.slug),
    statusIdx: index('creative_coding_status_idx').on(t.status)
  })
)

export const audioProjects = sqliteTable(
  'audio_projects',
  {
    ...commonColumns(),
    content: text('content')
  },
  (t) => ({
    slugUnique: uniqueIndex('audio_projects_slug_unique').on(t.slug),
    statusIdx: index('audio_projects_status_idx').on(t.status)
  })
)