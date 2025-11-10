# Audio Projects Migration POC

This proof of concept fetches published audio projects from the legacy WordPress REST API, remaps their featured image URLs to the Cloudflare R2 bucket, and writes the transformed records into the Cloudflare D1 `audio_projects` table via Drizzle ORM.

- **Source endpoint:** `https://mysite.labcat.nz/wp-json/wp/v2/audio-projects`
- **R2 target folder:** `audio-projects/` on `https://image.labcat.nz`
- **Runtime:** production migration script (`pnpm run migrate:audio-projects`)

The script performs an idempotent upsert by slug. On first run it inserts all records; subsequent runs update any changed fields and refresh the R2 image URLs. The console output summarises how many records were inserted or updated and lists the source → target image URL mappings.

## Prerequisites

1. Install dependencies
   ```bash
   pnpm install
   ```

2. Authenticate Wrangler with the production Cloudflare account
   ```bash
   npx wrangler login
   ```

3. Confirm the D1 binding points to production
   ```bash
   npx wrangler d1 execute labcat_nz --remote --command "SELECT 1;"
   ```

## Running the migration

1. **Run the migration (targets production D1)**
   ```bash
   pnpm run migrate:audio-projects
   ```
   The script calls `wrangler d1 execute labcat_nz --remote` under the hood. No additional flags are required for production.

2. **Verify the data (optional)**
   ```bash
   npx wrangler d1 execute labcat_nz --remote \
     --command "SELECT slug, modified FROM audio_projects ORDER BY modified DESC LIMIT 5;"
   ```

## Expected output

Successful execution returns:

```json
Audio Projects Migration Summary
--------------------------------
Target database: production (remote)
Source items: 3
Migrated items: 3
Inserted rows: 3
Updated rows: 0

Image URL mappings:
- https://mysite.labcat.nz/media/audio-project/labcat-plunderphonics-vol-2-metamorphosis.webp -> https://image.labcat.nz/audio-projects/labcat-plunderphonics-vol-2-metamorphosis.webp
// ...remaining mappings
```

Re-running the migration when the records already exist reports `updated` counts instead of `inserted`.

## Next steps

- Extend the migration to handle additional content types (pages, animations, building blocks, creative coding).
- Extend image replacement to inline media within the `content` field.
- Integrate with automated workflows (Workers CRON or CI scripts) once the approach is accepted.
