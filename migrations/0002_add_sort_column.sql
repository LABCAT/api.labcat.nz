-- Add sort column to all tables
-- Migration: 0002_add_sort_column

-- Pages
ALTER TABLE pages ADD COLUMN sort INTEGER NOT NULL DEFAULT 0;

-- Building Blocks
ALTER TABLE building_blocks ADD COLUMN sort INTEGER NOT NULL DEFAULT 0;

-- Animations
ALTER TABLE animations ADD COLUMN sort INTEGER NOT NULL DEFAULT 0;

-- Creative Coding
ALTER TABLE creative_coding ADD COLUMN sort INTEGER NOT NULL DEFAULT 0;

-- Audio Projects
ALTER TABLE audio_projects ADD COLUMN sort INTEGER NOT NULL DEFAULT 0;

