-- LABCAT initial schema for Cloudflare D1 (SQLite)
-- Tables: pages, building_blocks, animations, creative_coding, audio_projects

PRAGMA foreign_keys = ON;

-- Pages
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  modified TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  featuredImage TEXT,
  featuredImages TEXT,
  reactComponent TEXT
);
CREATE INDEX IF NOT EXISTS pages_status_idx ON pages (status);

CREATE TRIGGER IF NOT EXISTS pages_set_modified
AFTER UPDATE ON pages
BEGIN
  UPDATE pages SET modified = (CURRENT_TIMESTAMP) WHERE id = OLD.id;
END;

-- Building Blocks
CREATE TABLE IF NOT EXISTS building_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  modified TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  featuredImage TEXT,
  featuredImages TEXT
);
CREATE INDEX IF NOT EXISTS building_blocks_status_idx ON building_blocks (status);

CREATE TRIGGER IF NOT EXISTS building_blocks_set_modified
AFTER UPDATE ON building_blocks
BEGIN
  UPDATE building_blocks SET modified = (CURRENT_TIMESTAMP) WHERE id = OLD.id;
END;

-- Animations
CREATE TABLE IF NOT EXISTS animations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  modified TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  featuredImage TEXT,
  featuredImages TEXT,
  animationLink TEXT
);
CREATE INDEX IF NOT EXISTS animations_status_idx ON animations (status);

CREATE TRIGGER IF NOT EXISTS animations_set_modified
AFTER UPDATE ON animations
BEGIN
  UPDATE animations SET modified = (CURRENT_TIMESTAMP) WHERE id = OLD.id;
END;

-- Creative Coding
CREATE TABLE IF NOT EXISTS creative_coding (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  modified TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  featuredImage TEXT,
  featuredImages TEXT,
  content TEXT
);
CREATE INDEX IF NOT EXISTS creative_coding_status_idx ON creative_coding (status);

CREATE TRIGGER IF NOT EXISTS creative_coding_set_modified
AFTER UPDATE ON creative_coding
BEGIN
  UPDATE creative_coding SET modified = (CURRENT_TIMESTAMP) WHERE id = OLD.id;
END;

-- Audio Projects
CREATE TABLE IF NOT EXISTS audio_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  modified TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  featuredImage TEXT,
  featuredImages TEXT,
  content TEXT
);
CREATE INDEX IF NOT EXISTS audio_projects_status_idx ON audio_projects (status);

CREATE TRIGGER IF NOT EXISTS audio_projects_set_modified
AFTER UPDATE ON audio_projects
BEGIN
  UPDATE audio_projects SET modified = (CURRENT_TIMESTAMP) WHERE id = OLD.id;
END;