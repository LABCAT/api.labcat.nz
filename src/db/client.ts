import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1'

export type Database = DrizzleD1Database

export function getDb(DB: D1Database): Database {
  return drizzle(DB)
}