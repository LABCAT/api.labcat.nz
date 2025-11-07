# Audio Projects Migration POC

This proof of concept fetches published audio projects from the legacy WordPress REST API, remaps their featured image URLs to the Cloudflare R2 bucket, and writes the transformed records into the Cloudflare D1 `audio_projects` table via Drizzle ORM.

- **Source endpoint:** `https://mysite.labcat.nz/wp-json/wp/v2/audio-projects`
- **R2 target folder:** `audio-projects/` on `https://image.labcat.nz`
- **Worker route:** `POST /admin/migrate/audio-projects/poc`

The route performs an idempotent upsert by slug. On first run it inserts all records; subsequent runs update any changed fields and refresh the R2 image URLs. The response summarises how many records were inserted or updated and lists the source → target image URL mappings.

## Prerequisites

- Local D1 database has been created and migrations applied (`pnpm run db:migrate:dev`)
- `wrangler` is authenticated if you plan to run against remote infrastructure

Optional but recommended for production:

```bash
wrangler secret put LABCAT_MIGRATION_TOKEN
```

Store a shared token and present it with the `x-labcat-migration-token` header when calling the route.

## Running the migration locally

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Apply database migrations**
   ```bash
   pnpm run db:migrate:dev
   ```

3. **Start the Pages dev server with a local D1 binding**
   ```bash
   pnpm run preview
   ```
   The worker listens on `http://localhost:8788` by default.

4. **Trigger the migration**
   ```bash
   curl -X POST \
     http://localhost:8788/admin/migrate/audio-projects/poc
   ```
   Add the `x-labcat-migration-token` header if the token secret is configured.

5. **Verify the data (optional)**
   ```bash
   npx wrangler d1 execute labcat_nz --local \
     --command "SELECT slug, featuredImage FROM audio_projects;"
   ```

## Expected output

Successful execution returns:

```json
{
  "status": "ok",
  "summary": {
    "sourceCount": 3,
    "migratedCount": 3,
    "inserted": 3,
    "updated": 0,
    "imageMappings": [
      {
        "source": "https://mysite.labcat.nz/media/audio-project/labcat-plunderphonics-vol-2-metamorphosis.webp",
        "target": "https://image.labcat.nz/audio-projects/labcat-plunderphonics-vol-2-metamorphosis.webp"
      }
      // ...remaining mappings
    ]
  }
}
```

Re-running the migration when the records already exist reports `updated` counts instead of `inserted`.

## Next steps

- Extend the migration to handle additional content types (pages, animations, building blocks, creative coding).
- Normalise additional media fields inside `content` once the proof of concept is validated.
- Integrate with automated workflows (Workers CRON or CI scripts) once the approach is accepted.
