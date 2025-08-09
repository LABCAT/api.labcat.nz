import { Hono } from 'hono'
import { renderer } from './renderer'
import { getDb } from './db/client'

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(renderer)

app.get('/health/db', async (c) => {
  try {
    const db = getDb(c.env.DB)
    // simple pragma to test connectivity
    await db.run("PRAGMA user_version;")
    return c.json({ ok: true })
  } catch (error) {
    return c.json({ ok: false, error: String(error) }, 500)
  }
})

app.get('/', (c) => {
  return c.render(<h1>Hello!</h1>)
})

export default app
