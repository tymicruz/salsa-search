// A small SQLite file (backend/data/cache.db) that remembers slow or paid answers, so repeat searches skip them.
// It stores only: AI answers about venues' own websites / Instagram (keyed by a hash of the exact prompt) and
// Instagram profiles from Apify. No Google content. Deleting the file is always safe: things are just asked again.
// node:sqlite is built into Node 24, so there's no package and no server.
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Schema changes, in order. Never edit one that has run: add a new one at the end.
// The file remembers how many have run (PRAGMA user_version).
const MIGRATIONS = [
  `CREATE TABLE entries (
    key        TEXT PRIMARY KEY, -- e.g. "llm:<sha256>" or "instagram:<handle>"
    value      TEXT NOT NULL,
    created_at INTEGER NOT NULL  -- ms since 1970
  )`,
];

const DAY = 24 * 60 * 60 * 1000;

export function openCache(file: string) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    db.exec(MIGRATIONS[v]);
    db.exec(`PRAGMA user_version = ${v + 1}`);
    db.exec('COMMIT');
  }
  db.prepare('DELETE FROM entries WHERE created_at < ?').run(Date.now() - 30 * DAY); // nothing is kept longer

  const read = db.prepare('SELECT value FROM entries WHERE key = ? AND created_at >= ?');
  const write = db.prepare('INSERT OR REPLACE INTO entries (key, value, created_at) VALUES (?, ?, ?)');
  return {
    // The value saved under key, if it's younger than maxDays.
    get(key: string, maxDays: number): string | undefined {
      const row = read.get(key, Date.now() - maxDays * DAY) as { value: string } | undefined;
      return row?.value;
    },
    set(key: string, value: string) {
      write.run(key, value, Date.now());
    },
  };
}

export type Cache = ReturnType<typeof openCache>;

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
