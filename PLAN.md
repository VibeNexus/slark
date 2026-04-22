# Slark - 本地 AI Agent 协作平台

> slock.ai 的本地复刻版。Agent 能力由本地 CLI 工具驱动，无需登录，无需 MCP，所有数据本地存储。
>
> **MVP 仅支持 Cursor CLI**（基于 Phase 0 验证：Cursor 首 token 约 4.5s、支持字符级流式，体验远优于 Codex/Claude）。Codex / Claude / Kimi / Copilot / Gemini 在 Runtime 下拉中占位并标 "(coming soon)"，MVP 后迭代再接入。
>
> **⚠ 动工前先读**：[`docs/product-brief.md`](docs/product-brief.md) 是本项目的战略层文档（Slark 是什么 / 为谁做 / 不做什么）。本文件是战术层（怎么分阶段做），如与 product-brief 冲突以 product-brief 为准。

## 文档地图

文档按照 **战略 → 战术 → 实现 → 视觉** 四层组织，新人从上到下读：

| 文档 | 层级 | 用途 | 什么时候读 |
|------|------|------|-----------|
| [`docs/product-brief.md`](docs/product-brief.md) | **战略** | 产品定位 / 目标用户 / 核心决策 / 非目标 | **必读，第一份** |
| `PLAN.md`（本文件） | 战术 | 4 阶段实施路线 + 每阶段验收清单 | 理解完产品定位后，规划执行时 |
| [`docs/technical-decisions.md`](docs/technical-decisions.md) | 实现 | 12+ 条默认决策（状态机/Token/并发/metadata/workspace/error UI 等） | 编码时遇到不确定的常量、策略、边缘情况 |
| [`docs/phase0-cli-spike.md`](docs/phase0-cli-spike.md) | 实现 | Phase 0 CLI 验证详细步骤 + 验收 | 执行 Phase 0 时 |
| [`docs/cli-event-format.md`](docs/cli-event-format.md) | 实现 | Cursor/Codex/Claude 事件格式对照 | 写 CLI Adapter 时 |
| [`docs/ui-reference/README.md`](docs/ui-reference/README.md) | 视觉 | UI 基准总索引（17 张截图 + 4 份规范） | 做 UI 时 |
| [`docs/ui-reference/design-tokens.md`](docs/ui-reference/design-tokens.md) | 视觉 | 色值/字体/间距/边框 | 配 Tailwind theme 时 |
| [`docs/ui-reference/components.md`](docs/ui-reference/components.md) | 视觉 | 每个组件结构与状态 | 实现组件时 |
| [`docs/ui-reference/routes.md`](docs/ui-reference/routes.md) | 视觉 | URL 结构与参数互斥规则 | 配 React Router 时 |
| [`docs/ui-reference/local-adaptations.md`](docs/ui-reference/local-adaptations.md) | 视觉 | 本地版相对原版的裁剪清单 | 实现 UI + 交付前 diff 检查 |

## 项目总览

### 三条主流程

```
流程 A：基础消息流
  用户输入 → WebSocket → SQLite → 广播 → @mention 解析
  → Agent Engine 构建上下文 → CLI Bridge spawn → 流式 stdout
  → WebSocket 推送 → 前端实时渲染 → 完整回复存入 SQLite

流程 B：@mention 链式触发
  Agent 回复中包含 @其他Agent → Message Router 检测
  → 自动创建/复用 Thread → 在 Thread 内触发下一个 Agent（重复流程 A）
  → 链式深度限制 max=10，同 Agent 连续 >3 次暂停

流程 C：Task 生命周期
  用户在 Tasks 面板创建 Task → Todo → Agent claimed (In Progress)
  → In Review → Done → 每次状态变更产生系统消息，显示在频道主线
```

### 五个核心模块

- **M1: CLI Bridge** — 替代 MCP，通过 spawn + NDJSON 事件流与 CLI 工具通信
- **M2: Agent Engine** — Agent CRUD + 状态机 + 上下文构建（description + 团队成员列表 + 对话历史）
- **M3: Message Bus** — WebSocket + 消息路由 + @mention 链式触发 + Thread 管理
- **M4: Data Layer** — SQLite 6 张表
- **M5: Frontend UI** — 1:1 还原 slock.ai 暖黄/奶油色 Neo-Brutalism 风格

### 技术栈

- **前端**: Vite + React 19 + TypeScript + Tailwind CSS v4 + Radix UI Primitives（见 `docs/technical-decisions.md` O-1）
- **后端**: Node.js + Fastify + ws + better-sqlite3
- **CLI 桥接**: `child_process.spawn` + NDJSON/JSONL 流式解析
- **包管理**: pnpm workspaces (monorepo)

### 关键决策与默认值

详见 [`docs/technical-decisions.md`](docs/technical-decisions.md)。核心摘要：

- **Agent 状态机（D-1）**: `idle / thinking / working / error / stopped`（5 状态，适配 spawn-per-message 模型，不用原版 Online/Hibernating）
- **Token 预算（D-4）**: `MAX_CONTEXT=8000 / DESCRIPTION=2000 / HISTORY=5500 / CURRENT=500`，按"4 字符 ≈ 1 token"粗估
- **并发控制（D-5）**: 同时最多 3 个 CLI 进程，超出进 FIFO 队列（队列最大 20），单次 spawn 超时 5 分钟
- **链式触发防护（D-6）**: `max_chain_depth=10 / max_consecutive_triggers=3 / max_mentions_per_message=5`
- **数据目录（D-8）**: `~/.slark/slark.db` + `~/.slark/agents/{id}/`（Slark 不预置记忆文件，CLI 工具自管）
- **Seed 数据（D-9）**: 首次启动预置 `#general` 频道 + （如检测到 Cursor）一个 Assistant Agent

---

## 四阶段实施路线

```
Phase 0    CLI Bridge 技术验证 (Spike)   ← 验证最大技术风险
Phase 0.5  UI 基准采集 (Reference)       ← ✅ 已完成，视觉基线
Phase 1    基础设施 (MVP-1 ~ MVP-3)      ← 项目骨架 + 数据 + API
Phase 2    核心引擎联调 (MVP-4 ~ MVP-6)  ← 第一次端到端演示
Phase 3    协作与配置 (MVP-7 ~ MVP-9)    ← 完整 MVP 交付
```

### 阶段验收概览

| 阶段 | 验收标准简述 | 详细清单 |
|------|-------------|---------|
| Phase 0 | 三个 CLI 适配器原型均能解析流式事件 | `docs/phase0-cli-spike.md` §验收标准 |
| Phase 0.5 ✅ | 17 张截图 + 5 份规范文档 | `docs/ui-reference/` |
| Phase 1 | REST API + WS 符合协议，curl 全通 | 本文 Phase 1 验收清单 |
| Phase 2 | 端到端 Agent 流式回复 + 核心 UI 与参考截图视觉对齐 | 本文 Phase 2 验收清单 |
| Phase 3 | 4 个核心协作场景全通 | 本文 Phase 3 验收清单 |

每个 Phase 的详细清单见下面各 Phase 章节尾部。

---

## 原方案关键修正

原设计假设 CLI 工具是**长驻进程**通过 stdin/stdout 持续对话。经实际验证，三个 CLI 工具都是 **spawn-per-message 模型**：

| 原设计 | 修正后 |
|--------|--------|
| `codex --quiet` 非交互模式 | `codex exec --json` 单次执行 + JSONL 事件流 |
| `claude -p` 管道模式保持进程 | `claude -p --output-format stream-json` 单次执行 + NDJSON |
| 无 Cursor CLI 支持 | `cursor agent -p --output-format stream-json` 新增为第三适配器 |
| 长驻进程 + stdin 发消息 | 每条消息 spawn 新进程，上下文通过 prompt 注入 |
| Agent 休眠 = 挂起进程 | Agent 休眠 = 无进程（天然实现） |
| 进程生命周期管理复杂 | 进程生命周期简单（启动 → 流式输出 → 退出） |

**架构影响**:
- 上下文注入成为最关键的模块（每次调用都要注入完整历史）
- Token 预算管理必须进 MVP（不能无限注入历史）
- 进程并发控制更简单（每个进程生命周期短暂）
- Markdown 渲染必须进 Phase 2（Agent 回复天然是 Markdown）

---

## Phase 0: CLI Bridge 技术验证 (Spike)

> 详细计划见 [docs/phase0-cli-spike.md](docs/phase0-cli-spike.md)

**目标**: 在写任何业务代码之前，验证三个 CLI 工具的非交互模式行为，确定适配器接口设计。

**验证范围**: Codex CLI / Claude Code / Cursor CLI 的 NDJSON 事件格式、上下文注入方式、启动延迟、输出解析。

**交付物**:
- `spike/` 目录下的三个适配器原型 + 测试脚本
- 统一的 `CLIAdapter` 接口定义（TypeScript）
- 三个 CLI 的事件格式对照文档
- Token 预算基线数据

---

## Phase 0.5: UI 基准采集 (Reference) ✅

> 产出见 [docs/ui-reference/](docs/ui-reference/README.md)

**目标**: 通过浏览器自动化从 app.slock.ai 采集真实截图与组件规范，作为 MVP-5 前端实现的视觉基线，保证 1:1 还原度。

**交付物**（已完成）:
- `docs/ui-reference/screenshots/` 17 张桌面版截图（覆盖 Sidebar / Channel / DM / Thread / Agent Profile 3 Tab / Create Agent Dialog / Tasks / Stop All / 全局 Threads/Tasks/Saved / Machine 页）
- `docs/ui-reference/design-tokens.md` 色值、字体、间距、边框、阴影
- `docs/ui-reference/components.md` 每个组件的结构与状态
- `docs/ui-reference/routes.md` URL 结构 + query 参数互斥规则
- `docs/ui-reference/local-adaptations.md` 相对原版的裁剪清单

**关键发现**（对原设计的修正）:
- 侧边栏背景是**明亮黄色**，不是米色；米色是主内容区
- Agent Profile 只有 **3 个 Tab**（PROFILE / WORKSPACE / ACTIVITY），没有独立 Settings Tab；Runtime/Model/Reasoning/Env Vars/Actions 全在 Profile 下
- Thread 和 Agent Profile 都作为**右侧第 3 栏面板**打开，形成三栏布局
- 全局 Tasks 是 **Kanban 看板视图**（MVP 可先砍，只做频道内 Tasks 面板）
- Runtime 下拉支持 6 种 CLI：Claude Code / Codex CLI / Kimi CLI / Copilot CLI / Cursor CLI / Gemini CLI
- Active 导航项整行**粉色填充**（不是左侧竖线）
- 已读/未读用小粉色圆形 badge 显示数字

---

## Phase 1: 基础设施 (MVP-1 ~ MVP-3)

**目标**: 搭建项目骨架、数据层和后端 API，所有模块可独立测试。

### MVP-1: Monorepo 骨架

- pnpm workspaces: `packages/web` + `packages/server` + `packages/shared`
- TypeScript strict mode + 路径别名（`@slark/shared`、`@slark/web`、`@slark/server`）
- Vite + React 19 + Tailwind CSS v4（web）—— 不引入 shadcn，见 O-1
- Fastify + ws + better-sqlite3（server）
- 共享类型与常量（shared：`types.ts` / `constants.ts` / `events.ts`）
- 根 `package.json` scripts：
  - `pnpm dev` — 并发启动 web + server（`concurrently`）
  - `pnpm dev:web` / `pnpm dev:server` — 单独启动
  - `pnpm build` — 构建两端
  - `pnpm typecheck` — 全量类型检查
  - `pnpm lint` — ESLint + Prettier

### MVP-2: SQLite 数据层

**Schema（7 张表，包含 `channel_agents` 关联表）**:

```sql
CREATE TABLE channels (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK(type IN ('channel','dm')),
  created_at      INTEGER NOT NULL
);

CREATE TABLE agents (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  avatar          TEXT,                      -- pixel art key 或颜色 hex
  description     TEXT,
  runtime         TEXT NOT NULL,             -- 'codex' | 'claude' | 'cursor' | 'kimi' | 'copilot' | 'gemini'
  model           TEXT,
  reasoning       TEXT,                      -- 'low' | 'medium' | 'high' | 'xhigh'
  env_vars_json   TEXT,                      -- JSON 对象
  status          TEXT NOT NULL DEFAULT 'idle',  -- 见 D-1
  created_at      INTEGER NOT NULL
);

CREATE TABLE channel_agents (
  channel_id      TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, agent_id)
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  channel_id      TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_type     TEXT NOT NULL CHECK(sender_type IN ('user','agent','system')),
  sender_id       TEXT,                      -- agent_id 或 'local-user' 或 NULL（system）
  content         TEXT NOT NULL,
  metadata_json   TEXT,                      -- 见 D-7 MessageMetadata 契约
  parent_id       TEXT REFERENCES messages(id) ON DELETE CASCADE,  -- Thread 根消息 ID
  reply_count     INTEGER NOT NULL DEFAULT 0,                      -- 仅根消息维护
  created_at      INTEGER NOT NULL
);
CREATE INDEX idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_thread ON messages(parent_id) WHERE parent_id IS NOT NULL;

CREATE TABLE tasks (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,  -- 自增便于显示 "#27"
  channel_id          TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'todo'
                      CHECK(status IN ('todo','in_progress','in_review','done')),
  assignee_agent_id   TEXT REFERENCES agents(id) ON DELETE SET NULL,
  created_by          TEXT NOT NULL,         -- 'local-user' 或 agent_id
  source_message_id   TEXT REFERENCES messages(id) ON DELETE SET NULL,  -- "As Task" 或引用来源
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX idx_tasks_channel_status ON tasks(channel_id, status);

CREATE TABLE agent_activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN ('thinking','working','output','error','idle')),
  detail      TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_activity_agent ON agent_activity(agent_id, created_at DESC);
-- D-3: 每个 agent 保留最近 500 条（应用层清理）
```

**其他交付**:
- `packages/server/src/db/migrations.ts` 迁移机制（Up/Down）
- Repository 层：`ChannelRepo` / `AgentRepo` / `MessageRepo` / `TaskRepo` / `ActivityRepo`
- Seed 脚本（D-9）：首次启动预置 `#general` + Assistant Agent（若检测到 Codex）

### MVP-3: 后端 API + WebSocket

**REST API 清单**:

```
# Channels
GET    /api/channels                     列出所有频道
POST   /api/channels                     创建频道 { name, description, type }
GET    /api/channels/:id                 频道详情
PATCH  /api/channels/:id                 更新频道
DELETE /api/channels/:id                 删除频道
GET    /api/channels/:id/messages        频道消息列表 ?limit=50&before={messageId}&parent_id={threadId}
GET    /api/channels/:id/agents          频道内 Agent 列表
POST   /api/channels/:id/agents          加入 Agent { agent_id }
DELETE /api/channels/:id/agents/:agentId 移除 Agent
POST   /api/channels/:id/stop-all        停止频道内所有 Agent

# Agents
GET    /api/agents                       列出所有 Agent
POST   /api/agents                       创建 Agent { name, description, runtime, model, reasoning, env_vars }
GET    /api/agents/:id                   Agent 详情
PATCH  /api/agents/:id                   更新 Agent
DELETE /api/agents/:id                   删除 Agent
POST   /api/agents/:id/start             启动 Agent（stopped → idle）
POST   /api/agents/:id/stop              停止 Agent（任意 → stopped）
POST   /api/agents/:id/restart           重启（stop + delete workspace + start）
GET    /api/agents/:id/activity          Activity 日志 ?limit=50&before={activityId}
GET    /api/agents/:id/workspace         Workspace 文件树（返回目录结构）

# Runtime Detection
GET    /api/runtimes                     列出本地 CLI 检测结果 [{name, installed, version, path}]

# Tasks
GET    /api/tasks                        全局 ?channel_id=xxx&status=todo
POST   /api/tasks                        创建 { channel_id, title, assignee_agent_id, source_message_id? }
GET    /api/tasks/:id                    任务详情
PATCH  /api/tasks/:id                    更新（状态变更、重新分配等）
DELETE /api/tasks/:id                    删除

# Server Meta
GET    /api/health                       { ok: true, version }
```

**WebSocket 协议**（`ws://localhost:4179/ws`）:

```typescript
// Client → Server
type ClientMessage =
  | { type: 'subscribe_channel'; channel_id: string }
  | { type: 'unsubscribe_channel'; channel_id: string }
  | { type: 'send_message'; channel_id: string; thread_id?: string; content: string }
  | { type: 'typing_start'; channel_id: string }
  | { type: 'typing_stop'; channel_id: string };

// Server → Client
type ServerMessage =
  | { type: 'message'; message: ChatMessage }
  | { type: 'message_stream'; message_id: string; delta: string }
  | { type: 'message_done'; message_id: string; final_content: string; metadata: MessageMetadata }
  | { type: 'agent_status'; agent_id: string; status: AgentStatus; detail?: string }
  | { type: 'system_event'; event: SystemEvent }
  | { type: 'task_update'; task: Task }
  | { type: 'error'; code: string; message: string };
```

**Message Router 职责**:
- 解析用户消息中的 `@mention` 正则（支持中英文 Agent 名）
- 根据 `thread_id` 路由到正确上下文构建器
- 广播 `agent_status` / `system_event` 到所有订阅该频道的 WS 客户端

---

### Phase 1 验收清单

**必须逐项通过才能进入 Phase 2**：

```bash
# === MVP-1 ===
- [ ] pnpm install 成功
- [ ] pnpm dev 后 web 在 4178、server 在 4179 都起来
- [ ] pnpm typecheck 零错误
- [ ] pnpm lint 零错误

# === MVP-2 ===
- [ ] 首次启动自动创建 ~/.slark/slark.db
- [ ] 包含 7 张表 + 所有约束与索引
- [ ] Seed 数据：#general channel 存在
- [ ] 如 cursor-agent 已安装，Assistant agent 存在且 joined #general

# === MVP-3: REST ===
- [ ] curl http://localhost:4179/api/health → { ok: true }
- [ ] curl http://localhost:4179/api/channels → [{ id: "general", ... }]
- [ ] curl http://localhost:4179/api/runtimes → 本机 CLI 检测结果
- [ ] curl POST /api/agents 创建成功，返回 id
- [ ] curl GET /api/agents/:id 返回刚创建的 agent
- [ ] curl POST /api/channels/:id/agents { agent_id } 成功关联
- [ ] curl GET /api/channels/:id/messages 空列表
- [ ] curl POST /api/tasks 创建任务返回 id（自增）

# === MVP-3: WebSocket ===
- [ ] websocat ws://localhost:4179/ws 能建立连接
- [ ] 发送 { type: "subscribe_channel", channel_id: "general" } 返回历史消息
- [ ] 发送 { type: "send_message", channel_id: "general", content: "hi" }
      → 另一个订阅者收到 { type: "message", message: {...} }
- [ ] 插入 @mention 消息触发 agent_status 事件（此时 Agent 未接入，走 mock 即可）
- [ ] 关闭连接再重连，订阅能恢复
```

---

## Phase 2: 核心引擎联调 (MVP-4 ~ MVP-6)

**目标**: 第一次端到端演示 -- 用户在前端发消息，Agent 流式回复。

### MVP-4: CLI Bridge 正式实现（仅 Cursor）

- **MVP 适配器范围**: 仅 Cursor CLI（`cursor-agent`）
- 从 `spike/src/` 迁移 `CLIAdapter` / `CursorAdapter` / `CLIRunner` / `ClaudeAdapter`（占位）到 `packages/server/src/agents/`
- **Runtime 注册表**（支持未来扩展）:
  ```typescript
  const RUNTIME_REGISTRY = {
    cursor: { impl: CursorAdapter, available: true },       // MVP 启用
    codex:  { impl: CodexAdapter,  available: false, note: 'coming soon' },
    claude: { impl: ClaudeAdapter, available: false, note: 'coming soon' },
    kimi:   { impl: null,          available: false, note: 'coming soon' },
    copilot:{ impl: null,          available: false, note: 'coming soon' },
    gemini: { impl: null,          available: false, note: 'coming soon' },
  };
  ```
  - Create Agent UI 显示 6 个选项，只有 Cursor 可选；其他标 "(coming soon)" 且 disabled
- **CLIRunner 进程管理**（直接搬 `spike/src/runner.ts`，新增）:
  - `spawn` + NDJSON stream parsing + timeout（D-5: 默认 300s）+ error recovery
  - 状态机转移（D-2: 事件 → `idle/thinking/working/error`）
  - **并发控制**（D-5: 最多 3 并发 + FIFO 队列 + 队列上限 20）← spike 未实现
  - **预检查**（新增）: spawn 前检查 `cursor-agent --version`，失败时立即 error
- **ContextBuilder**（新增）:
  - Token 预算分配（D-4: 8000 total / 2000 description / 5500 history / 500 current）
  - 历史消息截断：按 `"4 字符 ≈ 1 token"` 从最新往前累加，超出截断
  - 团队成员列表注入（frame 中包含 `@Name — role` 列表）
  - description 超限从中间截断
- **ActivityRecorder**（新增）: 按 D-3 粒度写入 `agent_activity`
- **workspace 管理**: Create Agent 时 `mkdir -p ~/.slark/agents/{id}/`，spawn 时 `cwd` 指向该目录

### MVP-5: 前端 Shell

**视觉基线**: 严格对照 [docs/ui-reference/](docs/ui-reference/README.md) 下的截图与规范实现。

**子任务**:
- 按 [design-tokens.md](docs/ui-reference/design-tokens.md) 配置 Tailwind theme（黄色 sidebar / 奶油色主区 / 粉色 CTA / 黑色 2px 边框 / 硬阴影）
- 引入 Radix UI Primitives（Dialog、Popover、Dropdown、Tabs、Tooltip）作为无样式 a11y 基础
- 按 [components.md](docs/ui-reference/components.md) 实现核心组件（MVP-5 范围见下表）
- 按 [routes.md](docs/ui-reference/routes.md) 配置 React Router + `useSearchParams` 解析 URL 参数
- 按 [local-adaptations.md](docs/ui-reference/local-adaptations.md) 砍掉多用户/云端相关 UI
- **基础 Markdown 渲染**（react-markdown，支持 inline code 黄底高亮 / task 编号 `#N` 渲染 / @mention 内联样式）
- Agent 消息流式渲染（逐字 `text_delta`，前端 16ms throttle 合并 re-render）
- Error/Loading/Empty 状态按 [technical-decisions.md D-11](docs/technical-decisions.md#d-11) 实现

**MVP-5 范围（必须实现）**:

| 组件 | 参考截图 | MVP-5 必做 |
|------|---------|-----------|
| Sidebar Chat Tab | `10-channel-main-desktop.png` | ✓ |
| Sidebar Members Tab | `02-sidebar-members-desktop.png` | ✓（简化：无 HUMANS / 无 Invite） |
| Channel Header | `10-channel-main-desktop.png` | ✓ |
| Channel Tab Strip (CHAT/TASKS) | `10-channel-main-desktop.png` | ✓ |
| Message List (Agent/User/System 3 种) | `10-channel-main-desktop.png`、`20-dm-architect-desktop.png` | ✓ |
| Message Input Box | 同上 | ✓（`As Task` 复选框占位，禁用） |
| DM Header | `20-dm-architect-desktop.png` | ✓ |

**MVP-5 不做**（移到 MVP-7/8/9）:
- Agent Profile 右侧面板 → MVP-8
- Thread Panel → MVP-7
- Tasks 面板 → MVP-9
- Create Agent Dialog → MVP-8
- Stop All Agents Dialog → MVP-8

### MVP-6: 端到端联调

- 完整链路贯通：用户发消息 → WS → Message Router → Agent Engine → CLI Bridge spawn → stdout 流式 → WS 推送 → 前端渲染
- Agent 状态实时同步（thinking / working / idle 切换通过 `agent_status` 事件推送，sidebar 状态点颜色变化）
- 错误处理：
  - CLI crash → system message 红色显示（D-11）
  - CLI timeout → system message + Agent status → error
  - parse failure → 静默忽略 + 写 activity log

---

### Phase 2 验收清单

**必须逐项通过**：

```
# === MVP-4: CLI Bridge ===
- [ ] 单元测试：ContextBuilder 注入 5000 字符 description 时正确截断到预算内
- [ ] 单元测试：ContextBuilder 注入 100 条历史消息时从最新倒序截断
- [ ] 集成测试：通过 CLI Bridge 发送 "say hi" 给 Codex 适配器，10s 内收到完整 "hi" 响应
- [ ] 集成测试：进程 spawn 时产生 activity 记录 (type=thinking)
- [ ] 集成测试：同时发起 5 个请求，第 4、5 个进入队列，前 3 个完成后依次执行
- [ ] 集成测试：kill 进程后 agent_status → error，Retry 后恢复正常
- [ ] 集成测试：超时触发 error 状态 + system 消息

# === MVP-5: 前端 Shell 视觉对齐 ===
# 对每个组件，PR 中附上并排截图：左侧 slock.ai 参考 / 右侧 Slark 实现
- [ ] Sidebar Chat Tab：活动频道粉色填充 + 未读 badge + description 等宽字体截断 —— 与 10-channel-main-desktop.png 对齐
- [ ] Sidebar Members Tab：AGENTS 分组 + 机器 subheader + 状态点颜色 —— 与 02-sidebar-members-desktop.png 对齐
- [ ] Channel Header：黄色 # icon + 描述 + 3 个右侧按钮 —— 与参考图对齐
- [ ] Message 渲染（三种类型）：
      Agent: pixel avatar + 名 + description + timestamp + 可选 task badge + "N replies"
      User: purple avatar + "owner" 标签
      System: timestamp + emoji prefix + 灰色文字
- [ ] @mention 内联标签：黄底黑字 2px 边框小圆角
- [ ] inline code `#27` / `spec_review`：等宽字体 + 黄底（task ref） / 浅底（code）+ 黑边
- [ ] 块级 code：白底 + 黑边 + 圆角 + 跨行
- [ ] Input Box：textarea + 附件 icon + "As Task" 占位 + Send 禁用/启用 pink

# === MVP-5: 路由 ===
- [ ] /channel/:id 可打开频道
- [ ] /channel/:id?chatTab=tasks 切到 Tasks Tab 占位（此时空列表）
- [ ] /dm/:id 可打开 DM
- [ ] /?sidebarTab=members 切到 Members Tab
- [ ] 浏览器刷新后 URL 状态保持

# === MVP-5: 边缘态 ===
- [ ] 未选择频道：显示 Welcome 页
- [ ] 空频道：显示 "No messages yet"
- [ ] 未安装任何 CLI：显示安装引导

# === MVP-6: 端到端 ===
- [ ] 在 #general 输入 "@Assistant 你好"
- [ ] Sidebar 中 Assistant 状态点变橙色（thinking → working）
- [ ] 主区出现 Assistant 消息卡片，字符逐字流式渲染
- [ ] 完成后状态点变绿（idle）
- [ ] 刷新页面，消息持久在 SQLite
- [ ] 断开 WS 重连后消息继续存在
- [ ] 强制 kill CLI 进程，频道出现红色 system 消息 "Assistant failed"
```

---

## Phase 3: 协作与配置 (MVP-7 ~ MVP-9)

**目标**: 多 Agent 链式协作 + Agent 管理 UI + 任务系统。

### MVP-7: @mention 链式触发 + Thread

- Agent 回复中 `@mention` → 自动触发下一个 Agent（在同一 Thread 内）
- Thread 自动创建：首次在消息上触发 Agent 响应时，系统将响应作为 Thread 子消息，根消息保留在频道主线
- **Thread Panel UI 作为右侧第 3 栏**（参考 `50-thread-panel-desktop.png`）
  - Header: `Thread — @AgentName` + "View in channel" 按钮（滚动到源消息）+ 关闭 ✕
  - 消息列表（仅 Thread 内）
  - 底部输入框：placeholder `"Message thread"`，**无 As Task 复选框**
- 频道主线只显示顶层消息（`parent_id IS NULL`）+ "N replies" 按钮（点击打开 Thread Panel）
- 链式防护（D-6）：
  - `max_chain_depth=10` 超限 → 停止 + system message "Chain depth limit reached"
  - 同 agent 连续触发 >3 → 停止 + system message "Possible infinite loop detected"
  - 超限事件写入 `messages.metadata_json.system_event = { type: 'chain_limit_reached' }`

### MVP-8: Agent 配置 UI

- **Create Agent 对话框**（对照 `60-create-agent-desktop.png`、`62-create-agent-advanced.png`）
  - 字段: Name * / Description / Runtime / Model / Reasoning Effort / > Advanced (Env Vars)
  - **不做 Machine 字段**（本地版去除，见 `local-adaptations.md`）
  - Runtime 下拉调 `GET /api/runtimes` 返回本地检测结果
  - 未安装显示 "(not installed)" 且 disabled
  - Model 下拉根据 Runtime 动态更新（Codex → GPT-5.4 等；Claude → Sonnet/Haiku 等）
  - 提交后自动 `mkdir -p ~/.slark/agents/{id}/` 并加入当前频道
- **Agent Profile 右侧面板**（对照 `40-agent-profile-desktop.png`）
  - **3 个 Tab**: PROFILE / WORKSPACE / ACTIVITY（**无独立 Settings Tab**）
  - Profile Tab 包含: avatar / name / status dot + 文字 / @handle / DISPLAY NAME (可编辑) / DESCRIPTION (可编辑) / INFO (Runtime/Model/Reasoning tags，不含 Machine 行) / Born / ENVIRONMENT VARIABLES (可编辑) / ACTIONS
  - ACTIONS 区按钮: Start Agent (白底) / Restart / Reset (白底) / Report Issue (pink bg) / Delete Agent (red bg)
  - Workspace Tab: 展示 `~/.slark/agents/{id}/` 的目录树（只读）
  - Activity Tab: 实时 activity 日志（`GET /api/agents/:id/activity`，WS 实时增量）
- **Stop All Agents Dialog**（参考 `30-stop-all-agents-dialog.png`）
  - 触发：Channel Header 左二按钮（□ 图标）
  - 调 `POST /api/channels/:id/stop-all`

### MVP-9: Tasks 面板

- **频道内 Tasks Tab**（对照 `12-channel-tasks-desktop.png`）
  - 状态过滤: All / Todo / In Progress / In Review / Done（每个带数量 badge）
  - "+ New Task" 按钮（pink）
  - Task 行: 展开箭头 / `#N` 编号 / 状态 badge / 描述 / assignee 标签 / 删除按钮
  - 已完成任务折叠成 "N done" 组
  - 拖拽或点击状态 badge 可切换状态（MVP 支持点击，拖拽进迭代）
- **Task 系统消息**（写入 `messages` 表 `sender_type='system'`，`metadata_json.system_event` 见 D-7）:
  - 创建: `"📝 1 new task created: #27 \"...\""`
  - claim（Agent 接收任务）: `"📌 Reviewer claimed #27 \"...\""`
  - moved: `"✅ User moved #23 \"...\" to Done"`
- **Task 分配**: 新建任务时可选 assignee（下拉选该频道内的 Agent）

**MVP 不做**（延后到 Phase 4+）:
- 全局 `/tasks` Kanban 看板
- "As Task" 复选框逻辑（保留 UI 但禁用）
- Task 拖拽排序
- Task 评论/子任务

---

### Phase 3 验收清单（4 个独立可测场景）

**场景 A：基本 @mention 触发 (MVP-7 前半)**
```
- [ ] 在 #general 输入 "@Assistant 你好"
- [ ] 消息卡片中 "@Assistant" 渲染为黄底黑字 inline tag
- [ ] Assistant 状态点 idle→thinking→working→idle
- [ ] Assistant 回复出现在频道，卡片含 pixel avatar + 名 + description 截断 + 时间戳
- [ ] 流式字符渲染（肉眼可见逐字输出，不是一次性弹出）
- [ ] 刷新后消息持久
```

**场景 B：链式触发 + Thread (MVP-7)**
```
前提：创建 2 个 Agent（如 Architect, Dev-Main），都加入 #general

- [ ] 用户发: "@Architect 把 XXX 功能拆给 @Dev-Main"
- [ ] Architect 回复中包含 "@Dev-Main ..."
- [ ] Message Router 自动触发 Dev-Main
- [ ] Dev-Main 响应进 Thread 而非频道主线（parent_id != NULL）
- [ ] 频道主线 Architect 消息底部显示 "1 replies" 按钮
- [ ] 点击 "1 replies" → 右侧 Thread Panel 从右滑入（第 3 栏）
- [ ] Thread Panel Header "Thread — @Architect"
- [ ] Thread Panel 列出 Architect 消息 + Dev-Main 回复
- [ ] Thread 输入框 placeholder "Message thread"，无 As Task
- [ ] Thread 内再 @mention 第三个 Agent → 继续触发在同 Thread 内
- [ ] 触发 max_chain_depth=10 → Thread 出现红色 system "Chain depth limit reached"
- [ ] 关闭 Thread 面板，频道主线仍只显示顶层消息
- [ ] 浏览器刷新后 Thread Panel 状态保持（通过 URL ?thread= 参数）
```

**场景 C：Create Agent 全流程 (MVP-8)**
```
- [ ] Sidebar 切到 Members Tab，点击 AGENTS 旁的 [+]
- [ ] Create Agent Dialog 打开，视觉与 60-create-agent-desktop.png 对齐
- [ ] 未填 Name 时 "Create Agent" 按钮 disabled 褪色
- [ ] Runtime 下拉：已安装的（如 Codex CLI）可选；未装的显示 "(not installed)" 且 disabled
- [ ] 选 Codex CLI 后 Model 下拉自动刷新为 GPT-5.4 等选项
- [ ] 点 "> Advanced" 展开 Environment Variables 区
- [ ] "+ Add Variable" 添加 KEY=VALUE 条目
- [ ] 填 Name="Alice" + Description + Runtime + Model 后，按钮变 pink 可点
- [ ] 点 "Create Agent"：
      1. Dialog 关闭
      2. Sidebar AGENTS 列表立刻出现 Alice（带绿色状态点）
      3. 文件系统创建 ~/.slark/agents/{id}/
      4. Alice 加入当前频道（channel_agents 表）
- [ ] 点击 Sidebar 中 Alice → 打开 DM
- [ ] 在 DM 输入 "hello" → Alice 状态点变橙色 → 流式回复 → 变绿
- [ ] 点 DM 头部 Alice 头像 → 右侧 Profile 面板打开（第 3 栏）
- [ ] Profile 有 3 Tab：PROFILE / WORKSPACE / ACTIVITY
- [ ] Profile Tab 显示 name / description / Runtime/Model/Reasoning tags / Born / Env Vars
- [ ] ACTIONS 区有 Start/Restart/Report Issue/Delete
- [ ] 点 Delete Agent → 确认弹窗 → Alice 从 sidebar 消失 + 频道消息中 Alice 的卡片仍保留但头像灰色
- [ ] 频道 Header 左二按钮 → Stop All Agents Dialog（与 30-stop-all-agents-dialog.png 视觉对齐）
```

**场景 D：Task 生命周期 (MVP-9)**
```
- [ ] 频道内切换到 TASKS Tab，显示 "All 0 / Todo / In Progress / In Review / Done"
- [ ] 点 "+ New Task" → 出现输入对话框（title + 可选 assignee 下拉）
- [ ] 填写标题 "测试任务" + assignee=Alice，提交
- [ ] TASKS 列表立刻出现 #1 任务，状态 TODO（橙 badge）
- [ ] 切回 CHAT Tab，看到 system 消息 "📝 1 new task created: #1 \"测试任务\""（metadata_json.system_event.type='task_created'）
- [ ] 切回 TASKS，点击 #1 状态 badge → 切到 In Progress（青 badge）
- [ ] 切回 CHAT，看到 "📌 Alice claimed #1 ..."
- [ ] TASKS 再切到 In Review（紫 badge）→ CHAT 出现 "** Alice moved #1 to In Review"
- [ ] 再切到 Done → CHAT 出现 "✅ User moved #1 to Done"
- [ ] TASKS 列表中 #1 自动折叠进 "1 done" 组
- [ ] 过滤按钮点 "Done" → 只显示已完成任务
- [ ] 过滤按钮点 "All" → 全部显示
- [ ] 点 #1 删除按钮 → 确认后消失
- [ ] SQLite 持久化：刷新页面，Tasks 与系统消息都还在
```

---

## 后续迭代（MVP 之后）

- "As Task" 发消息自动创建任务
- Agent-to-Agent DM（Agent 主动给另一个 Agent 发 DM）
- Team Memory 注入（团队级 Ground Rules / 共享 Spec）
- Search 全局搜索 (Cmd+K)
- Saved 收藏消息
- Agent Workspace 文件浏览器
- Agent Activity 独立日志页
- Kimi CLI / Gemini CLI 适配器
- 深色/浅色主题
- 键盘快捷键
- 代码块语法高亮

---

## 关键技术决策

- **为什么不用 MCP**: 本地场景直接 spawn CLI 比 MCP 更简单直接
- **为什么用 SQLite**: 零配置单文件，适合本地应用
- **为什么用 WebSocket**: 需要双向通信（发消息 + 流式响应 + 状态更新）
- **为什么用适配器模式**: 不同 CLI 接口差异大，适配器解耦核心逻辑
- **为什么 spawn-per-message**: CLI 工具原生设计就是单次执行，不支持持续对话
- **记忆哲学**: Slark 不接管 CLI 工具自身记忆（CLAUDE.md 等），只负责通信通道和消息持久化
