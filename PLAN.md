# Slark - Programmable AI Team OS（战术执行计划）

> **Slark 的定位是 Programmable AI Team OS（可编程的 AI 团队操作系统）**。详见 [`docs/product-brief.md`](docs/product-brief.md) v1.0。
>
> 核心机制：**Goal → AI 配 Team → Team 协同设计 Workflow → 自动沉淀 / 自动成长**。全链路 AI 自驱动，人只在关键节点 Approve。
>
> **MVP runtime 仅支持 Cursor CLI**（基于 Phase 0 验证：Cursor 首 token 约 4.5s、支持字符级流式）。Codex / Claude / Kimi / Copilot / Gemini 在 Runtime 下拉占位，MVP 后迭代再接入。
>
> **⚠ 动工前先读**：[`docs/product-brief.md`](docs/product-brief.md) v1.0 是战略层北极星。本文件是战术执行层，与 product-brief 冲突时以 product-brief 为准。

## 文档地图

文档按照 **战略 → 战术 → 实现 → 视觉** 四层组织，新人从上到下读：

| 文档 | 层级 | 用途 | 什么时候读 |
|------|------|------|-----------|
| [`docs/product-brief.md`](docs/product-brief.md) | **战略** | 产品定位 / 6 层架构 / 8 决策 / Sprint 路线图 / 非目标 | **必读，第一份** |
| `PLAN.md`（本文件） | 战术 | 按 Sprint 拆分的交付清单 + 验收标准 | 理解完产品定位后，规划执行时 |
| [`docs/clawteam-comparison.md`](docs/clawteam-comparison.md) | 战术 | ClawTeam 竞品分析 + 可借鉴条目（B-1~B-8） | 规划进阶功能时参考 |
| [`docs/technical-decisions.md`](docs/technical-decisions.md) | 实现 | 默认决策 / 常量 / 状态机 / error UI 等 | 编码时遇到不确定的常量、策略 |
| [`docs/phase0-cli-spike.md`](docs/phase0-cli-spike.md) | 实现 | Phase 0 CLI 验证（已完成） | 回溯 CLI 行为 |
| [`docs/cli-event-format.md`](docs/cli-event-format.md) | 实现 | Cursor/Codex/Claude 事件格式对照 | 写 CLI Adapter 时 |
| [`docs/ui-reference/README.md`](docs/ui-reference/README.md) | 视觉 | UI 基准总索引（17 张截图 + 4 份规范） | 做 UI 时 |
| [`docs/ui-reference/design-tokens.md`](docs/ui-reference/design-tokens.md) | 视觉 | 色值/字体/间距/边框 | 配 Tailwind theme 时 |
| [`docs/ui-reference/components.md`](docs/ui-reference/components.md) | 视觉 | 每个组件结构与状态 | 实现组件时 |
| [`docs/ui-reference/routes.md`](docs/ui-reference/routes.md) | 视觉 | URL 结构与参数互斥规则 | 配 React Router 时 |
| [`docs/ui-reference/local-adaptations.md`](docs/ui-reference/local-adaptations.md) | 视觉 | 本地版相对原版的裁剪清单 | 实现 UI + 交付前 diff 检查 |

## 项目总览

### 一句话定位

> **Slark = Programmable AI Team OS** —— 你设定 Goal，AI 自动配备团队，团队自己设计 Workflow，系统持续沉淀经验并让每个 Agent 随项目成长。

### 6 层架构（核心模型）

```
Layer 6:  Capability      能力强化（Evaluator + Coach）
Layer 5:  Knowledge       集体知识（Scribe + decisions/lessons）
Layer 4:  Responsibility  职责框架（RACI 简化：Step × Agent）
Layer 3:  Workflow        工作流"甬道"（声明式 YAML）
Layer 2:  Team            团队成员（Team Architect AI 自动配）
Layer 1:  Goal            项目目标（一等公民，必填）
```

### 三条主流程

```
流程 A：Goal → AI 团队组建（Sprint 1）
  用户填 Goal + Workspace → Team Architect spawn → 推荐 Team
  → 用户 Approve → 创建 Agents 加入 #general → 用户首次 @ 开始对话

流程 B：Workflow 驱动多 Agent 协作（Sprint 2~3）
  用户 /trigger → Workflow Runner 按 YAML step 路由
  → 每步 spawn 对应 owner Agent → 流式输出 → 完成 → 下一步
  → await_approval step 等用户 /approve → 整条 thread 完结

流程 C：自动沉淀 + 持续进化（Sprint 4~5）
  Workflow Run 结束 → Scribe 回扫 thread 提炼 lessons / decisions
  → 用户在 Intelligence Tab Approve → 进入项目知识池
  → 后续 Agent spawn 时 ContextBuilder 按 audience 注入相关知识
  Coach 周期性扫描 Agent 表现 → 提 description 修改建议
  → 用户 Apply → agents.description 演化
```

### 五个核心模块

- **M1: CLI Bridge** — `child_process.spawn` + NDJSON/JSONL 流式解析（Cursor 适配器）
- **M2: Agent Engine** — Agent CRUD / 状态机 / ContextBuilder / agent_runs per-channel 状态
- **M3: Message Bus** — WebSocket / Message Router / @mention 链式触发 / Thread / Workflow Runner
- **M4: Data Layer** — SQLite (projects / channels / agents / messages / tasks / workflows / decisions / lessons / agent_feedback / ...)
- **M5: Frontend UI** — Vite + React + Tailwind，Neo-Brutalism 暖黄风（1:1 对照 slock.ai）

### 技术栈

- **前端**: Vite + React 19 + TypeScript + Tailwind CSS v4 + Radix UI Primitives（见 `docs/technical-decisions.md` O-1）
- **后端**: Node.js + Fastify + ws + better-sqlite3
- **CLI 桥接**: `child_process.spawn` + NDJSON/JSONL 流式解析
- **包管理**: pnpm workspaces (monorepo)

### 关键决策与默认值

详见 [`docs/technical-decisions.md`](docs/technical-decisions.md)。核心摘要：

- **Agent 状态机（D-1）**: `idle / thinking / working / error / stopped`，per-channel 派生（Sprint 1 起从 `agent_runs` 表派生，原 `agents.status` 字段废除）
- **Token 预算（D-4）**: `MAX_CONTEXT=8000 / DESCRIPTION=2000 / HISTORY=5500 / CURRENT=500`，按"4 字符 ≈ 1 token"粗估
- **并发控制（D-5）**: 同时最多 3 个 CLI 进程，超出进 FIFO 队列（队列最大 20），单次 spawn 超时 5 分钟
- **链式触发防护（D-6）**: `max_chain_depth=10 / max_consecutive_triggers=3 / max_mentions_per_message=5`，per-thread 计数
- **数据目录（D-8 v1.0 修订）**: `~/.slark/slark.db`；**不再有 Agent 沙盒目录**；Agent cwd 取自 `project.workspace_path`
- **Seed 数据（D-9 v1.0 修订）**: 首次启动**不预置任何 Project / Channel / Agent**，欢迎页引导 Create Project

---

## 实施路线总览

```
Phase 0     CLI Bridge 技术验证 (Spike)        ✅ 已完成
Phase 0.5   UI 基准采集 (Reference)            ✅ 已完成
v0 MVP      MVP-1 ~ MVP-9 基础聊天室能力      ✅ 已交付（作为 Sprint 1 起点）
Sprint 1    Foundation + Goal → AI Team       ⏳ 即将动工（Programmable AI Team OS 雏形）
Sprint 2    Workflow Framework                Workflow YAML + 3 内置模板 + 执行引擎
Sprint 3    Responsibility + User Intervention 批准流 + 用户介入 + Workflow Import/Export
Sprint 4    Delivery Loop (Scribe 单独)       Scribe 沉淀 + Intelligence Tab
Sprint 5    Evolution Loop                    Evaluator + Coach + Description 演化
Sprint 6    Onboarding Loop + Skill Matrix    新 Project 自动分析 + 能力地图
Sprint 7    Team-First-Collaborative Workflow Facilitator 主持的 Workflow Design Session（核心差异化）
Sprint 8+   远期路线                          跨 Project 经验迁移 / 多 runtime / Worktree 隔离 / Marketplace
```

### Sprint 启动前必做 checklist

每个 Sprint 动工前，负责人必须走一遍：

1. 扫一遍 [`docs/product-brief.md`](docs/product-brief.md) §10 待决议表，把 `Deadline <= 本 Sprint` 的 `Q-N` 全部拍板或显式延期
2. 扫一遍 [`docs/clawteam-comparison.md`](docs/clawteam-comparison.md) §4.5 Sprint 映射汇总，确认本 Sprint 需要兑现的 B-N 借鉴条目
3. 扫一遍 [`docs/research/routa-analysis.md`](docs/research/routa-analysis.md)，检查有无待兑现的 B-N
4. 扫一遍 [`docs/optimization-backlog.md`](docs/optimization-backlog.md)，把 🔴 优先级 `[待排期]` 条目按需纳入当前 Sprint

任一条未完成 → Sprint 不动工。

---

## Phase 0: CLI Bridge 技术验证 (Spike) ✅

> 详细计划见 [docs/phase0-cli-spike.md](docs/phase0-cli-spike.md)

**目标**: 在写业务代码之前，验证 Codex / Claude Code / Cursor CLI 的非交互模式行为，确定适配器接口设计。

**关键产出**：
- 三个 CLI 都是 **spawn-per-message** 模型（推翻原"长驻进程"假设）
- 统一的 `CLIAdapter` 接口已落地（`packages/server/src/agents/types.ts`）
- 三个 CLI 的事件格式对照见 [`docs/cli-event-format.md`](docs/cli-event-format.md)
- Cursor 首 token 约 4.5s，支持字符级流式 → 选定为 MVP runtime

---

## Phase 0.5: UI 基准采集 (Reference) ✅

> 产出见 [docs/ui-reference/](docs/ui-reference/README.md)

**目标**: 通过浏览器自动化从 app.slock.ai 采集真实截图与组件规范，作为前端实现的视觉基线，保证 1:1 还原度。

**关键产出**：
- 17 张桌面版截图 + 5 份规范文档
- 修正原设计：侧边栏明亮黄、Agent Profile 3 Tab、三栏布局、Active 整行粉色填充等

**v1.0 后的视觉差异**（需要在 Sprint 1+ 时补充到 ui-reference）：
- Sidebar 顶部 "KaisTeam ▼" 改为 **Project 切换器**（Slark v1.0 概念，原版无对应）
- Agent Profile 从 3 Tab 简化为 PROFILE / ACTIVITY（Sprint 1）→ 后续加 FEEDBACK Tab（Sprint 5）
- 新增 **Intelligence Tab**（Sprint 4，与 CHAT/TASKS Tab 平级）
- 新增 **Workflow 进度条 + Approval Card** 组件（Sprint 2~3）

---

## v0 MVP（✅ 已交付，作为 Sprint 1 起点）

v0 MVP 是按原 PLAN（v0.1 ~ v0.3）落地的"AI 编程协作室"基础版本。当前代码库（`packages/server` + `packages/web`）已包含以下能力：

### 已交付清单

| 模块 | 已实现 | 文件位置（指引）|
|-----|-------|---------------|
| **Monorepo 骨架** | pnpm workspaces / TS strict / Vite / Fastify / better-sqlite3 / concurrently | `package.json` / `packages/*/package.json` |
| **SQLite Schema (v0)** | channels / agents / channel_agents / messages / tasks / agent_activity / saved_messages / meta（**8 张表，v1.0 需重构**） | `packages/server/src/db/schema.sql` |
| **REST API** | channels / agents / messages / tasks / runtimes / health 等 | `packages/server/src/routes/` |
| **WebSocket 协议** | subscribe_channel / send_message / message_stream / agent_status / message_done 等 | `packages/server/src/ws/handler.ts` |
| **CLI Bridge** | CursorAdapter（含 thinking/text/tool stream 解析）+ CLIRunner（并发池 / 超时 / kill）| `packages/server/src/agents/` |
| **ContextBuilder** | description + team members + history + current message + 截断 | `packages/server/src/agents/context-builder.ts` |
| **Message Router** | @mention 解析 + 链式触发（已支持 Thread）| `packages/server/src/messaging/router.ts` |
| **前端 Shell** | Sidebar / Channel / DM / Thread / Tasks / Agent Profile 3 Tab / Create Agent / Channel Settings 对话框 | `packages/web/src/components/` |
| **视觉对齐** | Tailwind v4 配 Neo-Brutalism token，整体与 slock.ai 参考截图一致 | `packages/web/src/index.css` 等 |
| **路由** | `/channel/:id` / `/dm/:id` / `?profile=` / `?thread=` / `?chatTab=` 等 | `packages/web/src/App.tsx` |
| **Seed 数据 (v0)** | 首次启动创建 `#general` channel + 检测 cursor-agent 创建 Assistant | `packages/server/src/db/seed.ts` |

### v0 MVP 已知差距（Sprint 1 需要补的事）

按 [`docs/product-brief.md`](docs/product-brief.md) v1.0 的 §11 Schema 总清单 + §D-2~D-8 的对照：

| # | v0 状态 | v1.0 要求 | Sprint 1 处理 |
|---|--------|---------|------|
| 1 | 无 `projects` 表 | Project 实体 + workspace_path NOT NULL + goal NOT NULL | 新建 |
| 2 | `channels` 无 project_id | 必须归属 Project | ALTER + 必填 |
| 3 | `agents` 无 project_id | 必须归属 Project（v1.0 砍全局 Agent）| ALTER + 必填 |
| 4 | `agents.status` 是单值字段 | per-channel 派生自 `agent_runs` 表（K-1）| 删字段 + 建新表 |
| 5 | `agent_activity` 无 channel_id | 加 channel_id 区分项目（K-3）| ALTER |
| 6 | Agent cwd = `~/.slark/agents/{id}/`（沙盒） | cwd = `project.workspace_path`（K-4 + D-8）| 改 CLIRunner |
| 7 | Seed 直接建 #general + Assistant | 不预置任何 Project / Agent，首启显示欢迎页 | 重写 seed |
| 8 | Agent Profile 3 Tab（PROFILE/WORKSPACE/ACTIVITY）| 简化为 2 Tab（PROFILE/ACTIVITY），Workspace Tab 删除 | 改组件 |
| 9 | 无 Project 切换器 | Sidebar 顶部 Project 切换器 | 新增组件 |
| 10 | 无 Team Architect 系统 Agent | Goal → AI 推 Team 是 Sprint 1 核心 | 实现 |

**数据迁移策略**（按 product-brief.md N-14）：v0 数据库直接清空重建，不保留兼容字段。

---

## Sprint 1: Foundation + Goal → AI Team（即将动工）

**目标**: **3 分钟内从 Goal 得到一个可用的 AI Team**，让 Slark 的 "Programmable AI Team OS" 雏形落地。

**战略价值**：第一次实现 "Goal → AI 配 Team"。用户见到产品的**第一分钟**就能感受到差异化（vs slock.ai 手动建 Agent / vs Cursor 单 Agent）。

**预估工期**: 8~12 工作日（含弹性，Team Architect 稳定性 + 三步向导复杂度 + 并发隔离验收可能拖长；严格遵循但允许 ±20% 偏差）

### 1.1 Schema 重构（按 product-brief §11）

**迁移操作（Review 1 决议）**：Sprint 1 动工的**第一步**是直接删除 `~/.slark/slark.db`（不备份，按 product-brief v1.0.1 §11 迁移策略）。v0 数据价值低，升级不做自动迁移路径。对已运行的 v0 环境，执行：

```bash
rm -f ~/.slark/slark.db
```

然后按以下 schema 重建：

```sql
-- 1. projects 表（核心新增）
CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,         -- URL slug, 如 'sso-service'
  display_name    TEXT,
  workspace_path  TEXT NOT NULL,                -- 必填，绝对路径
  goal            TEXT NOT NULL,                -- 必填，最长 500 字符
  team_rules      TEXT,                         -- 可选，团队协作规则
  color           TEXT,
  created_at      INTEGER NOT NULL
);

-- 2. channels 加 project_id
ALTER TABLE channels ADD COLUMN project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_channels_project ON channels(project_id);

-- 3. agents 加 project_id（v1.0 砍全局 Agent，全部 project-scoped）
ALTER TABLE agents ADD COLUMN project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_agents_project ON agents(project_id);

-- 4. 删 agents.status 字段，新建 agent_runs 表（K-1）
ALTER TABLE agents DROP COLUMN status;
CREATE TABLE agent_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK(status IN ('thinking','working','error','stopped')),
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  error_msg   TEXT
);
CREATE INDEX idx_agent_runs_active ON agent_runs(agent_id, channel_id) WHERE ended_at IS NULL;

-- 5. agent_activity 加 channel_id（K-3）
ALTER TABLE agent_activity ADD COLUMN channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE;
CREATE INDEX idx_activity_agent_channel ON agent_activity(agent_id, channel_id, created_at DESC);
```

### 1.2 后端任务（4~5 天）

#### 1.2.1 Repository / Service 重构

- [ ] 新增 `ProjectRepo`（CRUD + slug 唯一校验 + workspace_path 路径校验）
- [ ] `ChannelRepo` / `AgentRepo` 加 `byProject(projectId)` 等方法
- [ ] 新增 `AgentRunRepo`（startRun / endRun / activeRunsForAgent / activeRunsByChannel）
- [ ] `MessageRouter` / `ContextBuilder` 改为按 channel → project 解析 cwd

#### 1.2.2 REST API

```
# Projects 新增
GET    /api/projects                列出所有 Project
POST   /api/projects                创建 Project { name, display_name?, workspace_path, goal, team_rules? }
GET    /api/projects/:id            Project 详情
PATCH  /api/projects/:id            更新 Project
DELETE /api/projects/:id            删除（级联 channels / agents / messages / tasks）
GET    /api/projects/:id/channels   该 Project 下所有 channels（替代原 GET /api/channels）

# Team Architect（新增系统 Agent 端点）
POST   /api/projects/:id/suggest-team   { goal, workspace_path } → { agents: [...] }

# Channels / Agents 旧端点
- 移除全局 GET /api/channels（改为 GET /api/projects/:id/channels）
- POST /api/channels 必须带 project_id
- POST /api/agents 必须带 project_id

# Agent Status（改为派生）
GET    /api/agents/:id/status       从 agent_runs 派生 { perChannel: { channelId: status }, anyActive: boolean }

# Workspace 端点删除（无 Agent sandbox）
- 移除 GET /api/agents/:id/workspace
```

#### 1.2.3 WebSocket 协议升级

```typescript
// agent_status 事件 payload 加 channel_id
type ServerMessage =
  | { type: 'agent_status'; agent_id: string; channel_id: string; status: AgentStatus; detail?: string }
  // ... 其他保持
```

订阅模型不变（仍按 channel 订阅），但状态广播粒度细化到 per-channel。

#### 1.2.4 CLIRunner cwd 改造

```typescript
// 原（v0）
const cwd = `~/.slark/agents/${agent.id}/`;

// 新（Sprint 1）
const project = await projectRepo.byId(channel.project_id);
const cwd = project.workspace_path;
```

#### 1.2.5 Team Architect System Agent 实现

**新增模块**：`packages/server/src/system-agents/team-architect.ts`

**接口**：
```typescript
interface TeamSuggestion {
  agents: Array<{
    name: string;            // "Architect" / "Dev-Backend" / "Reviewer"
    role: string;            // 简短角色标签
    description: string;     // 完整 system prompt（500-1500 字符）
    runtime: 'cursor';       // MVP 固定
    model: string;           // 默认 'composer-2-fast'
    reasoning: 'medium';     // 默认
  }>;
  rationale: string;         // 为什么推荐这个组合
}

async function suggestTeam(input: {
  goal: string;
  workspace_path: string;
  workspace_hint?: { stack?: string; readme_excerpt?: string };
}): Promise<TeamSuggestion>;
```

**实现方式**：
1. 用 CursorAdapter spawn 一次特殊 prompt
2. 内置 description 模板（不暴露给用户）：
   ```
   You are a Team Architect for an AI engineering team. Given a project goal,
   recommend a team of 3~5 AI agents with clear roles. Reply with strict JSON:
   { agents: [...], rationale: "..." }
   ```
3. 解析 JSON → 返回 TeamSuggestion

**兜底逻辑（Q-2 + Review 5 决议）**：以下任一情况走**固定三件套兜底**：
- cursor-agent 未安装（`checkInstallation()` 失败）
- Team Architect spawn 超时（> 30s，独立超时，不受 `PROCESS_TIMEOUT_MS` 300s 限制）
- 返回内容 JSON 解析失败

```typescript
const FALLBACK_TEAM: TeamSuggestion = {
  agents: [
    {
      name: 'Architect',
      role: 'Architect',
      description: 'You design APIs and data models for this project. Focus on clarity and maintainability.',
      runtime: '',          // 空串，Approve 后用户必须在 Agent Profile 里配
      model: '',
      reasoning: 'medium',
    },
    {
      name: 'Dev',
      role: 'Developer',
      description: 'You implement features based on the Architect\'s design. Write clean, tested code.',
      runtime: '',
      model: '',
      reasoning: 'medium',
    },
    {
      name: 'Reviewer',
      role: 'Reviewer',
      description: 'You review code for correctness, security, and maintainability. Call out issues directly.',
      runtime: '',
      model: '',
      reasoning: 'medium',
    },
  ],
  rationale: 'Default team (Team Architect unavailable). Please configure runtime/model for each agent before use.',
};
```

UI 在 Step 2 展示黄色警告条：`"Team Suggestion unavailable, showing default team. Please configure runtime per agent after approval."` + 安装 cursor-agent 的引导链接。

#### 1.2.6 Seed 数据重写（D-9 v1.0）

```typescript
// 旧（v0）
- 创建 #general
- 检测 cursor-agent → 创建 Assistant Agent

// 新（Sprint 1）
- 不预置任何 Project / Channel / Agent
- 启动时检查 projects 表为空 → 前端展示欢迎页 "Create your first Project"
```

### 1.3 前端任务（3~4 天）

#### 1.3.1 Sidebar Project 切换器

- 顶部添加 Project 下拉（替换原 KaisTeam 占位）
- 显示当前 Project 的 display_name + workspace_path 缩写
- 下拉项：所有已存在的 Project + 一条 "+ New Project" 触发 Create Project Dialog
- 切换 Project 后：刷新 Channels / DMs / Members 列表，路由跳转到该 Project 的 #general

#### 1.3.2 Create Project 向导（核心 UX）

**三步式**：

```
Step 1: Project Basics
  - Name (URL slug, 必填，自动小写连字符化)
  - Display Name (可选，默认同 Name)
  - Workspace Path (必填，"Pick Folder" 按钮调原生选择器)
  - Goal (必填，textarea，max 500 字符，下方计数)
  - Team Rules (可选，textarea)
  
  [Cancel] [Next →]

Step 2: AI Team Suggestion
  - Loading 动画："Team Architect is analyzing your goal..."
  - 5~10 秒后显示推荐卡片：
    
    Based on your goal, we recommend:
    
    ┌─────────────────────────────┐
    │ ✓ Architect                  │
    │   Designs API and data model │
    │   [Edit] [Remove]            │
    └─────────────────────────────┘
    ┌─────────────────────────────┐
    │ ✓ Dev-Backend                │
    │   ...                        │
    └─────────────────────────────┘
    
    Rationale: ...
    
    [+ Add Custom Agent]
    [← Back] [Approve & Create]

Step 3: Done
  - "Project created! Jumping to #general..."
  - 自动跳转 /p/{name}/channel/general
```

**降级策略**（Q-2）：
- 检测到无 cursor-agent → Step 2 直接显示兜底默认 + 黄色提示 "Cursor CLI not detected, showing default team. Install cursor-agent to enable AI team suggestion. [Install Guide]"

#### 1.3.3 Welcome 页改造

- v0：检测有 #general → 直接进入；否则空白
- 新：检测 projects 表为空 → 显示 Welcome 页
  - "Welcome to Slark"
  - "Create your first Project to start"
  - 大按钮 [+ New Project]（触发 Create Project 向导）
  - 下方小字介绍 Slark 是什么

#### 1.3.4 路由重构

```
原:  /channel/:id  /dm/:id
新:  /p/:projectName/channel/:channelId
     /p/:projectName/dm/:dmId
     /p/:projectName/welcome  (无 channel 时)
     /                         (无 Project 时全局 Welcome)
```

- 所有现有路由相关组件按新格式更新
- URL query 参数（`?profile=` / `?thread=` / `?chatTab=` 等）保持不变

#### 1.3.5 Agent Profile 简化

- 删除 WORKSPACE Tab 整体（包含其下文件树 / Refresh 按钮等组件）
- Tab Strip 从 3 个 Tab 改为 2 个：PROFILE / ACTIVITY
- ACTIVITY Tab 加一个简单的 "filter by channel" 下拉（基于新加的 channel_id）

#### 1.3.6 StatusDot 改造

- 原 Sidebar 显示 Agent 全局状态点
- 改：根据"是否有 active agent_run"派生状态（任意 channel 在跑就是 working）
- DM Header 等显示当前 channel 的具体状态（更细粒度）

### 1.4 清理任务（0.5 天）

- [ ] 删除 `~/.slark/agents/` 目录创建逻辑
- [ ] 删除 D-8 旧 workspace 相关代码（路径校验 / mkdir / 删除等）
- [ ] 删除 v0 Seed 中的 `#general` 自动创建逻辑
- [ ] 删除 GET /api/agents/:id/workspace 端点
- [ ] 在 `packages/server/src/db/seed.ts` 中加入"启动时检测旧 schema 并友好提示"：如果检测到旧 `channels` 表但缺 `project_id` 字段，日志输出 `⚠ Detected v0 schema, please rm ~/.slark/slark.db and restart`，然后退出（不自动删，让用户手动确认）
- [ ] 文档同步：technical-decisions.md D-8 / D-9 按 product-brief v1.0 改写

### 1.5 Sprint 1 验收清单

```
# === Schema 与基础数据 ===
- [ ] 启动 Slark，~/.slark/slark.db 自动创建（projects/agent_runs 表存在）
- [ ] 旧 agents.status 字段已删除
- [ ] 旧 ~/.slark/agents/ 目录不再创建
- [ ] 首次启动 Web UI 显示 Welcome 页（不再有 #general）

# === Create Project 三步向导 ===
- [ ] Step 1：Name / Workspace / Goal 必填校验生效，Goal 超 500 字符报错
- [ ] Step 2：5~10 秒内显示 Team Suggestion 卡片（≥3 个 Agent）
- [ ] Step 2 兜底：手动改名 cursor-agent 路径模拟未安装 → 走兜底默认 + 黄色提示
- [ ] Step 3：自动跳转到 /p/{name}/channel/general，#general 频道存在，所有 Agent 加入
- [ ] 数据库验证：projects / channels / agents / channel_agents 都按预期插入

# === 路由 ===
- [ ] /p/{name}/channel/{id} 可访问对应频道
- [ ] /p/{name}/dm/{id} 可访问对应 DM
- [ ] / 在无 Project 时显示 Welcome
- [ ] / 在有 Project 时跳转到第一个 Project 的 #general
- [ ] Sidebar Project 切换器切换后整个左侧 + 主区刷新

# === 隔离修复（K-1/K-3/K-4）===
- [ ] 创建 2 个 Project（Slark / Blog），各自带 1 个同名 Architect
  - Architect@Slark 的 spawn cwd = Slark workspace_path
  - Architect@Blog 的 spawn cwd = Blog workspace_path
  - 在 Slark 项目里 ls 能看到 Slark 源码，在 Blog 项目里 ls 能看到 Blog 源码
- [ ] 在两个 Project 的 #general 同时 @ 各自 Architect
  - agent_runs 表出现两条 active 记录（不同 channel_id）
  - 两个 Architect 的对话历史完全隔离
- [ ] WebSocket agent_status 事件 payload 含 channel_id
- [ ] StatusDot 派生：Sidebar 显示"任意 channel 在跑"为 working

# === Agent Profile 简化 ===
- [ ] Profile 面板只有 2 Tab：PROFILE / ACTIVITY
- [ ] Activity Tab 有 "filter by channel" 下拉
- [ ] 不再有 WORKSPACE Tab、不再展示 ~/.slark/agents/ 文件树

# === 端到端体验（核心 S-1 验收）===
- [ ] **S-1 计时（Review 2 决议）**：**起点** = 访问 `http://localhost:4178/` 看到 Welcome 页；**终点** = 点击第一条消息的 Send 按钮；**目标** ≤ 3 分钟，由同一个新用户完成（含 Create Project 向导 + Team Approve + @ 输入 + Send）
- [ ] 在 #general 输入 "@Architect 你好"，Architect 状态点变橙 → 流式回复 → 变绿
- [ ] 刷新页面，消息持久
- [ ] 强制 kill cursor-agent 进程，频道出现红色 system 消息
```

---

## Sprint 2: Workflow Framework（甬道落地 - Template 路径）

**目标**: 内置 3 个 Workflow 模板，用户 `/new-feature` 等指令可驱动整个 thread 按 step 自动推进。

**战略价值**: Slark 从"聊天室"跃升为"工作流引擎"。

**预估工期**: 6~8 工作日

### 范围

- [ ] Schema：`workflows` / `workflow_runs` 表
- [ ] YAML 解析器（含 step 引用 / on_complete / on_approve / on_reject 路由）
- [ ] Workflow Runner（执行引擎）
  - 状态机：running / completed / aborted / failed
  - 单步执行 → 等结果 → 推进下一步
  - 超时 / kill / abort 处理
- [ ] 3 个内置模板：`feature-development` / `bug-fix` / `research`
  - 模板首次进入 Project 时自动 import（或按需 import）
- [ ] Channel 输入框支持 `/command` 检测 → 触发 Workflow Runner
- [ ] Thread 内 Workflow 进度可视化
  - 顶部进度条："Step 2/5: implement → @Dev-Backend"
  - 已完成步骤打勾 + Agent 头像
  - 当前步骤高亮
- [ ] Responsibilities 简化版：从 YAML 自动推导 executor，写入 `responsibilities` 表（schema 见 Sprint 3）

### 待决议

- Q-4：Workflow YAML 的版本控制 → 建议默认存 SQL + 提供 Export

### 验收（关键）

- [ ] 在 Slark 频道输入 `/new-feature add OAuth`
- [ ] 自动创建 thread，进度条显示 "Step 1/5: design → @Architect"
- [ ] Architect 完成方案后，自动等用户 Approve（thread 内出现 Approval Card）
- [ ] 用户点 Approve → 自动 @Dev-Backend，进入 Step 3
- [ ] Dev-Backend 完成后自动 @Reviewer
- [ ] Reviewer reject → 回到 implement step（进度条回退）
- [ ] Reviewer approve → done step → thread 自动归档

---

## Sprint 3: Responsibility + User Intervention

**目标**: Workflow 中用户可以随时介入、批准、拒绝、override；Workflow 可以导入导出。

**战略价值**: AI 团队**有边界、可控、可审计**。

**预估工期**: 4~5 工作日

### 范围

- [ ] `responsibilities` 表（按 product-brief D-5）
- [ ] Approval Flow：`await_approval` step 的 UI 卡片 + 自动 Notification
- [ ] Slark 内联指令协议（参考 `clawteam-comparison.md` B-2）：
  - `/approve` / `/reject` / `/abort` / `/override` / `/comment`
  - 后端 message-router 解析指令 → 路由到 workflow_runs 状态机
- [ ] Inbox 视图（待批准动作汇总）—— 可选 P1
- [ ] Workflow YAML Import / Export（文件下载 + 上传）

### 验收

- [ ] 用户可以中断正在运行的 Workflow（`/abort`）
- [ ] 用户可以在 await_approval step 输入反馈再 reject（`/reject 这里需要补充错误处理`）
- [ ] reject 时反馈作为下一轮 spawn 的额外 context 注入
- [ ] Workflow Export 出 YAML，Import 回另一个 Project 后能正常运行

---

## Sprint 4: Delivery Loop（Scribe 沉淀）

> **Review 3 拆分说明**：原 v1.0 初稿把 Scribe + Facilitator 捆在一个 Sprint，工期严重低估。v1.0.1 拆分：本 Sprint 只做 Scribe 及配套沉淀能力；Facilitator（Team-First-Collaborative）独立成 **Sprint 7**。

**目标**: 每个 Workflow Run 结束后自动沉淀 decisions / lessons 到项目知识池。

**战略价值**: 项目知识资产**自动积累**，Slark 成为项目知识的管理后台。

**预估工期**: 5~7 工作日

### 范围

- [ ] **Scribe System Agent**
  - 触发：Workflow Run 完成 / Thread 解决 / 用户手动 `/sediment`
  - 实现：spawn 一个特殊 prompt，输入完整 thread + tool_calls
  - 输出：JSON 数组 `[{ kind, title, body, audience, source_message_id, confidence }]`
- [ ] `decisions` / `lessons` 表（按 product-brief 的两个表设计）
- [ ] Project 新增 **Intelligence Tab**（与 CHAT/TASKS Tab 平级）
  - Pending Review 队列（Scribe 待审批的条目）
  - Knowledge Base 浏览（按 kind / audience / tags 过滤）
  - Decisions 时间线
- [ ] ContextBuilder 升级：按 audience + 关键词过滤注入 lessons / decisions（token 预算内）

### 待决议

- Q-5：System Agent token 配额
- Q-7：lessons 是否跨 Project 共享

### 验收

- [ ] 跑完一个 `/new-feature` 后，Intelligence Tab 出现 Pending Review 条目
- [ ] 条目内容合理（不是空话或重复 description）
- [ ] Approve 后 lessons 表有数据
- [ ] 下次 spawn 同 audience 的 Agent 时，prompt 里能看到注入的 lesson

---

## Sprint 5: Evolution Loop（Agent 成长）

**目标**: Agent description 会随时间演化，团队越用越强。

**战略价值**: 达成 S-6 成功标准 —— "连续使用 3 个月后 Agent 团队交付质量提升"。

**预估工期**: 5~7 工作日

### 范围

- [ ] **Evaluator System Agent**（后台定期）
  - cron：每 24h 一次（可配）
  - 输入：每个 Agent 最近 N 个 task 的产出（messages + tool_calls）
  - 输出：`agent_observations` 表（待机制确定）
- [ ] **Coach System Agent**（提建议）
  - 触发：Evaluator 发现 ≥3 次同类问题
  - 输出：`agent_feedback` 表，含建议的 description diff
- [ ] Agent Profile 新增 **FEEDBACK Tab**
  - 列出 Coach 历史建议（pending / applied / rejected）
  - 每个建议带 description 的前后 diff
  - [Apply] 按钮 → 实际更新 `agents.description` + 标记 applied
  - [Reject] 按钮 → 标记 rejected
- [ ] Apply 后的回滚机制（保留 diff 历史，可逆）

### 待决议

- Q-6：Apply 后能否回滚 → 决议建议 "能"

### 验收

- [ ] 制造场景：让一个 Agent 连续 3 次回复都漏掉某要素
- [ ] 24h 后 Agent Profile FEEDBACK Tab 出现 Coach 建议
- [ ] Apply 后 agents.description 实际更新（数据库验证）
- [ ] 下次 spawn 时新 description 生效（验证回复行为）
- [ ] Apply 后能 Rollback 到原版本

---

## Sprint 6: Onboarding Loop + Skill Matrix

**目标**: 新 Project 自动生成 onboarding 包；Agent 能力地图自动维护。

**预估工期**: 5~7 工作日

### 范围

- [ ] **Onboarder System Agent**
  - 触发：Create Project 后第一个 Agent spawn 前
  - 输入：workspace_path 下的 README.md / package.json / git log 最近 N commit
  - 输出：`project_onboarding` 表（overview / tech_stack / conventions）
  - Onboarding 卡片在 Welcome 页 / Channel Header 处可见
- [ ] `agent_skills` 表（按 product-brief）
  - tool_call 后自动统计该 Agent 在哪些目录 / 模块下工作过
  - 触发：每次 tool.completed 事件
- [ ] Create Task 智能推荐 assignee
  - 用户输入 task title → 服务端关键词匹配 agent_skills.skill_key
  - assignee 下拉默认排序：匹配度高的在前

### 验收

- [ ] 在一个真实 git 仓库（非 Slark 自身）创建 Project，Onboarding 卡片正确显示技术栈
- [ ] 让 Agent 在 src/auth/ 下读写多次后，agent_skills 表有 'auth/' 记录
- [ ] Create Task 输入 "fix auth bug"，assignee 下拉自动推荐之前在 auth/ 工作的 Agent

---

## Sprint 7: Team-First-Collaborative Workflow Design（Facilitator）

> **来源**：v1.0 v0.3 初稿把 Facilitator 放在 Sprint 4 同步做，Review 3 拆分后独立成 Sprint。

**目标**: Team 成员能自己讨论出 Workflow，不依赖 Template。这是 Slark 相对 slock.ai / Cursor / ClawTeam 的**核心差异化能力**。

**战略价值**: Slark "Programmable AI Team OS" 最独特的机制落地，护城河从"可用"升级为"独一无二"。

**预估工期**: 6~8 工作日

### 范围

- [ ] **Facilitator System Agent**
  - 设计 + prompt 工程 + 输出 YAML 的稳定性验证（比 Scribe 难，需要多轮迭代对话）
  - 触发：**手动触发**（Q-8 决议，自动触发延后）
- [ ] "Create Workflow from Team Discussion" 入口（Sidebar / Project Settings）
- [ ] Workflow Design Session 对话流
  - Session thread 独立（不混入普通 channel，避免干扰）
  - 串行 spawn 各 Team 成员发表协作意见
  - Facilitator 综合成 YAML draft
- [ ] Session 结束后 YAML draft 用户 Approve → 写入 `workflows` 表
- [ ] 失败降级：Facilitator 卡住或用户 Reject → 提示"请使用 Sprint 2 Template 路径"

### 待决议

- Q-8：Facilitator 触发方式（决议已定：手动）
- 新增 Q-9（Sprint 7 启动前拍板）：Session 最大时长 / 最大 token 消耗？

### 验收

- [ ] 用户点 "Create Workflow from Team Discussion" → 进入 Session thread
- [ ] Facilitator 主持 Team 讨论（5~15 分钟内收敛）
- [ ] 产出 YAML draft 且可解析（YAML 语法正确）
- [ ] 用户 Approve 后 `workflows` 表多一条记录
- [ ] Reject 后 Session thread 归档，不污染 project 知识池

---

## Sprint 8+: 远期路线

按 product-brief.md §7 (P2 R-18~R-25) + `docs/clawteam-comparison.md` B-N 排序：

| 项目 | 描述 | 优先级 |
|-----|------|--------|
| **R-18** Codex / Claude Code 多 runtime 适配 | 接入 Codex / Claude / Kimi / Copilot / Gemini Adapter | 🟡 中 |
| **R-19** 跨 Project 全局视图 | `/threads` / `/tasks` / `/saved` Kanban | 🟡 中 |
| **R-20** Team Memory（Project 级 ground rules）| 用 lessons 表已半实现 | 🟢 低 |
| **R-21** Agent / Workflow Template Marketplace | 用户可分享 Workflow YAML / Team Template | 🟢 低 |
| **R-22** `.slark/team.yaml` Project 级 Agent 定义 | git 可追踪 | 🟢 低 |
| **R-23** Electron / Tauri 打包 | 桌面应用 + 系统托盘 | 🟢 低 |
| **R-24** Agent 之间主动 DM | 非 @mention 触发 | 🟢 低 |
| **R-25** Project 拖拽排序、收藏、归档 | UX 打磨 | 🟢 低 |
| **B-1** Worktree 多 Agent 隔离（见 clawteam-comparison §5）| 解决 K-5 / W-1 | 🔴 高（多 Agent 真正并发改代码时必须） |
| **B-3** 任务依赖图（`blocked_by`）| Task 之间显式依赖 + 自动 unblock | 🟡 中 |
| **B-6** Tiled Live View（多 Agent 并排实时输出）| Slark 相对 ClawTeam 的差异化机会 | 🟡 中 |

---

## 关键技术决策（保留 / 更新）

- **为什么不用 MCP**: 本地场景直接 spawn CLI 比 MCP 更简单直接
- **为什么用 SQLite**: 零配置单文件，适合本地应用
- **为什么用 WebSocket**: 需要双向通信（发消息 + 流式响应 + 状态更新）
- **为什么用适配器模式**: 不同 CLI 接口差异大，适配器解耦核心逻辑
- **为什么 spawn-per-message**: CLI 工具原生设计就是单次执行，不支持持续对话
- **为什么 Agent 无独立 workspace（v1.0 修订）**: 聚焦编程协作 + 不接自主学习型 Agent，记忆通过 ContextBuilder 注入 + Coach 演化 description 承载
- **为什么 Workflow 用声明式 YAML**: 类比 GitHub Actions，工程师友好；同时为 Sprint 4 的 "Team 协同设计 Workflow" 留下"Facilitator 输出 YAML"的标准接口
- **为什么 Project 是一等公民（v1.0 修订）**: Server = Project 是 slock.ai 原版的等价语义；多 Project 并发时上下文 / Tasks / Knowledge 都按 Project 隔离

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 ~ v0.3 | 2026-04-22 | 原 4 Phase / MVP-1~9 结构（v0 MVP 已交付） |
| **v1.0** | 2026-04-23 | **按 product-brief.md v1.0 重写**：保留 Phase 0/0.5；折叠 v0 MVP 为已交付清单；展开 Sprint 1~6 Programmable AI Team OS 路线；Sprint 1 详细任务与验收落地 |
| v1.0.1 | 2026-04-23 | 同步 product-brief v1.0.1 Review 决议：Sprint 1 工期改 8~12 天弹性；加删库 + Welcome→Send 验收；§1.2.5 补兜底三件套；Sprint 4 拆分出 Sprint 7 Facilitator；实施路线总览加 Sprint 启动前 checklist |
