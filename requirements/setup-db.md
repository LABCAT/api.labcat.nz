# Setup Database

## Objective
Set up Cloudflare D1 with Drizzle ORM schemas to support the LABCAT API MVP data models.

## Requirements
- Create tables representing the following entities with all specified fields:
  - Pages
  - Building Blocks
  - Animations
  - Creative Coding
  - Audio Projects
- Ensure fields and types match those described in project specs.
- Prepare the database schema to allow smooth content migration later.
- Include any necessary indexes or constraints for performance and data integrity.

## Acceptance Criteria
- Cloudflare D1 database schema fully created using Drizzle ORM migrations.
- No errors in setup scripts.
- Ready for immediate content insertion.
