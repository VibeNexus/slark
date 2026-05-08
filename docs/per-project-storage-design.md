# Per-Project Storage 设计文档

> **状态**：设计中（未实施）
> **预估工期**：~9 工作日（Sprint A 3d + B 3d + C 3d）
> **关联决策**：`D-13`（Project 一等公民）/ `S-5`（数据本地化）/ `D-18`（per-channel 状态派生）/ `D-1`（Agent 状态派生）
> **新增决策**：`D-21` ~ `D-25`（见 §11）
> **新增待决议**：`Q-10` ~ `Q-14`（见 §12）
>
> 本文档对应分支 `feat/per-project-storage`，未合到 `main`。

---

## 1. 背景与动机

### 1.1 现状（截至 commit `0e3d7bf`）

```
~/.slark/
├── slark.db          ← 单一 SQLite，全部 projects/channels/agents/messages/
│                       tasks/workflows/decisions/lessons/agent_observations/
│                       agent_feedback/project_onboarding/agent_skills/
│                       workflow_sessions（所有 13 张表都在这里）
├── settings.json     ← 用户级配置（API key / backend）
└── (no per-project storage)
```

所有项目数据共享一个全局 SQLite。`projects.workspace_path` 字段记录代码仓库路径，
但代码仓库本身**完全不知道 Slark 的存在**。

### 1.2 问题

| # | 问题 | 表现 |
|---|------|------|
| P-1 | 项目和数据耦合在 mac 本地 | 换机器丢全部 AI 团队 / 沉淀 |
| P-2 | 团队不能共享 AI 协作设定 | 队友 clone 仓库后看不到任何 agent / lessons |
| P-3 | 删项目不直观 | 必须走 UI Danger Zone API；删仓库后 db 仍残留孤儿数据 |
| P-4 | 心智模型与 Cursor IDE 不一致 | Cursor "open folder" → 配置自然挂；Slark 现在要去 ~/.slark 找 |
| P-5 | 跨用户协作没基础 | 即使后续上 Marketplace，也没有"一份团队定义文件可分享"的概念 |
| P-6 | 知识沉淀不可读 / 不可 diff | `lessons` / `decisions` 在二进制 db 内，git 不可见 |

### 1.3 目标

**与 Cursor IDE "open folder → 配置自然出现" 心智对齐**：项目特有的数据写在
`<workspace>/.slark/`，全局只保留用户级偏好（API key、recent projects）。

---

## 2. 目标态结构

### 2.1 文件布局

```
~/.slark/                           # 用户级（保持现状 + 一个新文件）
├── settings.json                   # ← 现有（Cursor backend / API key）
└── projects.json                   # ← 新：用户开过哪些 project（recent list）

<workspace_path>/.slark/            # ★ 项目级（全部新增）★
├── project.json                    # 元数据：name / display_name / goal / team_rules / color / created_at
├── slark.db                        # SQLite：channels/agents/messages/tasks/workflows/runs/responsibilities
├── knowledge/                      # 推荐入 git，团队共享
│   ├── decisions.jsonl             # 决策记录（append-only）
│   ├── lessons.jsonl               # 经验教训
│   └── onboarding.json             # README/git log 自动总结
├── observations/                   # 不入 git，包含个人对话历史片段
│   ├── agent_observations.jsonl
│   └── agent_feedback.jsonl
├── skills/
│   └── agent_skills.json
└── .gitignore                      # 自动写：slark.db / observations/
```

### 2.2 推荐 git 策略

| 路径 | 入 git | 说明 |
|------|--------|------|
| `<workspace>/.slark/project.json` | ✅ | Goal / display_name / team_rules — 团队定义 |
| `<workspace>/.slark/knowledge/*.jsonl` | ✅ | 沉淀的经验，团队共享 |
| `<workspace>/.slark/onboarding.json` | ✅（可选）| 团队对项目的共同认知 |
| `<workspace>/.slark/skills/*.json` | ⚠️ 可选 | 偏个人使用习惯 |
| `<workspace>/.slark/slark.db` | ❌ | 含个人对话历史 / private message |
| `<workspace>/.slark/observations/` | ❌ | 包含 evaluator 对个人消息的判断 |
| `<workspace>/.slark/messages/` | ❌ | 个人聊天历史（如果未来移出 db） |

`.slark/.gitignore` 自动生成，列出不该入库的项；用户可改。

---

## 3. 数据归属决策表

**核心表 → 存放位置**：

| Table | 现状 | 改造后 | 理由 |
|-------|------|--------|------|
| `projects` | 中心 db | **移除 SQL 表**；改用 `<workspace>/.slark/project.json` | Project 即文件夹本身；不需要 SQL 行 |
| `channels` | 中心 db | per-project SQLite | 频道隔离 project |
| `channel_agents` | 中心 db | per-project SQLite | 关联表跟着 project 走 |
| `agents` | 中心 db | per-project SQLite | Agent 跟 project 走（已是事实，前面跨 project bug 修复后明确）|
| `messages` | 中心 db | per-project SQLite | 个人对话历史，不入 git |
| `tasks` | 中心 db | per-project SQLite | 任务跟 project |
| `agent_activity` | 中心 db | per-project SQLite | 活动日志 |
| `agent_runs` | 中心 db | per-project SQLite（短时态）| 运行时状态 |
| `workflows` | 中心 db | per-project SQLite + `knowledge/workflows/*.yaml`（双源）| YAML 是事实来源，db 仅用于查询 |
| `workflow_runs` | 中心 db | per-project SQLite | 执行记录 |
| `responsibilities` | 中心 db | per-project SQLite（从 YAML derive） | derive 出的 cache |
| `decisions` | 中心 db | `knowledge/decisions.jsonl` | append-only，git 友好，可 diff |
| `lessons` | 中心 db | `knowledge/lessons.jsonl` | 同上 |
| `agent_observations` | 中心 db | `observations/agent_observations.jsonl` | 含 source_message_id 引用，不入 git |
| `agent_feedback` | 中心 db | per-project SQLite | Coach 提案 |
| `project_onboarding` | 中心 db | `knowledge/onboarding.json` | 单条记录；可入 git |
| `agent_skills` | 中心 db | `skills/agent_skills.json` | 单文件 JSON |
| `workflow_sessions` | 中心 db | per-project SQLite + Facilitator 产出 YAML 落 `knowledge/workflows/` | session 是过渡态，YAML 是产物 |

**关键判断**：
- **JSONL append-only** vs **SQLite 行**：高频改 / 索引复杂 → SQLite；低频改 / 顺序读 / git diff 友好 → JSONL
- **JSON 单文件** vs **JSONL**：单条 / 整体覆写场景 → JSON；多条 / 增量 append → JSONL

### 3.1 全局 `~/.slark/projects.json` 内容

```json
{
  "version": 1,
  "recent": [
    { "path": "/Users/kaikxiao/aiproject/finClaw", "lastOpened": 1778246924575 },
    { "path": "/Users/kaikxiao/code/slark",        "lastOpened": 1778160047882 }
  ]
}
```

- 仅记录"用户开过的项目路径"+ 最后访问时间
- 用于 Sidebar Switcher 显示项目列表（不再从 SQL `projects` 表读）
- Open Project Dialog 时追加；Delete Project 时从此移除
- 项目本身的元数据（name / display_name / goal）从 `<path>/.slark/project.json` 读

---

## 4. 关键挑战与解决方案

### 4.1 全局视图聚合（`/inbox` `/threads` `/tasks`）

**问题**：当前 `/inbox` 端点跨 project 聚合所有 awaiting_approval 的 workflow runs，
SQL 一条 query 搞定；改成 per-project SQLite 后必须**遍历所有打开的项目**。

**解决方案**：

```
启动期：
  → 读 ~/.slark/projects.json 拿到所有项目路径
  → 对每个 path 打开 <path>/.slark/slark.db（SqliteConnectionPool）
  → 维护"打开的项目"映射 ProjectId → DbHandle

GET /api/inbox：
  → for each open project:
       SELECT * FROM workflow_runs WHERE status IN ('awaiting_approval', 'running')
  → 合并 + 按时间排序返回

WebSocket 推送：
  → 每个 project 内部 hub 仍然 per-channel
  → 全局事件（如 inbox 状态变化）broadcast 到所有订阅 inbox 的 client
```

**性能预估**：用户开 10 个项目 → 10 次 SQL query，每次 < 5ms → 总开销 < 50ms。可接受。

### 4.2 数据迁移工具

**输入**：`~/.slark/slark.db`（含所有 project 数据）
**输出**：`<each_project.workspace_path>/.slark/{project.json, slark.db, knowledge/, ...}`

**算法**：

```
1. 读 ~/.slark/slark.db
2. SELECT * FROM projects → 拿到 path 列表
3. for each project p:
   a. mkdir -p p.workspace_path/.slark/knowledge p.workspace_path/.slark/observations
   b. 写 p.workspace_path/.slark/project.json (从 projects 行)
   c. 创建 p.workspace_path/.slark/slark.db
   d. 跨 db ATTACH + INSERT SELECT WHERE project_id = p.id 拷贝相关行
      （channels / agents / messages / tasks / workflows / workflow_runs /
       responsibilities / agent_feedback / workflow_sessions / agent_runs / agent_activity）
   e. 把 decisions / lessons 写成 knowledge/*.jsonl
   f. 把 agent_observations 写成 observations/*.jsonl
   g. 把 agent_skills 写成 skills/agent_skills.json
   h. 把 project_onboarding 写成 knowledge/onboarding.json
   i. 写 .slark/.gitignore
4. 备份原 db 为 ~/.slark/slark.db.backup-<timestamp>
5. 写 ~/.slark/projects.json 列表
6. 启动 server（PerProjectStorage 模式）→ 验证可读
```

**安全保障**：
- 备份文件不删，用户可手动回滚到 CentralStorage 模式
- 迁移失败不动原 db
- 提供 `slark migrate-to-per-project --dry-run` 先看会做什么

### 4.3 ProjectStorage 抽象（Sprint A 核心）

把"读写哪张表"的逻辑抽出到接口，主代码只依赖接口。

```typescript
// packages/server/src/storage/types.ts
export interface ProjectStorage {
  /** 打开 / 创建 project，返回所有相关 repo */
  openProject(workspacePath: string): Promise<ProjectHandle>;
  /** 关闭 project（释放 db handle） */
  closeProject(projectId: string): Promise<void>;
  /** 列出所有可访问的 project */
  listProjects(): Promise<ProjectMeta[]>;
  /** 删除 project（per-project storage = rm -rf .slark/） */
  deleteProject(projectId: string): Promise<void>;
}

export interface ProjectHandle {
  projectId: string;
  meta: ProjectMeta;
  // repo 接口与现状保持一致，只是底层切换
  channelRepo: ChannelRepo;
  agentRepo: AgentRepo;
  messageRepo: MessageRepo;
  // ...
  knowledgeRepo: KnowledgeRepo; // 替代 decisionRepo + lessonRepo
}

// 实现 1：当前的中心 db（CentralStorage）
export class CentralProjectStorage implements ProjectStorage { ... }

// 实现 2：新方案
export class PerProjectStorage implements ProjectStorage { ... }
```

**Feature flag**：环境变量 `SLARK_STORAGE=central|per-project`（默认 `central`），
切换 PerProjectStorage 默认前提是迁移工具跑过。

### 4.4 多 db 并发 / 句柄管理

**问题**：用户同时开 N 个项目 → N 个 SQLite 句柄。better-sqlite3 是同步的，
N 大时打开/关闭开销叠加。

**解决方案**：
- 句柄池（Map<projectId, Database>），LRU 淘汰，max=20
- 用户切换 Project 时 lazy open；30 分钟未访问 close
- 全局视图查询临时 open + 用完立刻 close（不进 LRU）

### 4.5 同名项目（重名 slug）

**问题**：用户 open `/path/a/myproj` 和 `/path/b/myproj`，两个 `project.name='myproj'`。

**解决方案**：
- `name` 不再要求全局唯一（D-13 修正版）
- URL 路由 `/p/:projectName` 改为 `/p/:projectId`（不友好）→ 或保留 name + 重名时自动加后缀（保持 OpenProjectDialog 现有 ensureUniqueName 行为）→ **暂不改 URL 结构**，open 时检测 ~/.slark/projects.json 重名追加 `-2`
- per-project storage 内部用 `projectId`（nanoid）做主键，name 仅展示用

### 4.6 settings 全局 vs 项目隔离

| 字段 | 归属 |
|------|------|
| Cursor backend (cli/sdk) | 全局 `~/.slark/settings.json` ← 已有 |
| `CURSOR_API_KEY` | 全局 |
| `agent.thinking` `agent.context` `agent.model` | per-project（agents 表） |
| Project goal / team_rules | per-project (`project.json`) |
| Recent projects 列表 | 全局 `~/.slark/projects.json` |

### 4.7 `lessons` / `decisions` JSONL 格式

```jsonl
{"id":"L-001","kind":"convention","audience":"all","title":"Always wrap async with try/catch","body":"...","source_run_id":12,"review_status":"approved","created_at":1778160000000,"used_count":3}
{"id":"L-002","kind":"gotcha","audience":"backend","title":"...", ...}
```

- append-only，每行一个 JSON 对象
- `id` 改为字符串（`L-001` / `D-001`）方便 git 看 diff
- review_status 修改 = append 一行 `{"id":"L-001","review_status":"approved","at":...}`（事件流），最终态由读取时 fold 决定
- 或 simpler: 直接覆盖整个文件；牺牲 diff 友好换简单实现 — **建议简化版**

---

## 5. API / 路由变化

### 5.1 移除的 API

```
DELETE /api/projects/:id   →  改为 "close project"（从 ~/.slark/projects.json 移除）
                              真正删除 = 用户手动 rm -rf <workspace>/.slark/
                              （或保留但额外 confirmation："This will delete .slark/ in
                              your workspace folder. Continue?"）
```

### 5.2 新增 / 修改的 API

```
POST /api/projects/open
  body: { workspace_path: string }
  → 检查 <path>/.slark/ 是否已存在
  → 存在：读 project.json + 加入 ~/.slark/projects.json recent
  → 不存在：mkdir + 初始化（写 project.json + slark.db schema + .gitignore）
  → 返回 Project

POST /api/projects/close
  body: { project_id }
  → 仅从 recent 列表移除 + 关 db handle；磁盘文件保留

GET /api/projects
  → 从 ~/.slark/projects.json 读 recent paths
  → for each path: 读 .slark/project.json
  → 返回数组（含 metadata）

PATCH /api/projects/:id
  → 写 <workspace>/.slark/project.json
```

### 5.3 ChannelHeader / Sidebar / 全局视图

API 表面**不变**（仍是 `/api/channels`、`/api/agents` 等），只是底层 storage 切换；
前端代码理论上零改动。

---

## 6. Sprint 拆解

### Sprint A — Storage 抽象（3d）

**目标**：抽出接口，CentralStorage 与 PerProjectStorage 并存，feature flag 切换。
**不破坏功能**：默认 central，所有现有测试通过。

任务：
1. `packages/server/src/storage/types.ts` — 接口定义
2. `packages/server/src/storage/central.ts` — 把现有 `db/repos.ts` 包装成 CentralStorage
3. `packages/server/src/storage/per-project.ts` — 实现 PerProjectStorage（首版仅
   project.json + slark.db，knowledge/observations 后置）
4. `index.ts` 启动期根据 `SLARK_STORAGE` 选实现注入到所有 routes
5. 单元测试（如果有时间）：两个实现跑同一组用例

**验收**：`SLARK_STORAGE=per-project pnpm dev` 能启动空 server；
`POST /api/projects/open` 能在 `<path>/.slark/` 创建文件夹 + project.json + slark.db。

### Sprint B — Migration + Per-Project 默认（3d）

**目标**：现有 `~/.slark/slark.db` 用户能一键迁移到 per-project；新用户默认走 per-project。

任务：
1. `packages/server/scripts/migrate-to-per-project.ts` — 数据迁移脚本（含 dry-run）
2. 启动期检测：如果 `SLARK_STORAGE=per-project` 且 `~/.slark/slark.db` 存在 +
   `~/.slark/projects.json` 不存在 → 提示用户跑 migration（或 server 拒绝启动 + 给清单）
3. WelcomePage / OpenProjectDialog 走新流程：检测 `<path>/.slark/` 已存在 → 复用；否则新建
4. settings.json 加 `"storage": "per-project"`，server 启动时读取
5. 文档：在 README + cursorsdkadapter.md / project-status.md 写迁移指南

**验收**：现有 finClaw + 测试 project 数据成功迁移到各自仓库；可正常打开使用；旧 db backup 完好。

### Sprint C — 全局视图聚合 + Knowledge JSONL + git 集成（3d）

**目标**：把 `decisions` / `lessons` 等 knowledge 表迁到 JSONL；`/inbox` `/threads` `/tasks`
跨 project 聚合；自动写 `.gitignore`。

任务：
1. `KnowledgeStore` 实现（JSONL 读写 + indexBuild）
2. `/api/inbox` `/api/threads` `/api/tasks` 改为遍历 open projects 聚合
3. WS 全局事件 broadcast（inbox 变化等）
4. `<workspace>/.slark/.gitignore` 自动写入 + 提示用户提交 `project.json` / `knowledge/`
5. `.slark/README.md` 自动生成解释结构（用户打开仓库能看懂）
6. ProjectSettingsPage Danger Zone 改为"Close project (keep .slark/)" + "Delete .slark/"

**验收**：
- 完整端到端：open folder → 写 .slark/ → build team → @ agent 对话 → workflow trigger →
  `/inbox` 看到 → `/sediment` 写 lessons.jsonl → git diff 能看到改动
- 全局视图（`/inbox`）正确聚合多个 open project 的数据

---

## 7. 暂缓 / 下一阶段

| 项 | 原因 |
|---|------|
| 多人协作合并冲突的高级处理（CRDT / OT） | JSONL append-only + last-write-wins 已经够用 |
| 加密 `slark.db`（含个人对话）| Slark S-5 数据本地化不强制加密；如需 → 系统级 FileVault 即可 |
| Marketplace 共享 .slark/ 模板 | Sprint D+ 议题 |
| 与 Cursor IDE / VS Code 插件集成 | 需要 IDE extension SDK，远期 |

---

## 8. 风险评估

| # | 风险 | 严重度 | 应对 |
|---|------|--------|------|
| R-1 | 迁移脚本 bug 导致数据丢失 | 🔴 高 | dry-run + 备份 + 详细 log |
| R-2 | 多 db handle 句柄爆炸 | 🟡 中 | LRU 句柄池 + 30min idle close |
| R-3 | 全局视图性能下降 | 🟡 中 | 性能测：10 project / 1000 messages 每个 → < 100ms |
| R-4 | 用户已 git push 中心 db backup → 隐私泄露 | 🟢 低 | `.slark/.gitignore` 默认排 slark.db；文档强提示 |
| R-5 | 多 server 实例打开同 project（远期 cloud） | 🟢 低 | SQLite WAL + per-process lock；MVP 不考虑 |

---

## 9. 与现有决策的关系

### 9.1 影响 / 修订的决策

- **`D-13` Project 一等公民** → **修订**：Project 不再是中心 db 的一行，而是文件夹 +
  `<path>/.slark/`；`project_id` 仍存在但来自 `project.json`
- **`D-1` Agent 状态从 agent_runs 派生** → 不变（agent_runs 表挪到 per-project db）
- **`D-18` per-channel 状态** → 不变
- **`D-15` System Agent 共享约束** → 不变（System Agent 不存 db；prompt 是代码常量）
- **`D-20` 四大运营闭环** → 不变（数据存哪不影响 loops 语义）
- **`S-5` 数据本地化** → 强化（不仅本地，还跟着代码仓库走）

### 9.2 新决策（D-21~D-25）

| # | 决策 | 备注 |
|---|------|------|
| **D-21** | 项目数据归属：所有项目特有数据存 `<workspace>/.slark/`，不再共享中心 db | 见 §3 表 |
| **D-22** | 全局只保留用户偏好（`~/.slark/settings.json`）+ recent projects 列表（`~/.slark/projects.json`）| 见 §2 |
| **D-23** | knowledge 用 JSONL（`decisions` / `lessons`）+ JSON（`onboarding` / `skills`）；运行时数据用 SQLite | git 友好 |
| **D-24** | `.slark/slark.db` 默认不入 git；`.slark/project.json` + `.slark/knowledge/` 默认入 git | `.gitignore` 自动生成 |
| **D-25** | name 全局不再唯一；`projectId`（nanoid）是真正主键，name 仅展示 + URL 槽 | 重名 OpenProjectDialog 自动 `-2` |

---

## 10. 待决议（Q-10~Q-14）

| # | 议题 | 选项 | 倾向 |
|---|------|------|------|
| **Q-10** | `messages` 是否也搬到 JSONL（不止 db）| (a) 仅 db；(b) db + 导出 JSONL；(c) 直接 JSONL | (a) — 高频写 / 索引需求 db 占优 |
| **Q-11** | 删 Project 默认行为 | (a) 仅从 recent 移除（保留 `.slark/`）；(b) 提示是否删 `.slark/`；(c) 直接删 | (b) — 二次确认明示 |
| **Q-12** | URL `/p/:projectName` 重名怎么处理 | (a) 保留 name + 重名 -2 后缀；(b) 改 `/p/:projectId` | (a) — 保持当前 UI |
| **Q-13** | `project.json` 是否含 `lastOpened`（个人化）| (a) 含；(b) 仅 `~/.slark/projects.json` 维护 | (b) — 项目级文件应共享，个人时间戳分开 |
| **Q-14** | 同一仓库被两个用户开 | (a) 不处理（双方各自有 .slark/，但 git 会冲突）；(b) 提示 .slark/.gitignore；(c) 远期支持 sync | (b) — MVP 提示即可 |

---

## 11. 实施前最终 checklist

- [ ] Q-10 ~ Q-14 全部决议（user signoff）
- [ ] 备份现有 `~/.slark/slark.db` 到 `~/.slark/slark.db.backup-<date>`
- [ ] feature/per-project-storage 分支已开（已完成 ✓）
- [ ] 文档同步到 `docs/project-status.md` Sprint 标记（待 Sprint A 启动时）
- [ ] `docs/technical-decisions.md` D-21 ~ D-25 增补（待 Sprint A 启动时）

---

## 12. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-05-08 | 初版设计：背景 / 目标态 / 数据归属表 / Sprint 拆解 / Q-10~14 |
