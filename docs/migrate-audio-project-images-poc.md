# Audio Project Image Migration (Proof of Concept)

This proof of concept migrates the three audio project images exposed by the WordPress endpoint at `https://mysite.labcat.nz/wp-json/wp/v2/audio-projects` into Cloudflare R2. Each image is uploaded into the `audio-project/` folder in the target bucket using its original filename.

## Prerequisites

- Node.js 18+ (for built-in `fetch` support).
- A Cloudflare account with an existing R2 bucket.
- API credentials (Access Key ID and Secret Access Key) with write access to the bucket.
- The `wrangler` CLI is **not** required for this script; uploads use R2's S3-compatible API via `@aws-sdk/client-s3`.

## Environment Variables

| Variable | Description |
| --- | --- |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key ID. |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret access key. |
| `R2_ACCOUNT_ID` | Cloudflare account ID (the 32-character identifier). |
| `R2_BUCKET_NAME` | Name of the R2 bucket receiving the uploads. |
| `R2_ENDPOINT` *(optional)* | Custom S3 endpoint URL. Defaults to `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. |
| `R2_PUBLIC_BASE_URL` *(optional)* | Public HTTP base URL for the bucket. Used to generate the mapping output. |
| `R2_AUDIO_PROJECT_PREFIX` *(optional)* | Folder prefix within the bucket. Defaults to `audio-project`. |
| `AUDIO_PROJECTS_ENDPOINT` *(optional)* | Source WordPress endpoint. Defaults to the production URL above. |

### Local config file (recommended)

1. Copy `scripts/migrate-audio-project-images.config.example.ts` to `scripts/migrate-audio-project-images.config.ts`.
2. Fill in your Cloudflare R2 credentials and any optional overrides.
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

1. Fetches all audio projects from the WordPress REST endpoint.
2. Collects unique image URLs from the `featuredImage` and `featuredImages` fields.
3. Downloads each image.
4. Uploads each image to Cloudflare R2 at `audio-project/<original-filename>`.
5. Outputs a JSON array mapping each source URL to its new R2 object key (and optional public URL).

Example output:

```json
[
  {
    "sourceUrl": "https://mysite.labcat.nz/media/audio-project/labcat-plunderphonics-vol-1-the-genesis.webp",
    "targetKey": "audio-project/labcat-plunderphonics-vol-1-the-genesis.webp",
    "r2Url": "https://cdn.example.com/audio-project/labcat-plunderphonics-vol-1-the-genesis.webp"
  }
]
```

## Verifying the Upload

- Use the Cloudflare dashboard or `aws s3 ls` (with the same credentials) to confirm the objects exist under `audio-project/`.
- Optionally `curl` the `r2Url` value (if `R2_PUBLIC_BASE_URL` is set) to ensure the file is publicly reachable.

## Known Limitations

- This script only migrates imagery referenced by the audio projects endpoint. Additional endpoints and fields will be handled in subsequent tasks.
- Existing R2 objects are overwritten without confirmation.
- No local copy of the mapping is persisted; capture the console output if you need to store it.

## Next Steps

- Expand the migration to other content types (`pages`, `animations`, `building-blocks`, `creative-coding`).
- Persist the URL mapping for use in API responses and content migration.
- Integrate the migration process into deployment workflows or workers once validated.
