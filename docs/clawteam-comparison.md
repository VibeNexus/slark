# Slark vs ClawTeam 对比与借鉴清单

> 本文档是 Slark 对竞品 [HKUDS/ClawTeam](https://github.com/HKUDS/ClawTeam) 的横向分析。
>
> **文档层级**：附加分析（非战略 / 非决策），用于后续挑选条目制定改进计划。
>
> **编号规则**：
> - `B-N` = Borrowable idea（可借鉴条目），与 `docs/technical-decisions.md` 的 `D-N`、`docs/product-brief.md` 的 `K-N` 并列。
> - 引用 Slark 现有决策时统一写 `D-1` / `K-5` 等。
>
> **何时读**：
> - 规划下一阶段迭代，需要参考外部最佳实践时
> - 有人提 "为什么 Slark 不做 X" 的时候先对照这里
> - 对比文档过时（ClawTeam 主版本升级）时，回到这里更新 §2 维度对比表

---

## 1. 两个项目的一句话定位

| 项目 | 定位 | 主要使用者 |
|------|------|-----------|
| **ClawTeam** | 一条命令，AI 自己组队——**Leader agent 自主 spawn worker、用 CLI 协调** | **AI agent 自己**（人只下达顶层目标） |
| **Slark** | 本地版 Slack for AI——**用户在频道里 @ AI 员工协作编程** | **人**（在 UI 里发起、@ 触发、看回放） |

关键差异一句话：

> **ClawTeam 是"agent 调用 CLI"，Slark 是"人调用 agent"。**

这个定位差异决定了两者后续所有架构选择，也决定了本文的借鉴方向——**不是把 Slark 变成 ClawTeam，而是把 ClawTeam 已验证的"agent 协作机制"嫁接到 Slark 的"Slack 式 UI"上**。

---

## 2. 维度对比表

| 维度 | ClawTeam | Slark | 谁更强 |
|------|----------|-------|--------|
| 形态 | Python CLI (`pip install`) | Web 应用（前后端 + SQLite） | 看场景 |
| 驱动者 | AI agent 自己 spawn 子 agent | 用户 @mention 触发 | 看场景 |
| 多 agent 代码隔离 | git worktree（每 agent 独立 branch） | `channel.workspace_path` 共享 cwd | **ClawTeam** ⚠ |
| 进程模型 | tmux 长驻交互式 agent | spawn-per-message 短进程（`D-12`） | 看 CLI 性质 |
| 消息传输 | 文件 inbox + ZeroMQ P2P | WebSocket（单机） | ClawTeam（跨机） |
| 持久化 | `~/.clawteam/` JSON 文件 | `~/.slark/slark.db` SQLite（`D-8`） | **Slark**（查询 / 索引） |
| 任务系统 | `--blocked-by` 依赖图 + 自动 unblock | 平铺四态（`todo/in_progress/in_review/done`） | **ClawTeam** |
| 消息沉淀 | inbox 消费即清空 | 持久消息流 + Thread + @mention 链式触发（`D-6`） | **Slark**（人可回看） |
| UI | tmux 平铺 + 简单 Web Board | Neo-Brutalism 暖黄风，1:1 还原 slock.ai | **Slark** |
| 支持 CLI | Claude / Codex / OpenClaw / nanobot / Kimi / Cursor(实验) | 仅 Cursor（MVP）+ 5 占位 | **ClawTeam** |
| 团队模板 | TOML 模板（Hedge Fund 7-agent 一条命令拉起） | 无（每 agent 手动创建） | **ClawTeam** |
| Plan / Lifecycle 协议 | `plan submit/approve/reject`、`lifecycle idle/shutdown` | 无 | **ClawTeam** |
| 协调协议注入 | spawn 时自动告诉 worker "你可以用这些 CLI 命令自报状态" | 无 | **ClawTeam** |
| 多用户 / 跨机 | 多用户命名空间 + 跨机 P2P | 明确不做（`product-brief N-1/N-2/N-8`） | ClawTeam（但 Slark 不要） |
| 心智模型 | 需要懂 tmux + CLI 的工程师 | 任何用过 Slack 的人 | **Slark** |
| 工程设计密度 | 实战驱动，v0.2 + 4.9k star | Phase 0 Spike + 决策编号 + 验收清单完整 | **Slark**（文档） |

---

## 3. Slark 相对 ClawTeam 的优势

保住这些优势，不要在借鉴 ClawTeam 时被抹平：

1. **图形化的人类心智** — Slack 类比一句话讲清楚，比 "tmux + 8 个窗口" 友好得多。这是 ClawTeam 最大的 UX 短板，也是 Slark 最大的长板。
2. **结构化数据层** — SQLite + 7 表 + 索引让全文搜索、Thread 聚合、Tasks 看板这些功能几乎"白送"；ClawTeam 的 JSON 文件做这些要重写。
3. **字符级流式 UI** — 字符级 stream + Markdown + 代码高亮，看 agent 思考过程体验 >> 读 tmux 滚屏。
4. **"绑定代码仓库"语义一等公民** — `channel.workspace_path`（见 `product-brief §7`）让"agent 在真实 repo 工作"天然成立；ClawTeam 的语义是"agent 在自己的 worktree 写代码"。
5. **数字化的工程决策** — Token 预算 `8000/2000/5500/500`、并发 `3+20`、链式防护 `10/3/5` 这些常量都拍板了（`D-4` / `D-5` / `D-6`），ClawTeam 文档里看不到这种约束。

---

## 4. Slark 相对 ClawTeam 的劣势

按严重度排序，编号对应 `§5` 的借鉴条目：

| # | 劣势 | 对应借鉴条目 | 严重度 |
|---|------|------------|--------|
| W-1 | 多 agent 并发改同一 repo 会冲突（两个 Dev 同时写同一个文件互相覆盖） | B-1 | 🔴 高 |
| W-2 | Agent 是被动的，必须用户 / 其他 agent 显式 @ 才会动 | B-2 | 🔴 高 |
| W-3 | 没有团队模板，每个 Agent 都要 UI 里手动建 | B-4 | 🟡 中 |
| W-4 | 没有任务依赖图，多 Agent 工作流要用户手工推进 | B-3 | 🟡 中 |
| W-5 | 只支持 Cursor CLI（MVP），其他 5 个是 placeholder | 参考 `PLAN MVP-4 RUNTIME_REGISTRY` | 🟡 中 |
| W-6 | 没有 Plan Approval 治理，Agent 直接干活容易跑偏 | B-5 | 🟢 低 |
| W-7 | 进程模型偏短（每次重注入 8K 上下文，贵且慢） | B-8 | 🟢 低 |

> 注：W-1 是 `product-brief §8 K-5` 已识别但未给方案的问题，是 **MVP 之后最高优先级要补**。

---

## 5. 可借鉴条目清单（B-N）

每条条目独立描述，包含五部分：
- **ClawTeam 做法**
- **Slark 当前状态**
- **建议落地**（schema / API / UI 三个维度）
- **涉及 Slark 文档的改动**
- **参考优先级 / 风险**

### B-1: Git Worktree 多 Agent 隔离

> 解决 `product-brief §8 K-5` + 劣势 W-1。**本清单中唯一的 🔴 高优先级条目**。

#### ClawTeam 做法

每个 worker agent 一个独立 git worktree，branch 命名 `clawteam/{team}/{agent}`。干完用户决定 merge / discard。

```
clawteam workspace list <team>
clawteam workspace checkpoint <team> <agent>    # 自动 commit
clawteam workspace merge <team> <agent>         # 合回主分支
clawteam workspace cleanup <team> <agent>       # 删除 worktree
```

#### Slark 当前状态

- 所有加入同一工作频道的 Agent 共享 `channel.workspace_path` 作为 cwd
- 两个 Dev Agent 同时 spawn 时改同一个文件会互相覆盖
- `K-5` 标记为 "必须修正的坑" 但 MVP 没给方案

#### 建议落地

**Schema（`packages/server/src/db/schema.sql`）**：

```sql
-- 新增字段
ALTER TABLE channel_agents ADD COLUMN worktree_path TEXT;
ALTER TABLE channel_agents ADD COLUMN worktree_branch TEXT;
ALTER TABLE channel_agents ADD COLUMN worktree_base_commit TEXT;  -- 创建时的 main HEAD
```

**Runner（`packages/server/src/agents/runner.ts`）**：

```typescript
// 当前（伪码）
const cwd = channel.workspace_path ?? defaultAgentSandbox(agent.id);

// 修改为
const cwd = await ensureWorktree(channel, agent) ?? defaultAgentSandbox(agent.id);

async function ensureWorktree(channel, agent): Promise<string | null> {
  if (!channel.workspace_path) return null;
  const existing = await channelAgentRepo.getWorktree(channel.id, agent.id);
  if (existing && fs.existsSync(existing.worktree_path)) return existing.worktree_path;

  const branch = `slark/${channel.slug}/${agent.slug}`;
  const worktreePath = path.join(os.homedir(), '.slark', 'worktrees', channel.id, agent.id);
  await git(channel.workspace_path, ['worktree', 'add', worktreePath, '-b', branch]);
  await channelAgentRepo.setWorktree(channel.id, agent.id, { worktreePath, branch });
  return worktreePath;
}
```

**REST API**：

```
GET    /api/channels/:id/worktrees                 列出该频道所有 agent 的 worktree 状态（含 dirty/clean/diff 统计）
POST   /api/channels/:id/worktrees/:agentId/merge  合并到 workspace_path 的当前分支（fast-forward 或 merge）
POST   /api/channels/:id/worktrees/:agentId/reset  丢弃该 agent 的所有改动，回到 base_commit
DELETE /api/channels/:id/worktrees/:agentId        删除 worktree（保留 branch）
```

**UI（`docs/ui-reference/components.md` 需更新）**：

- Agent Profile → Workspace Tab：已有的目录树下面新增 "Pending Changes in this channel" 区，列出 diff stat（`+12 -3` in `src/foo.ts`）+ "Merge to main" / "Discard" 按钮
- Channel Header：右侧新增 "3 active worktrees" 指示器，点击弹出所有 agent 的 worktree 状态
- Sidebar 工作频道 📁 图标旁可选加 🟡 小标（表示有未合并的 worktree）

**冲突检测**：

- 每次 Agent 执行完，`checkpoint`（`git add -A && git commit -m "slark: checkpoint at {timestamp}"`）
- 显式 Merge 时检测 `git merge-tree` 的冲突，如有则要求用户手动处理

#### 涉及的 Slark 文档改动

- `docs/product-brief.md` §8 K-5 的"修正方案"改写为此条
- `docs/technical-decisions.md` 新增 `D-N: Agent Worktree 生命周期` 决策
- `PLAN.md` MVP-4 的 CLIRunner 章节加 `ensureWorktree` 步骤
- `docs/ui-reference/components.md` Channel Header 和 Agent Profile 加指示器

#### 风险与权衡

| 风险 | 说明 | 备选 |
|------|------|------|
| 用户的 repo 不是 git | `git worktree add` 会失败 | 降级回共享 cwd + 提示用户"多 agent 并发不安全" |
| Agent 产生大量 worktree | 磁盘占用（每个 worktree 是完整 checkout） | 提供 "Clean all idle worktrees" 一键清理；后续可用 `git worktree` 的 `--lock` 机制 |
| merge 冲突 | 两个 Agent 改同一区域 | UI 显示冲突后让用户自己 resolve（不自动合） |
| 用户期望 Agent 直接改 main | 改变了用户心智 | 在 Create Channel 时加"Isolation mode: per-agent worktree / shared cwd" 开关 |

---

### B-2: 自动注入协调协议到 Agent 上下文

> 解决劣势 W-2：让 Agent 从被动响应变主动协作。**低成本高收益**。

#### ClawTeam 做法

Spawn worker 时自动往 prompt 头部注入：

```
## Coordination Protocol (auto-injected into every spawned agent)
- 📋 Check your tasks: clawteam task list <team> --owner <your-name>
- ▶️ Start a task:     clawteam task update <team> <id> --status in_progress
- ✅ Finish a task:    clawteam task update <team> <id> --status completed
- 💬 Message leader:   clawteam inbox send <team> leader "status update..."
- 💬 Message teammate: clawteam inbox send <team> <name> "info..."
- 📨 Check inbox:      clawteam inbox receive <team>
- 😴 Report idle:      clawteam lifecycle idle <team>
```

这一段让任何 CLI agent 立刻"知道"怎么主动协作。

#### Slark 当前状态

- `ContextBuilder`（`PLAN.md MVP-4`）只注入 `description` + 团队成员列表 + 历史消息
- Agent 不知道"我可以 @ 别人"、"我可以建议拆任务"、"我可以 report blocked"
- 结果：Agent 只会回答当前消息，不会发起协作动作

#### 建议落地

**Agent 无法直接调 `slark` CLI（Slark 暂无 CLI），所以改为"内联指令语法"**：

定义 Slark 的 Agent 指令协议，Agent 在回复中写特殊标记，Slark 后端解析。

```
## Slark Coordination Hints (auto-injected)

你是 Slark 聊天室中的 AI 员工，除了正常回答用户问题，你可以使用以下"内联指令"主动协作：

- `@<同事名>` ... 触发另一个 Agent 加入讨论
- `/propose-split` 后接 JSON 子任务列表，用户会看到"拆分建议"卡片
- `/claim #<任务号>` 认领一个已存在的 task
- `/blocked: <原因>` 宣告自己卡住，状态变 error 并通知用户
- `/done` 声明本轮工作完成，idle

规则：
- 这些指令必须独占一行
- 用户会在 UI 上以特殊卡片样式看到，不会被当作普通文本
- 不要过度使用，只在真的需要时才用
```

**后端解析（`packages/server/src/messaging/message-router.ts`）**：

```typescript
// 在消息完成流式输出后，按顺序扫描
const directives = parseDirectives(message.content);
for (const d of directives) {
  switch (d.type) {
    case 'propose-split': enqueueTaskSplitSuggestion(d.payload, channel, agent); break;
    case 'claim':         claimTask(d.taskId, agent); break;
    case 'blocked':       updateAgentStatus(agent, 'error', d.reason); break;
    case 'done':          updateAgentStatus(agent, 'idle'); break;
  }
}
```

**UI 渲染**（在 `MessageBubble` 组件识别指令行并渲染特殊 UI）：
- `/propose-split` → 任务拆分建议卡片，带"Create all" / "Customize" / "Ignore" 按钮
- `/claim #27` → 一个高亮行 "📌 Alice claimed #27"
- `/blocked` → 红框警告条
- `/done` → 灰色小标 "Finished this turn"

#### 涉及的 Slark 文档改动

- `docs/technical-decisions.md` 新增 `D-N: Agent 内联指令协议`（protocol 定义）
- `docs/cli-event-format.md` 需说明指令在回复中的出现方式（不影响 CLI 事件本身）
- `PLAN.md` MVP-4 的 ContextBuilder 章节加"协调协议注入"步骤
- `docs/ui-reference/components.md` MessageBubble 新增"指令卡片"变体
- `product-brief.md` 如果加，可放到"交互式协作"章节

#### 风险与权衡

| 风险 | 说明 | 备选 |
|------|------|------|
| Agent 不遵守指令语法 | 模型可能发明其他指令 | 解析器容错，未识别的 `/xxx` 作为普通文本显示 |
| Agent 过度使用 `/propose-split` | 每个问题都建议拆成 5 个 task | 在 prompt 里加 "only when truly needed" + 限流（每个 thread 最多 1 次） |
| 与正常 Markdown 冲突 | `/propose-split` 可能被误认为路径 | 要求独占一行且以 `/` 开头 + 后端校验行格式 |

---

### B-3: 任务依赖图（`blocked_by`）

> 解决劣势 W-4：把 Tasks 从"简单状态机"升级成"工作流编排"。

#### ClawTeam 做法

```
clawteam task create <team> "Implement auth" --blocked-by T1,T2
clawteam task update <team> T1 --status completed   # 自动 unblock T3, T4, ...
```

#### Slark 当前状态

- `tasks` 表（`PLAN.md MVP-2`）只有状态字段，无依赖关系
- 多 Agent 工作流需要用户手工 `@Dev-Main` 一下让他开始

#### 建议落地

**Schema**：

```sql
-- 方案 A: 数组字段（简单）
ALTER TABLE tasks ADD COLUMN blocked_by_ids TEXT;  -- JSON array of task ids

-- 方案 B: 独立 join 表（规范）
CREATE TABLE task_dependencies (
  task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on)
);
CREATE INDEX idx_task_deps_on ON task_dependencies(depends_on);
```

**状态流转新增 `blocked` 态**（扩展 `D-1` 状态机）：

```sql
-- 当前
status CHECK(status IN ('todo','in_progress','in_review','done'))

-- 扩展
status CHECK(status IN ('blocked','todo','in_progress','in_review','done'))
```

- 创建任务时若 `blocked_by_ids` 非空，状态初始化为 `blocked`
- 某个上游任务变 `done` 时，遍历依赖它的下游：如果所有上游都 `done`，下游从 `blocked` 变 `todo`
- 发频道系统消息 `🔓 #7 unblocked, ready for @Dev-Main`（触发链式 @）

**API / UI**：

```
POST /api/tasks  body 新增 blocked_by: number[]
```

- Tasks 面板每个任务行右侧显示 🔒 Blocked by #5, #6；可点进 #5 跳转
- Task 创建对话框增加 "Depends on: [multi-select]" 下拉

#### 涉及的 Slark 文档改动

- `PLAN.md` MVP-2 schema 加字段；MVP-9 Tasks 章节加"依赖图"小节
- `docs/technical-decisions.md` `D-1` 状态机新增 `blocked` 态规则说明
- `docs/ui-reference/components.md` Task 行加"Blocked by"标签
- `docs/product-brief.md` 场景 D 增加"依赖自动推进"说明

#### 风险与权衡

| 风险 | 说明 | 备选 |
|------|------|------|
| 循环依赖 | T1 blocks T2, T2 blocks T1 | 插入时 DFS 检测，有环拒绝 |
| 下游 assignee 缺失 | 上游完成时没人接 | 系统消息中 @ 全频道 "需要认领" |
| 过度复杂化 | MVP 用户可能只想简单 Todo List | 把依赖字段做成"可选"，默认不显示 |

---

### B-4: 团队模板（Launch Team）

> 解决劣势 W-3，是 ClawTeam 最有"病毒传播"潜力的设计。

#### ClawTeam 做法

TOML 模板定义团队原型，一条命令拉起：

```
clawteam launch hedge-fund --team fund1 --goal "Analyze AAPL, MSFT, NVDA"
```

模板内容示例：
```toml
[team]
name = "hedge-fund"
description = "7-agent investment analysis team"

[[agents]]
name = "portfolio-manager"
role = "leader"
prompt = "You coordinate analysts and make final buy/sell decisions"

[[agents]]
name = "buffett-analyst"
prompt = "Value investing: moat, ROE, DCF"

# ... 还有 5 个
```

#### Slark 当前状态

无模板系统，每个 Agent 都在 Create Agent Dialog 里手动建。一个"webapp 开发团队"需要点 5 次对话框。

#### 建议落地

**目录约定**：

```
~/.slark/templates/
  ├── builtin/                   # 随 Slark 发行内置
  │   ├── webapp.toml
  │   ├── research.toml
  │   └── bug-hunt.toml
  └── user/                      # 用户自定义
      └── my-team.toml
```

**模板 schema**（沿用 TOML，和 ClawTeam 保持兼容便于分享）：

```toml
[meta]
name = "webapp"
display_name = "Web App Development Team"
description = "Architect + Backend + Frontend + Reviewer"
version = "1.0"

[channel]
name_template = "{project}-dev"
description = "Development channel for {project}"
workspace_path_required = true

[[agents]]
slug = "architect"
name = "Architect"
runtime = "cursor"
model = "composer-2-fast"
description = "Designs API schemas and data models"
init_task = "Design the REST API schema for {goal}"

[[agents]]
slug = "backend"
name = "Backend"
runtime = "cursor"
description = "Implements server-side logic"
init_task = "Implement the backend based on architect's schema"
blocked_by = ["architect"]

[[agents]]
slug = "frontend"
name = "Frontend"
description = "Builds React UI"
init_task = "Build the UI for {goal}"
blocked_by = ["architect"]

[[agents]]
slug = "reviewer"
name = "Reviewer"
description = "Reviews code and runs tests"
init_task = "Review and test all changes"
blocked_by = ["backend", "frontend"]
```

**API / UI**：

```
GET    /api/templates                       列出所有内置 + 用户模板
POST   /api/templates/:slug/launch          body: { channel_name, workspace_path, goal, variables }
```

- Sidebar 顶部加 `+ Launch Team` 按钮（次于 `+ New Channel`）
- 弹窗左侧选模板卡片，右侧填变量 (`{project}`, `{goal}` 等)
- 点 Launch → 自动创建频道 + 创建 N 个 Agent + 加入频道 + 创建 N 个初始 task（带依赖关系，需 B-3 支持）

**内置模板建议 3 个（MVP 级）**：

| slug | agents | 适用场景 |
|------|--------|---------|
| `webapp` | architect / backend / frontend / reviewer | 从 0 起一个全栈项目 |
| `research` | reader / analyst / writer | 读一堆文件 → 分析 → 出报告 |
| `bug-hunt` | investigator / reproducer / fixer | 用户贴 bug → 复现 → 修复 |

#### 涉及的 Slark 文档改动

- `PLAN.md` 新增 MVP-10 或 Phase 4："Team Templates"
- `docs/technical-decisions.md` 新增 `D-N: 模板 TOML Schema`
- `README.md` 加"快速启动 → Launch Team"章节
- 新文档 `docs/team-templates.md`（模板作者指南）

#### 风险与权衡

| 风险 | 说明 | 备选 |
|------|------|------|
| 模板需要 B-3 任务依赖才够好 | `blocked_by` 是模板的灵魂 | 没 B-3 前先做"简化版"：只创建 agent，不自动派任务 |
| 用户修改模板后的版本管理 | 升级 Slark 时覆盖用户 | 严格区分 `builtin/` 与 `user/` 两目录 |
| 变量注入 | `{goal}` / `{project}` / `{workspace_path}` 要统一 | 借用 ClawTeam 的变量约定保证兼容 |

---

### B-5: Plan Approval 流程

> 解决劣势 W-6：Agent 干活前先让人看一眼方案。

#### ClawTeam 做法

```
clawteam plan submit <team> <agent> "plan text" --summary "TL;DR"
clawteam plan approve <team> <plan-id> <agent> --feedback "LGTM"
clawteam plan reject  <team> <plan-id> <agent> --feedback "Revise X"
```

#### Slark 当前状态

- Agent 收到 `@Architect 设计 X` 后直接开写，用户只能事后看
- Tasks `in_review` 态有一点轨道感，但不对应 Agent 的"方案"

#### 建议落地

**数据层**：复用 `messages` 表 + `metadata_json.plan`，不新建表。

```typescript
// types.ts MessageMetadata 扩展
plan?: {
  id: string;                // uuid
  status: 'pending' | 'approved' | 'rejected';
  summary: string;
  approver_id?: string;      // agent_id 或 'local-user'
  feedback?: string;
};
```

**Agent 触发方式**：借 `B-2` 的内联指令协议

```
Architect 回复：
这是我的方案：...

/plan-submit
summary: "分 3 个模块：auth / store / ui"
body: |
  1. auth 模块用 JWT...
  2. store 用 PostgreSQL...
  3. ui 用 React...
```

**UI 渲染**：方案消息显示为**黄色边框的大卡片**，带：
- Summary 作为标题
- Body 可展开
- 底部 `[Approve]` (粉底) / `[Request Changes]` (白底) 按钮
- 有谁在 channel_agents 表里被标为 `can_approve=true` 的都可以点
- Approve 后系统自动发 `@<next-assignee>` 消息，触发下游 Agent 开工
- Reject 后把 feedback 回灌给 Architect 要求修改

#### 涉及的 Slark 文档改动

- `docs/technical-decisions.md` 扩展 `D-7` MessageMetadata 契约
- `docs/ui-reference/components.md` MessageBubble 新增 "Plan Card" 变体
- `PLAN.md` 可放到 Phase 3 后半或 Phase 4 新增 MVP-11

#### 风险与权衡

| 风险 | 说明 | 备选 |
|------|------|------|
| 增加用户点击负担 | 每个方案都要 Approve 影响流畅度 | 做成"可关闭"开关（频道级别 `require_plan_approval`） |
| Agent 不懂何时 `/plan-submit` | 可能所有回复都发方案 | 在协议里写清楚"只在用户明确要求 design 时用" |

---

### B-6: Tiled Live View（多 Agent 并排实时输出）

> 这是 Slark 相对 ClawTeam 的**差异化机会**——Web UI 天然能比 tmux 做得更优雅。

#### ClawTeam 做法

```
clawteam board attach <team>   # 平铺 tmux，看 N 个 agent 同时滚屏
```

是 ClawTeam 最"震撼"的演示场景，但仅限终端。

#### Slark 当前状态

- 当前只能在单个频道里顺序看 Agent 回复
- 多 Agent 同时 working 时用户只能靠 sidebar 状态点判断"谁在忙"

#### 建议落地

**路由**：复用 `channel/:id?view=live`（`routes.md` 的 URL 参数机制）

**UI**：主区切换成 N 列 grid（N = 当前 `status IN ('thinking','working')` 的 agent 数）

```
┌──────────┬──────────┬──────────┐
│Architect │ Backend  │ Frontend │  ← Agent 名 + 状态点
├──────────┼──────────┼──────────┤
│ thinking │ tool:    │ Writing  │
│   ...    │ Shell    │ React... │  ← 实时 stream
│          │  ls -la  │          │
│          │   done   │          │
└──────────┴──────────┴──────────┘
```

- 每列实时订阅该 agent 的 `message_stream` / `agent_status` WS 事件
- 顶部状态点 + 当前工具调用
- 中部 rolling window（最近 N 行）
- Agent idle 时该列折叠为细条
- 用户可以在 Live View 下方继续输入消息（和普通频道一样）

#### 涉及的 Slark 文档改动

- `docs/ui-reference/routes.md` 新增 `?view=live` 参数
- `docs/ui-reference/components.md` 新增 `LiveView` 组件
- `PLAN.md` 放到 Phase 4+

#### 风险与权衡

| 风险 | 说明 | 备选 |
|------|------|------|
| 同时展示 5+ 个 agent 视觉过载 | 屏幕挤爆 | 最多展示 4 列，其余隐藏成"+3 more" |
| 用户会在 Live View 忘记正常聊天流 | 模式切换成本 | Live View 保留 Message Input Box，信息流仍归并写入消息表 |

---

### B-7: Lifecycle / Idle 主动通知

> 让 `D-1` 状态机的 `idle` 态从"被动状态"变成"主动信号"。低成本。

#### ClawTeam 做法

```
clawteam lifecycle idle <team>             # worker 主动声明"我闲了"
clawteam lifecycle request-shutdown <team> # worker 请求退出
clawteam lifecycle approve-shutdown <team> # leader 批准
```

Sidebar 能看到 `🟢 alice (idle, finished T#27)`

#### Slark 当前状态

- `D-1` 已有 `idle` 态，但触发完全是"CLI 进程 done → 自动切回 idle"
- Agent 自己不主动说"我完成了 T#27，可以接新任务吗"

#### 建议落地

**和 `B-2` 内联指令协议合并**：Agent 在回复末尾写 `/done` 时：

1. 服务端写一条 system 消息 `"🟢 Alice finished and is idle"`（简短、单行）
2. Sidebar 状态点下方加一行小字 `"just finished T#27"`（从 agent 最近完成的 task 读取）
3. 如果该频道有 `status='todo' AND assignee=alice` 的任务，自动推送 "Start #28?" 快捷操作卡片

**超时兜底**：Agent 响应结束 30s 无新动作，服务端自动做 `/done` 的副作用（兼容不支持协议的 CLI）。

#### 涉及的 Slark 文档改动

- `docs/technical-decisions.md` `D-1` / `D-2` 补充"idle 通知"语义
- `docs/ui-reference/components.md` Sidebar Agent 行加"last activity" 细节
- 合并进 `B-2` 的实现

#### 风险与权衡

| 风险 | 说明 | 备选 |
|------|------|------|
| 通知过于频繁 | 每次对话结束都发 "idle" 淹没聊天流 | 只有真正完成 task 时才发（需要和 B-3 / B-5 结合判断） |

---

### B-8: Per-Task 持续会话（复用上下文）

> 对比 `D-12` 的 spawn-per-message，这是"重型任务"场景下的效率优化。争议较大，建议放 P2。

#### ClawTeam 做法

Worker agent 作为 tmux 内的**长驻进程**（不是 spawn-per-message），整个 task 期间维持对话上下文：

```
tmux new-window -n worker1 'cursor-agent --interactive'
# 后续所有 "新任务" 都通过向 tmux pane 发 keys 追加 prompt
```

这样第 2 个 prompt 不需要重新注入 8K 上下文。

#### Slark 当前状态

- 每条消息 spawn 新进程（`D-12`）
- 好处：进程生命周期简单、状态机干净
- 坏处：每次重注入 8K 上下文，浪费 token + 延迟高（5-15s TTFB）

#### 建议落地

这不是简单改动，需要架构层评估。几种方案：

**方案 A：混合模式（推荐探索）**

- 短消息（闲聊、问答）：保持 spawn-per-message
- Task 模式（用户 claim `#N`）：开启长驻会话，task 结束前进程不退出
- Task 持续时间超过 `IDLE_TIMEOUT=10min` 无消息 → 自动 kill

**方案 B：只做"会话续约" token**

- 保持 spawn-per-message 但利用 CLI 的 session ID（Cursor CLI 的 `session_id` 字段）做"续约"
- 再次 spawn 时带 `--resume <session_id>`，CLI 内部复用上下文缓存

**方案 C：不做**（推荐 MVP 后再评估）

- `D-12` 现状足够支撑 MVP 场景
- 等用户报 "太贵 / 太慢" 时再动

#### 涉及的 Slark 文档改动

- `docs/technical-decisions.md` 重写 `D-12` 增加"长驻会话"选项
- `PLAN.md` Phase 4+ 新增 MVP："长驻会话优化"

#### 风险与权衡

| 风险 | 说明 | 备选 |
|------|------|------|
| 进程管理复杂度大增 | Slark 要维护 N 个 long-running 进程 | 只在 task 场景启用，限定并发 |
| Cursor CLI 可能不稳定 | 长驻时容易 OOM / 死锁 | 心跳检测 + 超时自动重启 |
| 破坏 `D-12` 的简洁性 | 状态机变复杂 | 只 Phase 4+ 做，MVP 期间冻结 |

---

## 6. 一些未编号但值得记住的小借鉴

这些不足以独立成条目，但实现 B-1~B-8 时可顺手带上：

| 名称 | 来源 | Slark 落地 |
|------|------|-----------|
| **全 CLI `--json` 输出** | ClawTeam 所有命令都有 `--json` | 后续 Slark 如加 `slark` CLI，第一天就要支持，方便 agent 读自己建的 task |
| **Branch 命名规范** | `clawteam/{team}/{agent}` | Slark 用 `slark/{channel-slug}/{agent-slug}/{run-id}`，`git log --grep slark/` 可查所有协作历史 |
| **Profile / Preset 概念** | `clawteam preset generate-profile moonshot-cn claude` | Slark 预留 `agents.profile_id` 字段，支持 "Cursor + Kimi" 这种"换模型不换 CLI" |
| **`team discover` 命令** | 列出系统中所有 team | Slark 可选：启动时检测其他 `~/.slark/` home，列出可切换实例 |
| **Inbox 消息的 broadcast** | `clawteam inbox broadcast <team> "message"` | Slark 暂无需要（频道主线自然是 broadcast），但 Thread 内"@here" 可借鉴 |

---

## 7. 建议的讨论锚点

后续制定改进计划时，先回答以下问题：

| Q | 问题 | 可选方向 |
|---|------|---------|
| Q-B-1 | B-1 Worktree 隔离是否进 MVP 之后的下一个 Phase？ | A. 紧接 MVP / B. 和 B-2 打包做 / C. 延后等用户反馈 |
| Q-B-2 | B-2 协调协议采用"内联指令" 还是独立 `slark` CLI？ | A. 只内联 / B. 先内联再做 CLI 双通道 |
| Q-B-3 | B-3 依赖图是 `blocked_by_ids` 字段还是独立 join 表？ | A. 字段简单 / B. join 表规范 |
| Q-B-4 | 模板 schema 是否要和 ClawTeam TOML 完全兼容（便于互相分享）？ | A. 完全兼容 / B. 借鉴结构但用 Slark 自己的字段 |
| Q-B-5 | Plan Approval 是频道级开关还是全局开关？ | A. 频道级 / B. 全局 / C. 不做开关，默认开 |
| Q-B-6 | Tiled Live View 的进入方式？ | A. URL 参数 / B. 独立路由 / C. Channel Header 切换按钮 |
| Q-B-8 | 是否值得在 Phase 4 探索长驻会话？ | A. 值得做实验 / B. MVP 之后再看 / C. 永远不做 |

---

## 8. 版本历史

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v0.1 | 2026-04-23 | 初版：基于 ClawTeam v0.2.0 README 的对比分析 + 8 条借鉴条目 | - |

---

**本文档的角色**：借鉴清单的单一事实来源。制定改进计划时从这里挑条目 → 更新 `PLAN.md` 新增对应 MVP-N → 更新 `technical-decisions.md` 新增 `D-N` → 删除 / 归档本清单中被实现的条目（或在条目末尾标 `✅ Implemented in MVP-N`）。
