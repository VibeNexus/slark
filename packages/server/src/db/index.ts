/**
 * SQLite 数据库初始化与单例访问
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';
import { config, dbPath } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// dev（tsx）下直接在 src 目录；build 后 schema.sql 会复制到 dist/db/
const SCHEMA_CANDIDATES = [
  resolve(__dirname, 'schema.sql'),
  resolve(__dirname, '../../src/db/schema.sql'),
];
const SCHEMA_PATH = SCHEMA_CANDIDATES.find((p) => existsSync(p));

const CURRENT_SCHEMA_VERSION = '1';

let _db: DB | null = null;

export function getDb(): DB {
  if (_db) return _db;

  mkdirSync(config.slarkHome, { recursive: true });

  const db = new Database(dbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  if (!SCHEMA_PATH) {
    throw new Error(
      `schema.sql not found. Checked: ${SCHEMA_CANDIDATES.join(', ')}`,
    );
  }
  const schemaSql = readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schemaSql);

  // 检查 / 记录 schema 版本
  const stmt = db.prepare<[string], { value: string }>('SELECT value FROM meta WHERE key = ?');
  const row = stmt.get('schema_version');
  if (!row) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(
      'schema_version',
      CURRENT_SCHEMA_VERSION,
    );
  }

  _db = db;
  return db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
