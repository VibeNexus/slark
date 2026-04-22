# Slark 产品定位与目标需求

> 本文档是 Slark 的**战略层文档**，回答 "Slark 是什么 / 为谁做 / 不做什么"。
> `PLAN.md` 回答 "怎么分阶段做"，`docs/technical-decisions.md` 回答 "具体实现约束"。
> 三层文档的所有变更都必须与本文档一致；冲突时以本文档为准。

## 文档来源

本文档沉淀自 2026-04-22 一次关于产品最终定位的讨论（四轮）。讨论结论：

1. Slark 采用 **中心化托管** 形态，而非 per-project 安装
2. **Channel 即 Project**，不引入独立的 Project 实体
3. 在 slock.ai 基础上，定位为 **多 Agent 编程协作室**（而非纯聊天室）
4. 多项目并发的上下文隔离由 `workspace_path` + Channel 作用域天然实现

---

## 1. 产品一句话

> **Slark 是一个本地 AI 员工聊天室——把 Cursor Agent 变成你的 Slack，在频道里让多个 AI 同事围绕你的代码仓库协作完成编程工作。**

### 关键动词与主语

- 主语："你"（单个开发者 / 小团队的技术负责人）
- 谓语："让 AI 同事协作完成" —— 不是 "让一个 Agent 帮你写代码"
- 场所："本地聊天室" —— 不是云端、不是 IDE 插件
- 对象："你的代码仓库" —— Agent 直接在真实 repo 上工作

### 视觉锚点

slock.ai 的 Neo-Brutalism 暖黄配色 + 硬阴影 + 2px 黑边的暖色工作台感。详见 `docs/ui-reference/design-tokens.md`。

---

## 2. 愿景与成功标准

### 愿景

让 "多 Agent 协作编程" 这件事像用 Slack 一样自然——
- 把 Architect、Dev、Reviewer 当真实同事一样 @ 他们
- 每个项目一个频道，成员可以不同
- 协作痕迹（讨论 / 任务 / 结论）随项目持久化、可追溯

### 成功标准（MVP 完成时）

| # | 描述 | 衡量方式 |
|---|------|---------|
| S-1 | 用户可以在 5 分钟内创建第一个工作频道 + 第一个 Agent，并完成一次端到端对话 | 从启动到首条流式回复的时间 |
| S-2 | 同一 Agent 可在两个不同项目频道并发工作，两边的对话历史不互相污染 | 并发跑 2 个项目 + 人工抽检 |
| S-3 | Agent 能在当前频道对应的代码仓库里直接读写文件（而不是在 Agent 沙盒里） | cwd = channel.workspace_path 生效 |
| S-4 | @mention 链式触发 + Thread 能实现多 Agent 顺序协作（场景：Architect 派任务给 Dev） | PLAN Phase 3 场景 B 验收 |
| S-5 | 所有数据本地化，用户可以完全离线使用（CLI 工具本身的 API 调用除外） | 数据目录 `~/.slark/` 无上行网络 |

### 非 MVP 的长期愿景

- 多 CLI 并存（Codex / Claude / Kimi / Copilot / Gemini）
- Team Memory（团队级 ground rules 共享注入）
- Agent 模板市场
- 跨项目的全局 Task 看板

---

## 3. 目标用户与核心场景

### 主目标用户

| 维度 | 描述 |
|------|------|
| 身份 | 独立开发者 / 小团队技术负责人（1-5 人） |
| 技能 | 熟悉命令行与 Cursor / Claude Code / Codex 至少之一 |
| 心智 | 愿意为一个编程任务 "雇佣多个 AI 同事"，而不是只用一个 |
| 痛点 | 当前单 Agent IDE 插件无法表达 "Architect 设计 → Dev 实现 → Reviewer 审查" 的协作拓扑 |

### 非目标用户

- 需要真人协作的团队（不做多用户）
- 完全不用 CLI 的 GUI 用户
- 需要企业级权限 / 审计的组织
- Agent 市场 / 托管平台用户（Slark 是本地工具）

### 核心场景

#### 场景 A：多 Agent 分工协作一个新功能

```
用户 → #slark 频道（绑定 /Users/me/code/slark）
"@Architect 我要加一个 Project 实体，你先出方案给 @Dev-Main 实现"

Architect → 读取项目代码 → 输出方案 → @Dev-Main
Message Router 在 Thread 内自动触发 Dev-Main
Dev-Main → 读取方案 + 代码 → 实现 → @Reviewer
Reviewer → 读取 diff → 审查结论 → 输出

用户在 Thread 面板里看到整个协作链，每一步有时间戳
```

#### 场景 B：单 Agent DM 快速问答

```
用户 → DM Assistant
"@Assistant 这个函数为什么会返回 undefined？"

Assistant → spawn cursor-agent → cwd = DM 绑定的项目路径
→ 流式回复 → 用户看到逐字输出
```

#### 场景 C：跨项目复用同一批 Agent

```
用户在 Slark 里有 Agent: Architect / Reviewer / Dev-Main
#slark 频道：Architect + Reviewer + Dev-Main（Slark 项目）
#blog 频道：Architect + Reviewer（个人博客项目）

同一个 Architect 同时在两个频道工作，上下文完全隔离
（见 §7 多项目并发隔离）
```

#### 场景 D：任务驱动的协作

```
用户在频道 Tasks Tab "+ New Task"
  title: "修复 WebSocket 重连 bug"
  assignee: Dev-Main

→ 产生 system 消息 "📝 1 new task created: #27 ..."
→ Dev-Main 被 at 后自动 claim → "📌 Dev-Main claimed #27"
→ Dev-Main 完成后 move to In Review → @Reviewer
→ Reviewer 审查通过 → Done
```

---

## 4. 产品定位（市场坐标）

### 竞品矩阵

| 产品 | 核心定位 | 与 Slark 的差异 |
|------|---------|-----------------|
| **slock.ai** | 云端多用户 AI 员工聊天室 | Slark = 本地 + 单用户 + 绑定代码仓库 |
| **Cursor / Claude Code** | 单 Agent IDE 内编程助手 | Slark = 多 Agent 协作 + 独立聊天室（不嵌入 IDE） |
| **Slack** | 真人协作聊天工具 | Slark = AI 协作 + 本地 + 绑定代码 |
| **LangGraph / AutoGen** | 代码层面的多 Agent 编排框架 | Slark = 产品层面的用户体验（聊天室 UI） |

### 定位坐标

```
                    云端托管
                        │
                        │
              slock.ai  │
                        │
                        │
协作聊天 ─────────────────────────── 单人编辑
      │                │
      │                │        Cursor / Claude Code
      │                │
      │   **Slark**    │
      │                │
                        │
                    本地运行
```

Slark 占据 **"本地 + 协作聊天"** 这个空白象限，是 slock.ai 的本地复刻 + Cursor 类工具的协作上层。

### 不追求的定位

- ❌ 不做 "最强单 Agent 编程工具"（Cursor 已经足够好）
- ❌ 不做 "云端多人协作"（slock.ai 已经在做）
- ❌ 不做 "Agent 编排 SDK"（LangGraph 是代码框架，Slark 是产品）
- ❌ 不做 "Agent Marketplace"（MVP 阶段）

---

## 5. 核心概念模型（四轮讨论的共识）

### 实体关系图

```
Slark 实例 (一台机器一个)
 └── Channel (工作频道 / 普通频道 / DM)
      ├── workspace_path: TEXT NULL       ← 绑定代码仓库（可选）
      ├── type: 'channel' | 'dm'
      │
      ├── channel_agents (多对多)
      │    └── Agent (AI 员工，全局身份)
      │         ├── description / runtime / model
      │         ├── env_vars (可被 channel 覆盖)
      │         └── ~/.slark/agents/{id}/ (私人沙盒，存 MEMORY.md 等)
      │
      ├── messages (按 channel_id 作用域)
      │    ├── parent_id → Thread 结构
      │    └── sender_type: 'user' | 'agent' | 'system'
      │
      └── tasks (按 channel_id 作用域)
           └── 4 状态: todo / in_progress / in_review / done
```

### 关键决策：Channel 即 Project

**不引入独立的 `projects` 表**。`channels` 加一个可选字段 `workspace_path`：

- `workspace_path IS NOT NULL` → **工作频道**（绑定代码仓库），Agent cwd 指向该路径
- `workspace_path IS NULL` → **普通频道**（纯聊天 / 记笔记），Agent cwd 回退到 `~/.slark/agents/{id}/`

这让 `messages` / `tasks` / `channel_agents` / `thread` 全部继承现有 channel 作用域，零迁移成本。

### Agent 是 "AI 员工" 而非 "工具"

- Agent 有跨频道的全局身份（name / description / avatar）
- Agent 可同时加入多个工作频道（= 一个员工在多个项目帮忙）
- Agent 的 "长期记忆"（`~/.slark/agents/{id}/`）是跨频道的，和任何特定项目无关
- Agent 的 "短期记忆"（对话历史）按 channel 隔离

---

## 6. 决策一：中心化托管，而非 per-project 安装

### 决策

Slark 采用 **一次安装、全局使用** 的中心化形态：

- 单个 Slark 实例（`~/.slark/slark.db`）管理所有频道 / Agent / 任务
- 项目接入方式：在 UI 里 Create Channel 时填 `workspace_path` 字段
- **不提供 per-project 的 `slark install` 或 `.slark/config.yaml` 模式**（MVP 阶段）

### 理由

| 考量 | 支持中心化的理由 |
|------|-----------------|
| 心智模型 | Slack / Cursor / Docker Desktop 都是全局工具，Slark 对标 Slack |
| Agent 复用 | "Alice 同时帮 A 项目和 B 项目" 只有中心化才自然 |
| 安装成本 | N 个项目 = N 次安装 = N 个端口 / UI，不可接受 |
| CLI 工具本身就是全局的 | `cursor-agent` / `codex` 认证都是 `~/.cursor/`、`~/.claude/`，Slark 匹配 |

### 非目标

- ❌ 不做 `.slark/team.yaml` 的项目级 Agent 定义文件（MVP 不做；后续可选加）
- ❌ 不做多实例部署（一台机器一个 Slark）

---

## 7. 决策二：Channel 即 Project

### 决策

`channels` 表新增单一字段：

```sql
ALTER TABLE channels ADD COLUMN workspace_path TEXT;
```

**不新增 `projects` 表，不新增 `channels.project_id` 外键**。

### 语义规则

| 场景 | `workspace_path` | Agent cwd | 用途 |
|------|------------------|-----------|------|
| 工作频道 | 非 NULL，绑定代码仓库绝对路径 | `channel.workspace_path` | 编程协作 |
| 普通频道 | NULL | `~/.slark/agents/{agent_id}/` | 闲聊 / 通用问答 |
| DM | 可选，非 NULL 时生效 | 同上规则 | 和单个 Agent 在某项目上对话 |
| `#general` seed 频道 | NULL | 沙盒 | 兜底聊天 |

### 允许多频道共享同一路径（不去重）

- `#slark-dev` 和 `#slark-review` 都可以指向 `/Users/me/code/slark/`
- 不做归一化，允许 "同一项目分多话题频道"（Slack 式用法）

### CLIRunner 规则（一行伪代码）

```typescript
const cwd = channel.workspace_path ?? defaultAgentSandbox(agent.id);
```

### UI 指示器

- Sidebar CHANNELS 列表里，工作频道右侧显示 📁 图标 + hover 展示路径
- Channel Header 旁加 "Open in Finder / VSCode" 快捷按钮（后续迭代）

---

## 8. 决策三：多项目并发上下文隔离规范

### 五层隔离模型

同一 Agent 在两个工作频道并发工作时：

| 层级 | 隔离程度 | 实现机制 |
|------|---------|---------|
| 进程层 | 完全隔离 | spawn-per-message，每次独立 PID |
| Slark 短期记忆（对话历史） | 按 channel 隔离 | `WHERE channel_id = ?` |
| Slark Agent 身份（description / avatar） | 共享 | 设计如此（Agent = 一个人） |
| CLI 原生记忆（AGENTS.md 等） | 项目级隔离 + 用户级共享 | CLI 工具自管，按 cwd 查找 |
| 运行时副作用 | 部分共享，需显式处理 | 见下方 "必须修正的坑" |

### 必须修正的坑（已在四轮讨论共识）

这些问题在当前 PLAN 中需要显式修复，否则多项目并发会出错：

| # | 问题 | 修正方案 | 影响位置 |
|---|------|---------|---------|
| K-1 | `agents.status` 是单值全局字段，两个频道并发会互相覆盖 | 改成 per-channel 派生状态（新建 `agent_runs` 表或用视图） | `schema.sql` / `MVP-4` |
| K-2 | 链式触发计数维度不明，可能 per-agent-global 误伤 | 显式按 per-thread（或 per-channel）计数 | `technical-decisions.md D-6` |
| K-3 | `agent_activity` 无 `channel_id`，UI 会混展 | 加 `channel_id TEXT REFERENCES channels(id)` | `schema.sql` / `MVP-4` |
| K-4 | `env_vars` 只在 Agent 级，项目特有凭证无法覆盖 | 新增 `channel_agent_overrides` 表支持 channel 级覆盖 | `schema.sql` / `MVP-8` |
| K-5 | `~/.slark/agents/{id}/` 作为共享 cwd，两项目写文件会冲突 | 用 `channel.workspace_path` 替代作为 cwd 来源 | `CLIRunner` / `MVP-4` |
| K-6 | 并发池全局共享，两项目抢 3 并发槽 | MVP 先全局共享（可接受）；后续可加 per-channel 配额 | `D-5` 备注 |

---

## 9. 决策四：定位为 "编程协作室" 而非 "聊天记笔记"

### 与 slock.ai 原版的语义差异

slock.ai 原版 Agent 的 Workspace 是 `~/.slock/agents/{id}/`（沙盒里存 `notes/` + `MEMORY.md`），暗示 Agent 主要做 **聊天 / 记笔记 / 出方案**，不直接改代码。

Slark 选择 **更强的定位**：

| 维度 | slock.ai 原版 | Slark |
|------|--------------|-------|
| Agent 主要能力 | 聊天 / 记笔记 / 出方案 | **直接改代码仓库** |
| Agent cwd | 沙盒 | 工作频道时 = 代码仓库路径 |
| Workspace Tab 展示 | Agent 沙盒的笔记 | Agent 沙盒（MEMORY 等） + Channel Header 单独显示项目路径 |
| 核心用户场景 | "让 Agent 帮我思考" | "让 Agent 组协作完成一个功能" |

### 理由

- 选了 `cursor-agent` 作为 MVP runtime，天然就是 "会改代码" 的工具
- 和 Cursor IDE 插件形成协作关系（IDE 写单文件 / Slark 做多 Agent 协作）
- 纯聊天定位无法解释 "为什么不用 Claude Desktop 或 ChatGPT"

### 需要同步调整的 UI 语义

- Agent Profile → Workspace Tab：还是 `~/.slark/agents/{id}/`（Agent 私物）
- **新增**：Channel Header 旁显示 `workspace_path` 缩写 + 打开按钮（展示 "这个频道在哪个代码仓库工作"）
- Create Channel 对话框新增 `Workspace Path` 字段（可选，带 "Pick Folder" 按钮）

---

## 10. MVP 需求范围

### 必须（P0）

| # | 需求 | 对应 PLAN Phase |
|---|------|-----------------|
| R-1 | 单个 Cursor CLI Agent 可创建并在工作频道发消息 | Phase 2 (MVP-4~6) |
| R-2 | Channel 绑定 `workspace_path`，Agent cwd 生效 | Phase 1 (MVP-2~3) + Phase 2 (MVP-4) |
| R-3 | 同一 Agent 并发在两个工作频道，上下文隔离 | Phase 2 (MVP-4) |
| R-4 | @mention 链式触发 + Thread 面板 | Phase 3 (MVP-7) |
| R-5 | 频道内 Tasks 面板 + 状态流转 system 消息 | Phase 3 (MVP-9) |
| R-6 | Create Agent Dialog（砍掉 Machine 字段） | Phase 3 (MVP-8) |
| R-7 | Agent Profile 三 Tab（Profile / Workspace / Activity） | Phase 3 (MVP-8) |
| R-8 | UI 视觉 1:1 对齐 slock.ai 参考截图 | Phase 2 (MVP-5) |
| R-9 | 所有数据本地化（`~/.slark/slark.db`） | Phase 1 (MVP-2) |

### 应该（P1，MVP 内尽量做）

- R-10：普通频道（`workspace_path = NULL`）作为闲聊场景兜底
- R-11：Sidebar 工作频道 📁 图标指示
- R-12：Channel Header 显示 `workspace_path` 缩写
- R-13：`channel_agent_overrides` 表支持 env_vars 的 channel 级覆盖

### 可以（P2，MVP 后迭代）

- R-14：Codex / Claude Code / Kimi / Copilot / Gemini 适配器
- R-15：全局 Threads / Tasks Kanban / Saved 页面
- R-16：Team Memory（团队级 ground rules 注入）
- R-17：Agent 模板市场
- R-18：`.slark/team.yaml` 项目级 Agent 定义（git 可追踪）
- R-19：Electron / Tauri 打包 + 系统托盘
- R-20：Agent 之间主动 DM（非 @mention 触发）

---

## 11. 非目标（明确不做）

保持产品聚焦，以下能力 **MVP 不做，且短期内不打算做**：

| # | 非目标 | 理由 |
|---|--------|------|
| N-1 | 多用户 / 邀请 / 权限 | 本地单用户工具，不是协作 SaaS |
| N-2 | 云端托管 / 多端同步 | 数据本地化是核心卖点 |
| N-3 | Agent 账号认证（Slark 侧） | CLI 工具自己处理认证 |
| N-4 | 订阅 / 付费 / 计费 | 免费开源 |
| N-5 | 嵌入到 IDE（VSCode / Cursor 插件） | 独立桌面应用，和 IDE 并行使用 |
| N-6 | Mobile / 移动端 | 编程场景不适合 |
| N-7 | 企业审计 / 合规日志 | 个人 / 小团队工具 |
| N-8 | 多机器 / Daemon 分布式部署 | 单机单实例 |
| N-9 | 中文社区翻译 UI | MVP 英文为主（暖色 UI 英文视觉更协调） |
| N-10 | Agent 自我训练 / Fine-tune | 能力由 CLI 工具决定，Slark 不碰模型层 |

---

## 12. 待决议事项（本次未拍板，需后续确认）

| # | 议题 | 可选方案 | 决议 deadline |
|---|------|---------|--------------|
| Q-1 | 首次启动是否自动 `slark link` 当前目录？ | A. 自动 link cwd 成 #project | B. 只 seed #general，用户手动 link | MVP-2 之前 |
| Q-2 | `agents.status` 改造具体方案 | A. 直接删字段，用 `agent_runs` 表派生 | B. 保留字段但语义改为 "any channel" | MVP-4 之前 |
| Q-3 | Agent 沙盒（`~/.slark/agents/{id}/`）是否仍保留？ | A. 保留作为 "Agent 私物" + Memory 区 | B. 彻底删除，Agent 在工作频道 cwd 直接运行 | MVP-4 之前 |
| Q-4 | Channel 级 env_vars 覆盖是 MVP 还是 MVP 后？ | A. 进 MVP-8 | B. 延后到 P2 | MVP-8 之前 |
| Q-5 | 普通频道（`workspace_path=NULL`）里 @ Agent 时是否给出警告？ | A. 静默允许（Agent 落沙盒） | B. 提示 "此频道未绑定代码目录，Agent 将无法读写项目文件" | MVP-6 之前 |
| Q-6 | 一台机器一个 Slark 实例是硬约束吗？ | A. 硬约束（端口锁） | B. 允许多实例（不同端口 + 不同 `SLARK_HOME`） | Phase 4 之前 |

---

## 13. 对 `PLAN.md` / `technical-decisions.md` 的更新指引

本次讨论后，以下文档需要联动更新（按影响面排序）：

### PLAN.md 更新点

- [ ] 开头 "项目总览" 新增引用本文档：`docs/product-brief.md` 为战略层起点
- [ ] MVP-2 的 `channels` 表加 `workspace_path TEXT` 字段（§7 决策二）
- [ ] MVP-2 的 `agent_activity` 表加 `channel_id` 字段（§8 K-3）
- [ ] MVP-2 新增 `channel_agent_overrides` 表 OR 列入 MVP-8（§8 K-4，取决于 Q-4）
- [ ] MVP-2 的 `agents.status` 字段改造（§8 K-1，取决于 Q-2）
- [ ] MVP-3 的 REST API 新增 `PATCH /api/channels/:id` 支持设置 `workspace_path`
- [ ] MVP-3 的 `Create Channel` 请求体加 `workspace_path` 可选字段
- [ ] MVP-4 的 `CLIRunner.spawn` cwd 规则：`cwd = channel.workspace_path ?? defaultAgentSandbox(agent.id)`
- [ ] MVP-5 的 Sidebar 组件：工作频道显示 📁 图标
- [ ] MVP-5 的 Channel Header 组件：显示 `workspace_path` 缩写
- [ ] MVP-8 的 Create Channel Dialog：加 `Workspace Path` 字段 + Folder Picker

### technical-decisions.md 更新点

- [ ] D-6 明确链式触发计数维度为 **per-thread**（§8 K-2）
- [ ] D-8 Agent Workspace 规则修订：区分 "Agent 私物沙盒" 和 "工作频道 cwd"（§9）
- [ ] 新增 **D-13: Channel 即 Project 语义** 详细规则（§7）
- [ ] 新增 **D-14: 多项目并发隔离契约** 五层模型（§8）

### docs/ui-reference/ 更新点

- [ ] `components.md` 的 Channel Header 加 `workspace_path` 指示器
- [ ] `components.md` 的 Sidebar 工作频道 📁 标记
- [ ] `local-adaptations.md` 新增 "Channel Workspace Path" 本地化选项说明

---

## 14. 版本历史

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v0.1 | 2026-04-22 | 首版，沉淀四轮讨论共识 | - |

---

**本文档的角色**：产品层的 "北极星"。任何新需求 / 新功能 / 新模块先问 "是否符合本文档 §1-§4 的定位和 §11 的非目标"；如果冲突，要么拒绝，要么先修订本文档。
