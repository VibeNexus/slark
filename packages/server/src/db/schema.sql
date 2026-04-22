-- Slark SQLite schema (MVP-2)
-- 对齐 PLAN.md §Phase 1 MVP-2 和 docs/technical-decisions.md D-7 契约

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- =============================================================================
-- 1. channels
-- =============================================================================
CREATE TABLE IF NOT EXISTS channels (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK(type IN ('channel','dm')),
  created_at      INTEGER NOT NULL
);

-- =============================================================================
-- 2. agents
-- =============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  avatar          TEXT,
  description     TEXT,
  runtime         TEXT NOT NULL,
  model           TEXT,
  reasoning       TEXT,
  env_vars_json   TEXT,
  status          TEXT NOT NULL DEFAULT 'idle'
                  CHECK(status IN ('idle','thinking','working','error','stopped')),
  created_at      INTEGER NOT NULL
);

-- =============================================================================
-- 3. channel_agents (many-to-many)
-- =============================================================================
CREATE TABLE IF NOT EXISTS channel_agents (
  channel_id      TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, agent_id)
);

-- =============================================================================
-- 4. messages
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  channel_id      TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_type     TEXT NOT NULL CHECK(sender_type IN ('user','agent','system')),
  sender_id       TEXT,
  content         TEXT NOT NULL,
  metadata_json   TEXT,
  parent_id       TEXT REFERENCES messages(id) ON DELETE CASCADE,
  reply_count     INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread  ON messages(parent_id) WHERE parent_id IS NOT NULL;

-- =============================================================================
-- 5. tasks
-- =============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id          TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'todo'
                      CHECK(status IN ('todo','in_progress','in_review','done')),
  assignee_agent_id   TEXT REFERENCES agents(id) ON DELETE SET NULL,
  created_by          TEXT NOT NULL,
  source_message_id   TEXT REFERENCES messages(id) ON DELETE SET NULL,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_channel_status ON tasks(channel_id, status);

-- =============================================================================
-- 6. agent_activity
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN ('thinking','working','output','error','idle')),
  detail      TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity(agent_id, created_at DESC);

-- =============================================================================
-- 7. saved_messages（用户收藏）
-- =============================================================================
CREATE TABLE IF NOT EXISTS saved_messages (
  message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  saved_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_by_time ON saved_messages(saved_at DESC);

-- =============================================================================
-- 8. meta（schema 版本）
-- =============================================================================
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
