/**
 * SQLite 数据库初始化与单例访问
 *
 * Schema 版本：
 *   1 - v0 MVP 初始 schema（channels / agents / messages / tasks / agent_activity / meta 等）
 *   2 - v1.0 Sprint 1 CP1/CP3：新增 projects / agent_runs 表、agent_activity 加 channel_id 列
 *   3 - v1.0 Sprint 2 CP8.3：删除 agents.status 字段（状态从 agent_runs 派生，对齐 D-1）
 *   4 - v1.0 Sprint 2 CP1：新增 workflows / workflow_runs 表（D-16）
 *   5 - v1.0 Sprint 3 CP1：新增 responsibilities 表（D-17）
 *   6 - v1.0 Sprint 4 CP1：新增 decisions / lessons 表（D-20 Knowledge）
 *   7 - v1.0 Sprint 5 CP1：新增 agent_observations / agent_feedback 表（D-20 Evolution Loop）
 *   8 - v1.0 Sprint 6 CP1：新增 project_onboarding / agent_skills 表（D-20 Onboarding + Reuse）
 *   9 - v1.0 Sprint 7 CP1：新增 workflow_sessions 表（D-15 Facilitator）
 *  10 - Sprint 4-ext Phase A：agents 表加 thinking / context 列；reasoning 'xhigh' → 'extra-high'
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

const CURRENT_SCHEMA_VERSION = '10';

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

  // 幂等迁移：对 v0 db（已有 agent_activity 表但缺 channel_id 列）补齐
  migrate(db);

  // 检查 / 记录 schema 版本
  const stmt = db.prepare<[string], { value: string }>('SELECT value FROM meta WHERE key = ?');
  const row = stmt.get('schema_version');
  if (!row) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(
      'schema_version',
      CURRENT_SCHEMA_VERSION,
    );
  } else if (row.value !== CURRENT_SCHEMA_VERSION) {
    db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(
      CURRENT_SCHEMA_VERSION,
      'schema_version',
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

// =============================================================================
// 迁移：幂等检查每个列
// =============================================================================
function migrate(db: DB): void {
  ensureColumn(db, 'agent_activity', 'channel_id', 'TEXT');
  ensureColumn(db, 'channels', 'project_id', 'TEXT');
  ensureColumn(db, 'agents', 'project_id', 'TEXT');
  // CP8.3：从旧 db（v0 / v1.0.0~v1.0.1）删除 agents.status 字段
  // 状态改由 agent_runs 表派生，详见 docs/technical-decisions.md D-1。
  dropColumnIfExists(db, 'agents', 'status');

  // Sprint 4-ext Phase A：补 thinking / context 列（schema v10）
  ensureColumn(db, 'agents', 'thinking', 'INTEGER');
  ensureColumn(db, 'agents', 'context', 'TEXT');

  // Sprint 4-ext：把 cursor-agent CLI 时代的 model 别名规范化到 SDK 兼容 ID。
  // SDK 严格只接受 Cursor.models.list() 返回的 ID，老数据会让 SDK 模式 spawn 全挂；
  // SDK adapter 内部已有 alias fallback 兜底，但 db 里留着旧字符串影响 UI 显示，所以一并改。
  normalizeAgentModelAliases(db);
  // Sprint 4-ext Phase B：reasoning 'xhigh' → 'extra-high'（与 SDK / IDE 命名空间对齐）
  normalizeReasoningAliases(db);
}

function normalizeAgentModelAliases(db: DB): void {
  const aliases: Array<[string, string]> = [
    ['composer-2-fast', 'composer-2'],
    ['composer-2-balanced', 'composer-2'],
    ['auto', 'default'],
  ];
  for (const [from, to] of aliases) {
    db.prepare('UPDATE agents SET model = ? WHERE model = ?').run(to, from);
  }
}

function normalizeReasoningAliases(db: DB): void {
  const aliases: Array<[string, string]> = [
    ['xhigh', 'extra-high'],
  ];
  for (const [from, to] of aliases) {
    db.prepare('UPDATE agents SET reasoning = ? WHERE reasoning = ?').run(to, from);
  }
}

function ensureColumn(db: DB, table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function dropColumnIfExists(db: DB, table: string, column: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}
