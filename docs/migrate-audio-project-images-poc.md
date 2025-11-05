# Image Migration Script (Proof of Concept)

This script pulls media references from the WordPress REST API and uploads the files to Cloudflare R2. By default it processes the following endpoints and mirrors each image into the matching folder inside the bucket while keeping the original filename:

| Endpoint | Default R2 folder |
| --- | --- |
| `https://mysite.labcat.nz/wp-json/wp/v2/audio-projects` | `audio-projects/` |
| `https://mysite.labcat.nz/wp-json/wp/v2/animations?per_page=99` | `animations/` |
| `https://mysite.labcat.nz/wp-json/wp/v2/building-blocks?per_page=99` | `building-blocks/` |
| `https://mysite.labcat.nz/wp-json/wp/v2/creative-coding` | `creative-coding/` |
| `https://mysite.labcat.nz/wp-json/wp/v2/pages` | `pages/` |

## Prerequisites

- Node.js 18+ (for built-in `fetch` support).
- A Cloudflare account with an existing R2 bucket.
- API credentials (Access Key ID and Secret Access Key) with write access to the bucket.
- The `wrangler` CLI is **not** required; uploads use the R2 S3-compatible API via `@aws-sdk/client-s3`.

## Configuration Options

| Option | Description |
| --- | --- |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key ID. |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret access key. |
| `R2_ACCOUNT_ID` | Cloudflare account ID (the 32-character identifier). |
| `R2_BUCKET_NAME` | Name of the R2 bucket receiving the uploads. |
| `R2_ENDPOINT` *(optional)* | Custom S3 endpoint URL. Defaults to `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. |
| `R2_PUBLIC_BASE_URL` *(optional)* | Public HTTP base URL for the bucket. Used to generate the mapping output. |
| `R2_<SOURCE>_PREFIX` *(optional)* | Override the target folder for a source, e.g. `R2_ANIMATIONS_PREFIX`. |
| `<SOURCE>_ENDPOINT` *(optional)* | Override the WordPress endpoint for a source, e.g. `CREATIVE_CODING_ENDPOINT`. |
| `sources` *(optional config only)* | Provide a full custom list of sources to replace the defaults entirely.

### Local config file (recommended)

1. Copy `scripts/migrate-audio-project-images.config.example.ts` to `scripts/migrate-audio-project-images.config.ts`.
2. Fill in your Cloudflare R2 credentials and adjust any overrides you need.
3. The real config file is git-ignored so the secrets stay on your machine.

### Using environment variables

The script still falls back to `process.env`. Export values in your shell if you prefer:

```bash
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
export R2_ACCOUNT_ID="..."
export R2_BUCKET_NAME="labcat-media"
export R2_PUBLIC_BASE_URL="https://cdn.example.com"
```

## Running the Migration

Install dependencies (once):

```bash
pnpm install
```

Run the migration script:

```bash
pnpm migrate:audio-project-images
```

### What the Script Does

1. Builds a list of sources and R2 folder prefixes from the config file, environment variables, or defaults.
2. Fetches every record from each source endpoint and collects unique image URLs from the `featuredImage` and `featuredImages` fields.
3. Downloads each image (only once per unique URL) and uploads it to Cloudflare R2 using the configured folder and original filename.
4. Outputs a JSON array mapping each source URL to the new R2 object key (and optional public URL) alongside the source identifier.

Example output:

```json
[
  {
    "source": "audio-projects",
    "sourceUrl": "https://mysite.labcat.nz/media/audio-project/labcat-plunderphonics-vol-1-the-genesis.webp",
    "targetKey": "audio-projects/labcat-plunderphonics-vol-1-the-genesis.webp",
    "r2Url": "https://cdn.example.com/audio-projects/labcat-plunderphonics-vol-1-the-genesis.webp"
  }
]
```

## Verifying the Upload

- Use the Cloudflare dashboard or `aws s3 ls` (with the same credentials) to confirm the objects exist under the expected prefixes.
- Optionally `curl` the `r2Url` value (if `R2_PUBLIC_BASE_URL` is set) to ensure the file is publicly reachable.

## Known Limitations

- Existing R2 objects are overwritten without confirmation.
- No local copy of the mapping is persisted; capture the console output if you need to store it elsewhere.
- Only the `featuredImage` and `featuredImages` fields are scanned. Other embedded media references are ignored for now.

## Next Steps

- Persist the URL mapping for use in API responses and broader content migration.
- Integrate the migration process into automated deployment or worker flows once validated.
