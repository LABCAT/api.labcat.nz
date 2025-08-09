# Migrate Content to Cloudflare D1

## Objective
Migrate content data from the WordPress REST API to Cloudflare D1 database via Drizzle ORM, updating image URLs to point to Cloudflare R2.

## Source Endpoints
- `https://mysite.labcat.nz/wp-json/wp/v2/pages`
- `https://mysite.labcat.nz/wp-json/wp/v2/animations?per_page=99`
- `https://mysite.labcat.nz/wp-json/wp/v2/building-blocks?per_page=99`
- `https://mysite.labcat.nz/wp-json/wp/v2/creative-coding`
- `https://mysite.labcat.nz/wp-json/wp/v2/audio-projects`

## Requirements
- Extract all content for entities: Pages, Animations, Building Blocks, Creative Coding, Audio Projects from the endpoints above.
- Map all fields accurately according to the database schema.
- In all content, update any image URLs found in the `featuredImage` and `featuredImages` fields to point to the corresponding Cloudflare R2 location using the folder structure below:

  | Content Type     | R2 Folder Name    |
  |------------------|-------------------|
  | pages            | `pages`           |
  | building-blocks   | `building-blocks` |
  | animations       | `animations`      |
  | creative-coding  | `creative-coding` *(no trailing s)* |
  | audio-projects   | `audio-projects`   |

- Ensure filenames in R2 match the original image filenames.
- Maintain referential integrity so all content properly links to the migrated images.
- Create automated migration scripts to perform data import and URL replacement.
- Validate data integrity after migration.

## Acceptance Criteria
- All content successfully inserted into D1 with image URLs updated correctly.
- Migration scripts complete without errors.
- Content correctly linked to images stored in R2 with the specified folder structure.
