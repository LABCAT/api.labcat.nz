# LABCAT API Background Agent Prompts

---

## Setup Database

Act as a backend developer for the LABCAT API project.  
Your task is to set up Cloudflare D1 with Drizzle ORM schemas that fully support the MVP data models (`pages`, `animations`, `building-blocks`, `creative-coding`, and `audio-projects`).  
Ensure the schema reflects all fields as specified, ready to store the migrated content.  
Create a pull request with all schema and setup changes in a new branch.

---

## Migrate Images to R2

Act as a backend developer for the LABCAT API project.  
Your task is to migrate all images currently hosted on the WordPress site to Cloudflare R2 storage.  
Ensure image URLs and references in content will be updated or mapped accordingly for future API usage.  
Create a pull request with all migration scripts and related changes in a new branch.

---

## Migrate Content to D1

Act as a backend developer for the LABCAT API project.  
Your task is to migrate all content from the WordPress REST API into the Cloudflare D1 database using Drizzle ORM.  
Ensure all content fields for `pages`, `animations`, `building-blocks`, `creative-coding`, and `audio-projects` are correctly migrated and linked with image data in R2 where applicable.  
Create a pull request with all migration scripts and data validation code in a new branch.

---

## Implement API Endpoints

Act as a backend developer for the LABCAT API project.  
Your task is to implement the full set of API endpoints: `/pages`, `/animations`, `/building-blocks`, `/creative-coding`, and `/audio-projects`.  
Each endpoint must fetch data from Cloudflare D1 using Drizzle ORM and return JSON responses matching the original WordPress REST API structure and fields.  
Ensure the endpoints are read-only and performant.  
Create a pull request with all endpoint code, route definitions, and any required configuration in a new branch.
