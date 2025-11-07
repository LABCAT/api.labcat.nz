import { Hono } from 'hono'
import { renderer } from './renderer'
import { getDb } from './db/client'
import { migrateAudioProjects, MigrationError } from './migrations/audioProjects'

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(renderer)

app.get('/', (c) => {
  return c.render(<h1>Hello!</h1>)
})

app.post('/admin/migrate/audio-projects/poc', async (c) => {
  const token = c.req.header('x-labcat-migration-token')
  const expectedToken = c.env.LABCAT_MIGRATION_TOKEN

  if (expectedToken && token !== expectedToken) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const db = getDb(c.env.DB)
    const summary = await migrateAudioProjects(db)
    return c.json({ status: 'ok', summary })
  } catch (error) {
    const message =
      error instanceof MigrationError ? error.message : 'Migration failed'

    return c.json(
      {
        status: 'error',
        message,
        details:
          error instanceof MigrationError && error.cause
            ? String(error.cause)
            : undefined
      },
      500
    )
  }
})

export default app
