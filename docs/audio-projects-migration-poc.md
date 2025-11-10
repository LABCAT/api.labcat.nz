# Content Migration POC

This proof of concept migrates published content from the legacy WordPress REST API into the Cloudflare D1 tables defined for the LABCAT API. It now covers all primary content entities and rewrites feature image URLs so that they point to the Cloudflare R2 bucket.

- **Source endpoints:**
  - Pages — `https://mysite.labcat.nz/wp-json/wp/v2/pages?per_page=99&_embed=1`
  - Building Blocks — `https://mysite.labcat.nz/wp-json/wp/v2/building-blocks?per_page=99&_embed=1`
  - Animations — `https://mysite.labcat.nz/wp-json/wp/v2/animations?per_page=99&_embed=1`
  - Creative Coding — `https://mysite.labcat.nz/wp-json/wp/v2/creative-coding?per_page=99&_embed=1`
  - Audio Projects — `https://mysite.labcat.nz/wp-json/wp/v2/audio-projects?per_page=99&_embed=1`
- **R2 folder mapping:** pages → `pages/`, building blocks → `building-blocks/`, animations → `animations/`, creative coding → `creative-coding/`, audio projects → `audio-projects/`
- **Runtime:** production migration script (`pnpm run migrate:content`)

Each run performs an idempotent upsert by slug. First-time runs insert all records; subsequent runs update any changed fields (including the `modified` timestamp) and refresh the R2 image URLs. The console output summarises per-entity insert/update counts and lists the source → target image URL mappings.

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
   pnpm run migrate:content
   ```
   The script calls `wrangler d1 execute labcat_nz --remote` under the hood. No additional flags are required for production. (An alias `pnpm run migrate:audio-projects` is retained for compatibility.)

2. **Verify the data (optional)**
   ```bash
   npx wrangler d1 execute labcat_nz --remote \
     --command "SELECT slug, modified FROM audio_projects ORDER BY modified DESC LIMIT 5;"
   ```
   Repeat for other tables (`pages`, `building_blocks`, `animations`, `creative_coding`) as needed.

## Expected output

Successful execution returns:

```
Content Migration Summary
-------------------------
pages → pages
  Source items: 12
  Migrated items: 12
  Inserted rows: 12
  Updated rows: 0
  Image URL mappings:
    - https://mysite.labcat.nz/media/pages/homepage.webp -> https://images.labcat.nz/pages/homepage.webp

building-blocks → building_blocks
  Source items: 24
  Migrated items: 24
  Inserted rows: 24
  Updated rows: 0
  Image URL mappings: none

animations → animations
  Source items: 5
  Migrated items: 5
  Inserted rows: 3
  Updated rows: 2
  Image URL mappings:
    - ...

creative-coding → creative_coding
  Source items: 7
  Migrated items: 7
  Inserted rows: 7
  Updated rows: 0
  Image URL mappings:
    - ...

audio-projects → audio_projects
  Source items: 3
  Migrated items: 3
  Inserted rows: 1
  Updated rows: 2
  Image URL mappings:
    - ...

Overall totals
  Inserted rows: 47
  Updated rows: 4
```

Re-running the migration when the records already exist reports `updated` counts instead of `inserted`.

## Next steps

- Extend image replacement to inline media within the `content` field.
- Integrate with automated workflows (Workers CRON or CI scripts) once the approach is accepted.
