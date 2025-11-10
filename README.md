# Hono + Drizzle + Cloudflare D1 API

## Prerequisites

- Node.js 24+ (LTS)
- pnpm
- Cloudflare account

## Local Development Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Run migrations locally** (creates local DB automatically)
   ```bash
   pnpm run db:migrate:dev
   ```

3. **Start development server**
   ```bash
   pnpm run dev
   ```

## Cloudflare Production Setup

1. **Login to Cloudflare**
   ```bash
   npx wrangler login
   ```

2. **Create production D1 database**
   ```bash
   npx wrangler d1 create labcat_nz
   ```

3. **Update `wrangler.jsonc`** with the database ID from step 2:
   ```jsonc
   "d1_databases": [{
     "binding": "DB",
     "database_name": "labcat_nz", 
     "database_id": "YOUR_DATABASE_ID_HERE"
   }]
   ```

4. **Run production migrations**
   ```bash
   pnpm run db:migrate:prod
   ```

5. **Deploy to Cloudflare Pages**
   ```bash
   pnpm run deploy
   ```

## Database Management

- **Generate new migration**: `pnpm run drizzle:gen`
- **Check migration**: `pnpm run drizzle:check`
- **Apply local migrations**: `pnpm run db:migrate:dev`
- **Apply production migrations**: `pnpm run db:migrate:prod`

## Database Inspection

**List all tables (local):**
```bash
npx wrangler d1 execute labcat_nz --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**List all tables (production):**
```bash
npx wrangler d1 execute labcat_nz --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**View table structure:**
```bash
# Local
npx wrangler d1 execute labcat_nz --local --command="PRAGMA table_info(pages);"

# Production
npx wrangler d1 execute labcat_nz --remote --command="PRAGMA table_info(pages);"
```

**Run custom SQL queries:**
```bash
# Local
npx wrangler d1 execute labcat_nz --local --command="SELECT * FROM pages LIMIT 5;"

# Production
npx wrangler d1 execute labcat_nz --remote --command="SELECT * FROM pages LIMIT 5;"
```

## Migration Proof of Concepts

- [Audio Projects Migration POC](docs/audio-projects-migration-poc.md) — Fetches audio projects from WordPress, rewrites featured image URLs to the Cloudflare R2 bucket, and upserts the results into the production D1 database via Wrangler.
