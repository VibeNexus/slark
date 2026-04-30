-- Slark SQLite schema (MVP-2)
-- 对齐 PLAN.md §Phase 1 MVP-2 和 docs/technical-decisions.md D-7 契约

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- =============================================================================
-- 1. channels
--
-- v1.0 新增 project_id 列（D-13）；对旧 db 由 db/index.ts 的 migrate() 幂等补列。
-- Sprint 1 CP5 后 Create Project 向导会强制填入 project_id；CP6+ 将 NOT NULL。
-- =============================================================================
CREATE TABLE IF NOT EXISTS channels (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK(type IN ('channel','dm')),
  project_id      TEXT REFERENCES projects(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL
);

-- =============================================================================
-- 2. agents
--
-- v1.0 新增 project_id 列（D-13）；对旧 db 由 migrate() 幂等补列。
-- v0 的 status 字段已在 CP8.3 移除（对齐 D-1：状态从 agent_runs 派生）。
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
  project_id      TEXT REFERENCES projects(id) ON DELETE CASCADE,
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
-- v1.0 新增 channel_id 列（D-3 / K-3）；对旧 db 由 db/index.ts 的 migrate() 幂等补列
CREATE TABLE IF NOT EXISTS agent_activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  channel_id  TEXT REFERENCES channels(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN ('thinking','working','output','error','idle')),
  detail      TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_agent_channel ON agent_activity(agent_id, channel_id, created_at DESC);

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

-- =============================================================================
-- 9. projects (v1.0 引入，对齐 docs/product-brief.md §D-2 / docs/technical-decisions.md D-13)
--
-- 用户视角："Project 是一等公民"，对应原版 slock.ai 的 Server。
-- workspace_path / goal 都是 NOT NULL，见 D-13 / D-14。
-- =============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  workspace_path  TEXT NOT NULL,
  goal            TEXT NOT NULL,
  team_rules      TEXT,
  color           TEXT,
  created_at      INTEGER NOT NULL
);

-- =============================================================================
-- 10. agent_runs (v1.0 引入，对齐 docs/technical-decisions.md D-1 / D-18)
--
-- 替代 v0 的 agents.status 单值字段：Agent 在每个 channel 的状态独立派生。
-- 活跃运行：ended_at IS NULL；结束运行：ended_at = timestamp。
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK(status IN ('thinking','working','error','stopped')),
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  error_msg   TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_active
  ON agent_runs(agent_id, channel_id)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_runs_by_channel
  ON agent_runs(channel_id, started_at DESC);

-- =============================================================================
-- 11. workflows (Sprint 2 引入，对齐 docs/technical-decisions.md D-16)
--
-- 声明式 YAML 甬道。同一 project_id 内 trigger_command 唯一。
-- source: 'builtin' = Slark 内置模板（feature-development / bug-fix / research）；
--         'user' = 用户自建 / Facilitator 产出（Sprint 7）。
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflows (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_command TEXT NOT NULL,
  definition_yaml TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'user'
                  CHECK(source IN ('builtin','user')),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE(project_id, trigger_command)
);
CREATE INDEX IF NOT EXISTS idx_workflows_project ON workflows(project_id);

-- =============================================================================
-- 12. workflow_runs (Sprint 2 引入)
--
-- Workflow 的执行实例。绑定到一个 channel 的 thread。
-- state_json 存每一步的 message_id / 用户反馈 / abort 原因等结构化状态。
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id     TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  channel_id      TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  thread_id       TEXT REFERENCES messages(id) ON DELETE CASCADE,
  status          TEXT NOT NULL
                  CHECK(status IN ('running','awaiting_approval','completed','aborted','failed')),
  current_step    TEXT,
  started_by      TEXT NOT NULL,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  state_json      TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_channel ON workflow_runs(channel_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_thread ON workflow_runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_active
  ON workflow_runs(channel_id, status)
  WHERE status IN ('running','awaiting_approval');

-- =============================================================================
-- 13. responsibilities (Sprint 3 引入，对齐 docs/technical-decisions.md D-17)
--
-- Workflow × Step × Agent 的责任连接（简化 RACI）。
-- agent_id 是 TEXT 而非 FK：可为 agents.id（普通 agent）或 'local-user'（系统一等"agent"）
-- 或 'unresolved:<mention>'（YAML 引用了项目里不存在的 agent name）。
--
-- workflow definition_yaml 修改时，会先 DELETE 然后重新 derive。
-- =============================================================================
CREATE TABLE IF NOT EXISTS responsibilities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id     TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  step_id         TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  role            TEXT NOT NULL CHECK(role IN ('executor','approver','reviewer','informed')),
  authority       TEXT CHECK(authority IN ('must_approve','optional_approve','no_authority')),
  created_at      INTEGER NOT NULL,
  UNIQUE(workflow_id, step_id, agent_id, role)
);
CREATE INDEX IF NOT EXISTS idx_responsibilities_workflow ON responsibilities(workflow_id);
CREATE INDEX IF NOT EXISTS idx_responsibilities_agent ON responsibilities(agent_id);

-- =============================================================================
-- 14. decisions (Sprint 4 引入，对齐 docs/technical-decisions.md D-20)
--
-- 项目级决策记录。来源：
--   - Scribe 自动从 thread / workflow_run 提炼（recorded_by='scribe', review_status='pending'）
--   - 用户手动 /decide（review_status='approved'）
-- =============================================================================
CREATE TABLE IF NOT EXISTS decisions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  audience        TEXT NOT NULL DEFAULT 'all',
  source_run_id   INTEGER REFERENCES workflow_runs(id) ON DELETE SET NULL,
  source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  confidence      REAL,
  review_status   TEXT NOT NULL DEFAULT 'pending'
                  CHECK(review_status IN ('pending','approved','rejected')),
  recorded_by     TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  reviewed_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_review ON decisions(project_id, review_status);

-- =============================================================================
-- 15. lessons (Sprint 4 引入)
--
-- 项目级经验条目。kind: 'do' | 'dont' | 'pattern' | 'pitfall'
-- audience: 'all' / 'team' / agent.id / agent.name —— ContextBuilder 注入时按此过滤。
-- =============================================================================
CREATE TABLE IF NOT EXISTS lessons (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK(kind IN ('do','dont','pattern','pitfall')),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  audience        TEXT NOT NULL DEFAULT 'all',
  tags_json       TEXT,
  source_run_id   INTEGER REFERENCES workflow_runs(id) ON DELETE SET NULL,
  source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  confidence      REAL,
  review_status   TEXT NOT NULL DEFAULT 'pending'
                  CHECK(review_status IN ('pending','approved','rejected')),
  recorded_by     TEXT NOT NULL,
  use_count       INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  reviewed_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_lessons_project ON lessons(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lessons_review ON lessons(project_id, review_status);
CREATE INDEX IF NOT EXISTS idx_lessons_audience ON lessons(project_id, audience);

-- =============================================================================
-- 16. agent_observations (Sprint 5 引入，对齐 D-20 Evolution Loop)
--
-- Evaluator 后台扫每个 agent 最近 N 个 task 产出后写入。Coach 聚合多条
-- observations 提描述演化建议。
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_observations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  /** 'positive' / 'negative' / 'neutral'：Evaluator 标的方向 */
  polarity        TEXT NOT NULL CHECK(polarity IN ('positive','negative','neutral')),
  /** 短标签，便于 Coach 聚合（如 "missing_error_handling" / "good_test_coverage")*/
  tag             TEXT NOT NULL,
  body            TEXT NOT NULL,
  /** 关联的 message id（如有）方便用户回溯 */
  source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  source_run_id   INTEGER REFERENCES workflow_runs(id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_observations_agent
  ON agent_observations(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_tag
  ON agent_observations(agent_id, tag);

-- =============================================================================
-- 17. agent_feedback (Sprint 5 引入)
--
-- Coach 提的 description 修改建议；用户在 Agent Profile FEEDBACK Tab 中
-- approve/reject/apply。Apply 后写 applied=1 + applied_at；保留 diff 历史
-- 以便回滚（Q-6）。
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_feedback (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id              TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  /** Evaluator 收集观察的窗口起止 */
  period_start          INTEGER NOT NULL,
  period_end            INTEGER NOT NULL,
  /** 简短摘要，供前端列表展示 */
  summary               TEXT NOT NULL,
  /** Coach 详细解释 */
  rationale             TEXT NOT NULL,
  /** Apply 前的 description（永远是当时的真实值，用于回滚） */
  description_before    TEXT NOT NULL,
  /** Coach 建议的 description 全文 */
  description_after     TEXT NOT NULL,
  /** 'pending' / 'applied' / 'rejected' / 'rolled_back' */
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','applied','rejected','rolled_back')),
  /** Coach 置信度 */
  confidence            REAL,
  /** Apply 时的 actor（'local-user'）；Reject 同 */
  reviewed_by           TEXT,
  applied_at            INTEGER,
  rejected_at           INTEGER,
  rolled_back_at        INTEGER,
  created_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_agent
  ON agent_feedback(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status
  ON agent_feedback(agent_id, status);

-- =============================================================================
-- 18. project_onboarding (Sprint 6 引入，对齐 D-20 Onboarding Loop)
--
-- 新 Project 创建后由 Onboarder 自动产出，summarizes README / package.json /
-- recent commits 给 ContextBuilder 注入和欢迎页展示。
-- 1 Project 1 行；重新 onboard 时覆盖。
-- =============================================================================
CREATE TABLE IF NOT EXISTS project_onboarding (
  project_id      TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  overview        TEXT NOT NULL,
  /** JSON 数组 */
  tech_stack_json TEXT NOT NULL DEFAULT '[]',
  /** 项目约定（编码风格 / branch 命名 / commit 风格 等）*/
  conventions     TEXT,
  /** 建议初始 lessons 候选个数（仅展示用） */
  ready           INTEGER NOT NULL DEFAULT 1,
  generated_at    INTEGER NOT NULL
);

-- =============================================================================
-- 19. agent_skills (Sprint 6 引入)
--
-- 由 tool_call.completed 事件自动统计。skill_key = 顶级路径段（如 "src/auth"
-- 或 "tests"）；touch_count 记录该 agent 在该路径下读/写的次数。
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_skills (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_key       TEXT NOT NULL,
  touch_count     INTEGER NOT NULL DEFAULT 0,
  last_touched    INTEGER NOT NULL,
  UNIQUE(agent_id, project_id, skill_key)
);
CREATE INDEX IF NOT EXISTS idx_skills_agent
  ON agent_skills(agent_id, touch_count DESC);
CREATE INDEX IF NOT EXISTS idx_skills_project_key
  ON agent_skills(project_id, skill_key);

-- =============================================================================
-- 20. workflow_sessions (Sprint 7 引入，对齐 D-15 Facilitator)
--
-- "Team-First-Collaborative Workflow Design" Session 的状态记录。
-- 用户启动一次 Session → Facilitator 主持团队讨论 → 产出 YAML draft → 用户 Approve。
--
-- 状态机：
--   drafting     — Facilitator 正在跑（fire-and-forget）
--   awaiting_approval — 已生成 YAML draft，等用户 Approve / Reject
--   approved     — 用户批准；YAML 已写入 workflows 表（workflow_id 不为 null）
--   rejected     — 用户拒绝
--   failed       — Facilitator 失败（fallback_reason 记原因，提示走 Sprint 2 Template）
--   archived     — 归档（用户从 UI 删除会议）
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  /** 用户提供的目标描述（这次想设计什么 workflow） */
  goal_input      TEXT NOT NULL,
  /** Facilitator 产出的 YAML draft（草稿；approved 后写到 workflows 表） */
  draft_yaml      TEXT,
  /** Facilitator 对设计的解释 */
  rationale       TEXT,
  status          TEXT NOT NULL DEFAULT 'drafting'
                  CHECK(status IN ('drafting','awaiting_approval','approved','rejected','failed','archived')),
  /** Approve 后写入的 workflow id */
  workflow_id     TEXT REFERENCES workflows(id) ON DELETE SET NULL,
  fallback_reason TEXT,
  started_by      TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  ended_at        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON workflow_sessions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON workflow_sessions(project_id, status);
