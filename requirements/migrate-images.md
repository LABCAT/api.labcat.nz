# Migrate Images to Cloudflare R2

## Objective
Migrate all images from the existing WordPress site to Cloudflare R2 storage with organized folder structure.

## Source Locations
- Images referenced in content fetched from these WordPress REST API endpoints:
  - `https://mysite.labcat.nz/wp-json/wp/v2/pages`
  - `https://mysite.labcat.nz/wp-json/wp/v2/animations?per_page=99`
  - `https://mysite.labcat.nz/wp-json/wp/v2/building-blocks?per_page=99`
  - `https://mysite.labcat.nz/wp-json/wp/v2/creative-coding`
  - `https://mysite.labcat.nz/wp-json/wp/v2/audio-projects`

## Fields Containing Image URLs
- `featuredImage` (single image URL)
- `featuredImages` (array of image URLs)

## Requirements
- Extract all image files referenced in the `featuredImage` and `featuredImages` fields from the endpoints above.
- Upload images to Cloudflare R2 bucket using the following folder structure:
  - Images from `audio-projects` endpoint → store under `audio-projects/` folder in R2.
  - Images from `pages` endpoint → store under `pages/` folder.
  - Images from `building-blocks` endpoint → store under `building-blocks/` folder.
  - Images from `animations` endpoint → store under `animations/` folder.
  - Images from `creative-coding` endpoint → store under `creative-coding/` folder (note: no trailing “s”).
- The image filename in R2 should be the original filename extracted from the URL, for example:
  - URL:  
    `https://mysite.labcat.nz/media/audio-project/labcat-plunderphonics-vol-1-the-genesis.webp`  
  - Stored as:  
    `audio-projects/labcat-plunderphonics-vol-1-the-genesis.webp`
- Maintain or create a mapping of original URLs to new R2 URLs for use in content migration and API responses.
- Prepare migration scripts for automation and repeatability.
- Update any references or metadata as needed for future API use.

## Acceptance Criteria
- All images successfully uploaded to R2 with correct folder structure and filenames.
- Migration scripts runnable without errors.
- Mapping data available and accurate for linking images with content.
