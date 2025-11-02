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

2. **Create local D1 database**
   ```bash
   npx wrangler d1 create labcat-db --local
   ```

3. **Run migrations locally**
   ```bash
   pnpm run db:migrate:dev
   ```

4. **Start development server**
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
   npx wrangler d1 create labcat-db
   ```

3. **Update `wrangler.jsonc`** with the database ID from step 2:
   ```jsonc
   "d1_databases": [{
     "binding": "DB",
     "database_name": "labcat-db", 
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
