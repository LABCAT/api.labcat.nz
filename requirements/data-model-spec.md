# LABCAT API Data Model Specification

This document defines the database schema for the LABCAT API MVP using Cloudflare D1 and Drizzle ORM.

---

## Common Fields (All Entities)

| Field          | Type         | Notes                          |
|----------------|--------------|--------------------------------|
| id             | Integer      | Primary key, auto-increment    |
| created        | DateTime     | Creation timestamp             |
| modified       | DateTime     | Last modification timestamp    |
| slug           | String       | URL-friendly unique identifier |
| status         | String       | e.g. 'published', 'draft'      |
| type           | String       | Content type                   |
| title          | String       | Title of the item              |
| featuredImage  | String       | URL or reference to main image |
| featuredImages | JSON Array   | Array of image URLs            |

---

## Entity: Pages

| Field          | Type         | Notes                          |
|----------------|--------------|--------------------------------|
| reactComponent | String       | Optional React component name  |

---

## Entity: Building Blocks

Same as Pages **without** `reactComponent`.

---

## Entity: Animations

Same as Pages **without** `reactComponent`, plus:

| Field          | Type         | Notes                          |
|----------------|--------------|--------------------------------|
| animationLink  | String       | URL or identifier for animation|

---

## Entities: Creative Coding, Audio Projects

Same as Pages **without** `reactComponent`, plus:

| Field          | Type         | Notes                          |
|----------------|--------------|--------------------------------|
| content        | Text         | Rich text or HTML content      |

---

## Notes

- `featuredImage` and `featuredImages` store image URLs pointing to Cloudflare R2 locations after migration.  
- Date/time fields use ISO 8601 format.  
- Status field supports values like `'published'`, `'draft'`, etc., as used in the original CMS.  
- JSON Array for `featuredImages` should be stored as a stringified JSON array or using JSON column type if supported.

---

This spec should be used to define Drizzle ORM schemas and database migrations for the MVP.
