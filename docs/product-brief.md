# Slark 产品定位与目标需求

> 本文档是 Slark 的**战略层文档**，回答 "Slark 是什么 / 为谁做 / 不做什么"。
> `PLAN.md` 回答 "怎么分阶段做"，`docs/technical-decisions.md` 回答 "具体实现约束"。
> 三层文档的所有变更都必须与本文档一致；冲突时以本文档为准。

## 文档来源与版本说明

本文档沉淀自 2026-04-22 ~ 2026-04-23 关于产品最终定位的多轮讨论。

### 历次校准

| 版本 | 关键校准 |
|------|---------|
| v0.1 | 初版："Channel 即 Project" 简化模型 |
| v0.2 | **Server = Project**（channels 从独立实体降级为 Project 内话题频道）|
| v0.3 草案 | 聚焦编程协作 / 砍掉自主学习型 Agent / Agent 无独立 workspace |
| **v1.0** | **产品定位升级**：从 "AI 员工聊天室" 跃升为 **"Programmable AI Team OS"**。引入 6 层架构 / 4 个运营闭环 / 6 个系统 Agent / 从 Goal 自动推导 Team / Team 协同设计 Workflow |

v1.0 是一次本质跃迁：**Slark 不再只是"Slack UI for AI"，而是一个可编程的 AI 团队操作系统**。Slack 式聊天室只是它的 UI 入口，真正的产品是背后的**运营机制**。

---

## 1. 产品一句话

> **Slark = Programmable AI Team OS —— 可编程的 AI 团队操作系统。**
>
> **你设定目标，AI 自动配备团队，团队自己设计协作流程，系统持续沉淀经验并让每个 Agent 随项目成长。**

### 四个关键动作

```
Goal (用户输入)
  ↓ AI 推导
Team (AI 自动配备)
  ↓ 协同设计
Workflow (Team 自己讨论出"甬道")
  ↓ 执行 + 沉淀
Knowledge (沉淀集体智慧)
  ↓ 反馈
Capability (每个 Agent 持续进化)
```

**四个动作都由 AI 主导，人只在关键节点 Approve**。这是 Slark 的核心差异化。

### 视觉锚点

继承 slock.ai 的 Neo-Brutalism 暖黄配色 + 硬阴影 + 2px 黑边。详见 `docs/ui-reference/design-tokens.md`。

---

## 2. 愿景与成功标准

### 愿景

让 "运营一个 AI 工程团队" 像**打开一个 IDE** 一样自然：
- 设定目标 → AI 帮你组建最合适的团队
- Team 自己讨论如何协作 → 你只需要 Approve 最终方案
- 项目跑起来 → 经验自动沉淀 → 团队越用越强
- 整个过程像带一个不断成长的真人团队，而不是每次重新招新员工

### 成功标准

| # | 描述 | 衡量方式 |
|---|------|---------|
| S-1 | 用户从 "启动 Slark" 到 "有一个可协作的 AI Team" ≤ 3 分钟 | 从 Create Project 到第一次 @ 成功的时间 |
| S-2 | 同一全局 Agent 并发在两个 Project 的 channel，对话 / Tasks / Threads / Knowledge 完全隔离 | 并发跑 2 个 Project + 人工抽检 |
| S-3 | Agent 能在当前 channel 对应的代码仓库里直接读写文件 | cwd = `project.workspace_path` 生效 |
| S-4 | 声明式 Workflow（YAML）可以执行成一个完整 thread：触发 → 分步 → 路由 → 完结 | 用内置 `feature-development` 模板跑通一个 feature |
| S-5 | 所有数据本地化，用户可以离线使用（CLI 工具本身的 API 调用除外） | 数据目录 `~/.slark/` 无上行网络 |
| S-6 | 用户连续使用 3 个月后，Agent 团队交付质量可观测地提升 | `agent_feedback` 表有有效数据、用户认可 Coach 建议并 Apply |
| S-7 | 整个项目生命周期可追溯：每条决策、每条经验、每次 Agent 调整都有记录 | Intelligence Tab 可以回看所有沉淀 |

### 非 MVP 的长期愿景

- 跨 Project 的 Pattern Library（经验迁移）
- 公开的 Workflow / Team Template 市场
- Agent 技能地图 (Skill Matrix) 自动维护

---

## 3. 目标用户与核心场景

### 主目标用户

| 维度 | 描述 |
|------|------|
| 身份 | 独立开发者 / 小团队技术负责人（1-5 人） |
| 技能 | 熟悉命令行与 Cursor / Claude Code / Codex 至少之一 |
| 心智 | 愿意把"运营 AI 员工团队"当作一个**日常能力**来投入，而不是"一次性试用"|
| 痛点 | 现有单 Agent IDE 插件解决不了"多角色协作 + 项目经验沉淀 + 团队持续提升" |

### 非目标用户

- 需要真人协作的团队（不做多用户）
- 完全不用 CLI 的 GUI 用户
- 需要企业级权限 / 审计的组织
- Agent 市场 / 托管平台用户（Slark 是本地工具）

### 核心场景

#### 场景 A：从 Goal 开始，30 秒组建 AI Team

```
用户启动 Slark，点 "+ New Project"：
  Name:      sso-service
  Goal:      Build an OAuth SSO service for internal tools
  Workspace: ~/code/sso-service

系统（Team Architect System Agent 响应）：
  基于你的 Goal，我建议组建以下团队：
  ✓ Architect       - 设计 OAuth 协议和数据模型
  ✓ Dev-Backend     - 用 Node.js 实现 OAuth flow
  ✓ Reviewer        - 审查安全性（token 泄露 / CSRF 等）

  [Approve All] [Customize Team]

用户点 Approve → 3 个 Agent 被创建，自动加入 Project 的 #general channel
30 秒内，用户就有一个可用的 AI 工程团队
```

#### 场景 B：Team 自己设计 Workflow（甬道诞生）

```
团队组建完成后，系统触发 "Workflow Design Session"：

  Facilitator System Agent → "你们打算如何协作交付这个 Goal？"
  Architect → "我建议先出方案，等用户 Approve 后再让 Dev 实现"
  Dev-Backend → "同意。实现后需要 Reviewer 检查安全性"
  Reviewer → "确认。如果我发现问题，打回 Dev 重做"
  
  Facilitator → 综合成 YAML workflow draft：
  
    name: feature-development
    trigger: /new-feature
    steps:
      - design     [Architect executes, user approves]
      - implement  [Dev-Backend executes]
      - review     [Reviewer approves, can reject to implement]
      - done       [close thread]
  
  用户 Approve → Workflow 注册到 Project

这是 Slark 的核心差异化：Workflow 不是用户手写的，也不是模板固定的，
是 Team 自己讨论出来的 —— "甬道" 从协作中诞生。
```

#### 场景 C：执行 + 自动沉淀

```
用户在 #general 输入：/new-feature add Google OAuth

Slark 按 Workflow 驱动：
  Step 1: Architect spawn → 输出方案（thread 内可见）
  Step 2: 用户 Approve → 自动 @Dev-Backend
  Step 3: Dev-Backend spawn → 改代码（cwd = workspace_path）
  Step 4: 自动 @Reviewer → 审查
  Step 5: 完成

Task 结束后，Scribe System Agent 自动回扫整个 thread：
  "此 task 产生的可沉淀条目：
   - [Decision] 采用 PKCE 而非 Implicit Flow，理由：RFC 建议 SPA 使用 PKCE
   - [Lesson] Google OAuth 的 redirect_uri 必须提前在 GCP 注册
   - [Pattern] 安全审查 checklist 新增：token 在 cookie 还是 localStorage"
  
  用户在 Intelligence Tab 的 Pending Queue 看到这些建议 → Approve / Edit → 进入项目知识池
```

#### 场景 D：团队持续成长

```
一周后，Evaluator System Agent 发现：
  - Dev-Backend 3 次忘记在 async 函数 try-catch
  - Architect 的方案被用户 2 次要求补充"错误处理"细节

Coach System Agent 生成建议：
  - Dev-Backend description 增加：
    "始终在 async 函数使用 try-catch，异常要带结构化 error code"
  - Architect description 增加：
    "方案必须包含 error handling strategy 小节"
  
用户在 Agent Profile → FEEDBACK Tab 看到这些建议 → Apply / Reject

Apply 后 agents.description 实际被更新 + 写入 agent_feedback 表（可审计、可回滚）
下次 Agent spawn 时，带着进化过的 description 工作
```

---

## 4. 产品定位（市场坐标）

### 竞品矩阵

| 产品 | 核心定位 | 与 Slark 的差异 |
|------|---------|-----------------|
| **slock.ai** | 云端多用户 AI 员工聊天室 | Slark = 本地 + 单用户 + 可编程运营机制 |
| **Cursor / Claude Code** | 单 Agent IDE 内编程助手 | Slark = 多 Agent 协作 + Goal→Team→Workflow 全自动化 |
| **ClawTeam** | Leader Agent 自主 spawn CLI worker | Slark = 人类作为最终 approver，声明式 Workflow 而非自由调度 |
| **Linear / Shortcut** | 人类工程团队项目管理 | Slark = 面向 AI 团队的项目管理 |
| **LangGraph / AutoGen** | 代码层多 Agent 编排框架 | Slark = 产品层（可用 UI）+ 运营机制（Scribe/Coach/Evaluator）|

### 定位坐标

```
             AI 自主驱动
                 │
           ClawTeam     
                 │      
                 │    **Slark**
                 │   (人 Approve, 
协作聊天 ────────┼───── AI 自驱动) ── 单人 IDE
                 │          
       slock.ai  │  
        (手工)   │    Cursor / Claude Code
                 │
             人类主导
```

Slark 占据 **"AI 自驱动 × 协作编排 × 人类 Approver"** 的独特象限。

### 差异化的四个护城河

1. **Goal → Team AI 配备**：其他产品都要用户手动建 Agent，Slark 从 Goal 推导
2. **Team 协同设计 Workflow**：Workflow 不是手写也不是模板固化，是 AI 团队自己讨论出来的
3. **运营闭环机制**：Scribe/Coach/Evaluator 把 "项目协作" 变成 "团队持续成长"
4. **本地优先 + 完全可审计**：用户始终是最终决策者，Agent 演化可回滚

### 不追求的定位

- ❌ 不做 "最强单 Agent 编程工具"（Cursor 已经足够好）
- ❌ 不做 "云端多人协作"（slock.ai 已经在做）
- ❌ 不做 "Agent 编排 SDK"（LangGraph 是代码框架，Slark 是产品）
- ❌ 不做 "Agent Marketplace"
- ❌ 不做 "AI 陪伴 / 生活助理"（Hermes/OpenClaw 已经做得很好）

---

## 5. 核心概念模型

### 5.1 6 层架构（核心模型）

Slark 的本质是一个 6 层递进的团队运营系统：

```
┌─────────────────────────────────────────────────────┐
│  Layer 6:  Capability      能力强化                  │  ← Evaluator + Coach
│              ↑                                        │
│  Layer 5:  Knowledge       集体知识                  │  ← Scribe + decisions/lessons
│              ↑                                        │
│  Layer 4:  Responsibility  职责框架（Step × Agent）  │  ← RACI 简化
│              ↑                                        │
│  Layer 3:  Workflow        工作流"甬道"              │  ← 声明式 YAML
│              ↑                                        │
│  Layer 2:  Team            团队成员（AI 自动配）     │  ← Team Architect Agent
│              ↑                                        │
│  Layer 1:  Goal            项目目标（一等公民）      │  ← 用户必填、简洁明确
└─────────────────────────────────────────────────────┘
```

**关键特征：每一层都建立在下一层之上，不能跳过**。没有 Goal 无法派生 Team，没有 Team 无法设计 Workflow，没有 Workflow/Team 无法定义 Responsibility。

### 5.2 实体关系图

```
Slark 实例 (一台机器)
 │
 ├── Project  (= 原版 slock.ai 的 Server)
 │    ├── id / name / display_name / workspace_path / goal / team_rules
 │    │
 │    ├── Channels (Project 内话题频道)
 │    │    ├── #dev / #review / #general 等
 │    │    ├── type: 'channel' | 'dm'
 │    │    │
 │    │    ├── channel_agents (多对多)
 │    │    ├── messages (按 channel_id 作用域)
 │    │    └── tasks (按 channel_id 作用域)
 │    │
 │    ├── Agents (Project-scoped，description 可被 Coach 演化)
 │    │
 │    ├── Workflows (声明式 YAML 甬道)
 │    │    └── WorkflowRuns (执行实例，绑定 thread)
 │    │
 │    ├── Responsibilities (Workflow step × Agent)
 │    │
 │    ├── Knowledge
 │    │    ├── Decisions (Scribe 沉淀 / 用户手录)
 │    │    └── Lessons (经验条目，按 audience 过滤注入 prompt)
 │    │
 │    └── Intelligence (项目运营面板)
 │
 └── System Agents (Slark 内置，非 Project-scoped)
      ├── Team Architect  (Goal → Team 推导)
      ├── Facilitator     (主持 Workflow Design Session)
      ├── Scribe          (沉淀 decisions / lessons)
      ├── Evaluator       (评估 Agent 产出)
      ├── Coach           (提出 description 修改建议)
      └── Onboarder       (新 Project 分析 codebase 准备 context)
```

### 5.3 四个运营闭环（Operational Loops）

```
┌─────────────────────────────────────────────────────────────┐
│                    Slark AI Team OS                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │ Onboarding   │─────▶│  Delivery    │                     │
│  │    Loop      │      │    Loop      │                     │
│  └──────────────┘      └──────────────┘                     │
│         ▲                      │                              │
│         │                      ▼                              │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │    Reuse     │◀─────│  Evolution   │                     │
│  │    Loop      │      │    Loop      │                     │
│  └──────────────┘      └──────────────┘                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

| Loop | 触发 | 核心机制 |
|------|------|---------|
| **Onboarding Loop** | Create Project | Team Architect 从 Goal 推导 Team，Onboarder 分析 codebase 生成初始知识 |
| **Delivery Loop** | Workflow Run 结束 | Scribe 自动回扫 thread 沉淀 decisions / lessons |
| **Evolution Loop** | 每周 / 每 N 个 task | Evaluator 评估 Agent 表现，Coach 提出 description 修改建议 |
| **Reuse Loop** | Agent spawn 前 | ContextBuilder 按 audience 过滤注入 lessons / decisions / 历史决策 |

### 5.4 三者关系：Team × Workflow → Responsibility

```
Workflow  = 步骤集合         (Set of Steps)
Team      = 成员集合         (Set of Agents)
Responsibility = Step × Agent 的连接关系
```

- Workflow 和 Team 是平行独立的实体，各自可以先存在
- Responsibility 必须同时依赖两者，只能在最后定义
- 生成顺序：**Goal → AI 推 Team → Team 协同设计 Workflow → 派生 Responsibility**

---

## 6. 决策清单

### D-1：中心化托管

Slark 采用一次安装、全局使用的中心化形态。单个 Slark 实例（`~/.slark/slark.db`）管理所有 Project / Channel / Agent / Workflow / Knowledge。不做 per-project 安装。

### D-2：Server 即 Project

原版 slock.ai Server 在本地语义下即 Project。引入 `projects` 表作为顶层容器：

```sql
CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,         -- URL slug
  display_name    TEXT,
  workspace_path  TEXT NOT NULL,                 -- 必填（见 D-8）
  goal            TEXT NOT NULL,                 -- 必填（见 D-3）
  team_rules      TEXT,                          -- Layer 2 团队协作规则（可选）
  color           TEXT,
  created_at      INTEGER NOT NULL
);

-- channels / agents 都归属 Project
ALTER TABLE channels ADD COLUMN project_id TEXT NOT NULL REFERENCES projects(id);
ALTER TABLE agents   ADD COLUMN project_id TEXT NOT NULL REFERENCES projects(id);
```

URL 结构保留原版 Server 语义：`/p/{projectName}/channel/{id}`。

### D-3：Goal 是一等公民（AI 配 Team）

Goal 必须是：
- **具体、明确、可执行**（1-2 句话）
- **驱动 Team 自动配备**的依据
- **ContextBuilder 注入 prompt 最顶部**（高于 Agent description 和 team_rules）

**AI 配 Team 流程（Team Architect System Agent）**：

1. 用户填 Goal 后，Team Architect 根据 Goal 推导推荐团队：
   - 输入：Goal + Workspace 基本信息（package.json / README 提示的技术栈）
   - 输出：推荐的 Agent 列表（name / role / description / runtime / model）
2. UI 展示推荐卡片，用户可 Approve All / Customize
3. Approve 后自动实例化 Agents + 加入 `#general` channel

这是用户的**第一个 AHA moment**：从 0 到"有个可用的 AI 团队" ≤ 3 分钟。

### D-4：Workflow 即甬道（Team 协同设计）

Workflow 是**声明式 YAML**，每个 Project 可有多个 workflow（每个对应一个 `/command` trigger）：

```yaml
name: feature-development
trigger:
  command: "/new-feature"

steps:
  - id: design
    owner: "@Architect"
    on_complete: await_approval

  - id: await_approval
    owner: "local-user"
    action: approve_or_reject
    on_approve: implement
    on_reject: design

  - id: implement
    owner: "@Dev"
    input: "design"
    on_complete: review

  - id: review
    owner: "@Reviewer"
    on_approve: done
    on_reject: implement

  - id: done
    action: close_thread
```

**Workflow 的两种生成路径**（逻辑上两种都是"Workflow 创建"，不在 schema 里区分）：

| 路径 | 何时用 | 体验 |
|-----|-------|-----|
| **Template Start**（Sprint 2）| 新手 / 常见场景 | 选内置 template（webapp / bug-fix / research），一键生成 |
| **Team-First-Collaborative**（Sprint 4）| 核心差异化 / 进阶 | Facilitator 主持 Session，Team 协商产 YAML，用户 Approve |

**schema 不区分 origin**（用户反馈）—— 最终设计就是最终形态，不保留"兼容多路径"的过渡痕迹。

```sql
CREATE TABLE workflows (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_command TEXT UNIQUE,
  definition_yaml TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE workflow_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id     TEXT NOT NULL REFERENCES workflows(id),
  channel_id      TEXT NOT NULL REFERENCES channels(id),
  thread_id       TEXT,                   -- 绑定 thread
  status          TEXT CHECK(status IN ('running','completed','aborted','failed')),
  current_step    TEXT,
  started_by      TEXT,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  state_json      TEXT                    -- 每个 step 的产出 / 状态
);
```

### D-5：Responsibility 即 Step × Agent 连接

Responsibility 是 Workflow 和 Team 的多对多连接表，用简化的 RACI 模型：

```sql
CREATE TABLE responsibilities (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id       TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  step_id           TEXT NOT NULL,
  agent_id          TEXT REFERENCES agents(id),    -- 可以是 'local-user'
  role              TEXT NOT NULL CHECK(role IN ('executor','approver','reviewer','informed')),
  authority         TEXT CHECK(authority IN ('must_approve','optional_approve','no_authority')),
  created_at        INTEGER NOT NULL
);
```

四种 role：
- **executor**（R）：执行者，做事的
- **approver**（A）：必须批准才能进入下一步（通常是用户或特定 Agent）
- **reviewer**（C）：可以提意见但不阻塞
- **informed**（I）：被通知者，只收消息

**`agent_id = 'local-user'` 是合法值**：用户本人是系统的一等 agent，很多 step 的 approver 就是用户。

### D-6：System Agents 运营团队

Slark 内置 6 个 System Agent，像公司的 HR / QA / PM / Coach：

| Agent | 职责 | 触发时机 | 用户可见度 |
|-------|------|---------|-----------|
| **Team Architect** | Goal → 推导 Team | Create Project 时 | Create Project UI 内 |
| **Facilitator** | 主持 Workflow Design Session | Team 组建完成后 / 手动触发 | Session thread 内 |
| **Scribe** | 沉淀 decisions / lessons | Workflow Run 结束 / thread 解决 | Intelligence Tab Pending Queue |
| **Evaluator** | 评估 Agent 产出质量 | 后台定期 | 异常时上报 |
| **Coach** | 提 Agent description 修改建议 | 每周 / 每 N 个 task | Agent Profile FEEDBACK Tab |
| **Onboarder** | 新 Project 分析 codebase | Create Project + 首次 Agent spawn 前 | Onboarding 面板 |

**实现特征**：
- 和普通 Agent 一样通过 CLI Adapter spawn（复用架构）
- 有 Slark 内置 description（用户不可改）
- 有特殊权限（可写 decisions / lessons / agent_feedback 等表）
- 不出现在频道 Sidebar，不参与 @mention 链
- 在 Intelligence Tab / FEEDBACK Tab 等专属位置可见

### D-7：多 Project 并发隔离契约

同一 Agent 在两个 Project 并发工作时：

| 层级 | 隔离 | 机制 |
|-----|------|------|
| 进程层 | 完全 | spawn-per-message |
| Channel 级（对话历史）| 完全 | `WHERE channel_id = ?` |
| Project 级（workspace / Tasks / Threads / Knowledge）| 完全 | 按 `channel.project_id` 路由 |
| Agent 身份（description）| 共享 | 设计如此 |
| CLI 原生记忆（AGENTS.md / CLAUDE.md）| 项目级 | CLI 自管，按 cwd 查找 |

**必须修正的坑**（Sprint 1 范围）：

| # | 问题 | 修正 |
|---|------|------|
| K-1 | `agents.status` 单值全局字段 | 删字段 + 新建 `agent_runs` 表派生 per-channel status |
| K-2 | 链式触发计数维度不明 | 显式按 per-thread 计数 |
| K-3 | `agent_activity` 无 `channel_id` | 加 `channel_id` 字段 + 索引 |
| K-4 | Agent workspace 作为共享 cwd | 改用 `project.workspace_path` |
| K-5 | env_vars 只在 Agent 级 | 新增 `project_agent_overrides` 表（P1，Sprint 2）|

### D-8：聚焦编程协作 + 无 Agent 独立 Workspace

Slark 聚焦"多 Agent 编程协作"，不做：
- 自主学习型 Agent 适配（Hermes / OpenClaw / AutoGPT 等）
- Agent 独立 workspace（`~/.slark/agents/{id}/` 不存在）
- 跨 Project Agent 复用机制（每个 Project 的 Agent 独立）

**Agent 的"记忆"靠以下机制承载**（无需文件系统）：
- 短期：对话历史通过 ContextBuilder 注入
- 长期：`agents.description` 由 Coach 演化（可审计、可回滚）
- 项目知识：`decisions` / `lessons` 按 audience 注入
- 工程约束：项目内 `AGENTS.md` / `CLAUDE.md`（CLI 原生）

Agent Profile 从原版 3 Tab 简化为 **3 Tab（PROFILE / ACTIVITY / FEEDBACK）**：
- **PROFILE**：身份 + 配置 + 操作（原版一致）
- **ACTIVITY**：运行日志 + Files touched（tool_call 聚合）
- **FEEDBACK**（新）：Coach 建议历史 + Apply/Reject 轨迹

---

## 7. MVP 需求范围

完整需求按 Sprint 组织，详见 §9 Sprint 路线图。此处只列分类：

### P0（必须，分布在 Sprint 1~5）

| 分类 | 需求 | Sprint |
|------|------|--------|
| 基础骨架 | Project / Channel / Goal / Team / workspace 隔离 | Sprint 1 |
| AI 配 Team | Team Architect 从 Goal 推导 Team | Sprint 1 |
| 工作流 | Workflow YAML + 3 内置模板 + 执行引擎 | Sprint 2 |
| 职责 | Responsibilities 表 + 批准流 + 用户介入 | Sprint 3 |
| 沉淀 | Scribe + decisions / lessons + Intelligence Tab | Sprint 4 |
| 成长 | Evaluator + Coach + agent_feedback + Description Evolution | Sprint 5 |

### P1（应该，MVP 后迭代）

| 需求 | Sprint |
|------|--------|
| Onboarder（codebase 自动分析）| Sprint 6 |
| Skill Matrix（Agent 能力地图）| Sprint 6 |
| Team-First-Collaborative Workflow Design | Sprint 4 |
| Workflow YAML Import / Export | Sprint 3+ |
| 跨 Project 经验迁移 | Sprint 7+ |

### P2（可以，远期）

- Codex / Claude Code 多 runtime 适配
- Electron / Tauri 打包
- Agent Template Marketplace

---

## 8. 非目标（明确不做）

| # | 非目标 | 理由 |
|---|--------|------|
| N-1 | 多用户 / 邀请 / 权限 | 本地单用户工具 |
| N-2 | 云端托管 / 多端同步 | 数据本地化是核心卖点 |
| N-3 | 订阅 / 付费 | 免费开源 |
| N-4 | 嵌入到 IDE（VSCode / Cursor 插件）| 独立桌面应用 |
| N-5 | Mobile / 移动端 | 编程场景不适合 |
| N-6 | 企业审计 / 合规日志 | 个人 / 小团队工具 |
| N-7 | 多机器分布式部署 | 单机单实例 |
| N-8 | Agent Fine-tune / 模型训练 | 能力由 CLI 工具决定 |
| N-9 | 自主学习型 Agent 官方适配（Hermes / OpenClaw）| 和聚焦编程协作冲突，§D-8 |
| N-10 | Agent 独立 workspace（`~/.slark/agents/{id}/`）| 记忆靠 description 演化，§D-8 |
| N-11 | 纯聊天 Project（`workspace_path=NULL`）| 所有 Project 必须绑代码仓库 |
| N-12 | Wiki 式知识库 / 语义搜索 / 向量索引 | Slark 用"团队运营机制"代替静态 Wiki |
| N-13 | 跨 Project Agent 复用 | 每个 Project 独立创建同名 Agent |
| N-14 | `origin` 字段 / 多种 workflow 生成路径的历史兼容字段 | 最终设计即最终形态 |

---

## 9. Sprint 路线图（MVP 交付计划）

按 6 层架构自底向上递进，**每个 Sprint 都有可演示的战略价值**：

### Sprint 1：Foundation + Goal → AI Team（战略雏形）

**交付**：用户能在 3 分钟内从 Goal 得到一个可用的 AI Team。

**范围**：
1. Schema 重构：`projects` 表 / `channels.project_id` / `agents.project_id` / `agent_runs` 表 / 删 `agents.status`
2. `projects.goal` 必填字段
3. `Team Architect` System Agent（首个 System Agent 落地）
4. Create Project 向导：Name → Goal → Workspace → **AI Team Suggestion 卡片 → Approve**
5. Sidebar Project 切换器（对齐原版 KaisTeam ▼）
6. 隔离修复：K-1 / K-3 / K-4
7. Agent Profile 从 3 Tab 改为 PROFILE / ACTIVITY（FEEDBACK Tab 待 Sprint 5）

**战略价值**：第一次实现 "Goal → AI 配 Team"，Slark 的"AI Team OS"雏形显现。用户见到产品的**第一分钟**就能感受到差异化。

**不在 Sprint 1**：Workflow / Responsibility / Knowledge / Capability

### Sprint 2：Workflow Framework（甬道落地 - Template 路径）

**交付**：内置 3 个 Workflow 模板，用户 `/new-feature` 可驱动整个 thread。

**范围**：
1. `workflows` / `workflow_runs` 表
2. YAML 解析器 + 执行引擎（step 路由、状态机、超时、abort）
3. 3 个内置模板：`feature-development` / `bug-fix` / `research`
4. `/trigger` 或 `/new-feature` 等 command 触发
5. Thread 内 workflow 进度可视化（当前 step 高亮、已完成步骤打勾）
6. 简化 responsibilities：从 YAML 自动推导 executor

**战略价值**：Slark 从"聊天室"跃升为"工作流引擎"。用户首次看到"Agent 不是自由 @mention 乱跑，而是在甬道里有序推进"。

### Sprint 3：Responsibility + User Intervention（职责框架 + 用户介入）

**交付**：Workflow 中用户可以随时介入、批准、拒绝、override。

**范围**：
1. `responsibilities` 表（从 workflow YAML 自动生成，也可 UI 编辑）
2. Approval flow：`await_approval` step 弹出到用户 Inbox
3. Slark 指令协议：`/approve` / `/reject` / `/abort` / `/override` / `/comment`
4. Thread 内 Approval Card 组件
5. Workflow YAML Import / Export（文件）

**战略价值**：AI 团队**有边界、可控、可审计**。用户成为整个系统的最终 approver。

### Sprint 4：Delivery Loop（沉淀 + Team-First-Collaborative 上线）

**交付**：每个 Workflow 结束后自动沉淀知识；引入 Team-First 协同设计 Workflow 能力。

**范围**：
1. `Scribe` System Agent
2. `decisions` / `lessons` 表
3. Project 新增 **Intelligence Tab**（Pending Queue + Knowledge Base + Decisions List）
4. Scribe 的 pending review 审批流
5. ContextBuilder 升级：按 audience / tags 过滤注入 lessons / decisions（token 预算内）
6. **Facilitator System Agent**（Team-First-Collaborative 路径）
7. "Create Workflow from Team Discussion" 入口：触发 Facilitator Session

**战略价值**：Slark 成为**项目知识资产的管理后台**。用户团队的每一次协作产出自动沉淀。Team-First-Collaborative 作为核心差异化能力首次上线。

### Sprint 5：Evolution Loop（Agent 成长）

**交付**：Agent description 会随时间演化，团队越用越强。

**范围**：
1. `Evaluator` System Agent（后台定期评估）
2. `Coach` System Agent（生成 description 修改建议）
3. `agent_feedback` 表（审批 + 回滚轨迹）
4. Agent Profile **FEEDBACK Tab**（Coach 建议列表 + Apply/Reject）
5. Apply 后 `agents.description` 实际更新 + 记录 diff

**战略价值**：连续使用 3 个月后，用户可以明确感受到 "Agent 团队的交付质量提升"。达成 S-6 成功标准。

### Sprint 6：Onboarding Loop + Skill Matrix（锦上添花）

**交付**：新 Project 自动生成 onboarding 包；Agent 能力地图自动维护。

**范围**：
1. `Onboarder` System Agent（分析 README / package.json / git history 生成 project_overview）
2. `project_onboarding` 表
3. `agent_skills` 表（从 tool_call 自动统计模块覆盖）
4. Create Task 时自动推荐 assignee（基于 Skill Matrix）

### Sprint 7+：远期迭代

- 跨 Project 经验迁移（Reuse Loop 升级）
- Workflow 自身的演化（"这个 step 老卡，是否拆分"）
- Workflow Marketplace / Team Template 共享
- Codex / Claude Code 多 runtime

---

## 10. 待决议事项

Sprint 1 启动前需要拍板的议题。其他议题在对应 Sprint 前决定。

### 已决议（Sprint 1 范围）

| # | 议题 | 决议 | 决议日期 |
|---|------|------|---------|
| Q-1 ✅ | Team Architect 推导 Team 用哪个 runtime? | **Cursor Agent**（和业务 Agent 一致，复用 CLIAdapter 架构）| 2026-04-23 |
| Q-2 ✅ | 没装 cursor-agent 的用户如何 seed first Agent? | **欢迎页引导安装 CLI，不强制**（无 CLI 时 Create Project 流程在 Team Suggestion 步骤友好降级）| 2026-04-23 |
| Q-3 ✅ | `projects.goal` 的长度上限? | **500 字符**（鼓励简洁，超出截断 + UI 提示）| 2026-04-23 |

### 待决议

| # | 议题 | 建议默认 | Deadline |
|---|------|---------|---------|
| Q-4 | Workflow YAML 的版本控制? | 存 SQL + 提供 Export，不做 SQL 内 version 字段 | Sprint 2 启动前 |
| Q-5 | System Agent 的 token 消耗是否计入 Agent 配额? | 独立配额（每月 $X 给系统 Agent）| Sprint 4 启动前 |
| Q-6 | Coach 建议 Apply 后能否回滚? | 能，`agent_feedback` 保留完整 diff 历史 | Sprint 5 启动前 |
| Q-7 | Scribe 沉淀的 lessons 是否默认 public 到其他 Project? | 默认 Project-private，Sprint 7+ 再讨论迁移 | Sprint 4 启动前 |
| Q-8 | Facilitator Session 的触发是自动（Team 组建完成后）还是手动? | Sprint 4 先手动触发，用户有掌控感 | Sprint 4 启动前 |

---

## 11. 对 `PLAN.md` / `technical-decisions.md` 的更新指引

v1.0 升级影响面很大，需要联动更新：

### Schema 总清单（Sprint 1 执行）

```sql
-- 1. projects 表（新建）
CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  workspace_path  TEXT NOT NULL,
  goal            TEXT NOT NULL,
  team_rules      TEXT,
  color           TEXT,
  created_at      INTEGER NOT NULL
);

-- 2. channels / agents 加 project_id（NOT NULL）
-- （现有数据直接清空重建，见 N-14 的无历史迁移原则）
ALTER TABLE channels ADD COLUMN project_id TEXT NOT NULL REFERENCES projects(id);
ALTER TABLE agents   ADD COLUMN project_id TEXT NOT NULL REFERENCES projects(id);

-- 3. agent_activity 加 channel_id（K-3）
ALTER TABLE agent_activity ADD COLUMN channel_id TEXT REFERENCES channels(id);
CREATE INDEX idx_activity_agent_channel ON agent_activity(agent_id, channel_id, created_at DESC);

-- 4. agents.status → agent_runs 表（K-1）
ALTER TABLE agents DROP COLUMN status;
CREATE TABLE agent_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK(status IN ('thinking','working','error','stopped')),
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER
);
CREATE INDEX idx_agent_runs_active ON agent_runs(agent_id, channel_id) WHERE ended_at IS NULL;
```

**Sprint 2+ 的 schema**（workflows / workflow_runs / responsibilities / decisions / lessons / agent_feedback / project_onboarding / agent_skills）在各 Sprint 启动时追加，此处不预先列全。

### PLAN.md 需要的重写

PLAN.md 当前是 MVP-1 ~ MVP-9 的结构，v1.0 后需要**按 Sprint 1~6 重新组织**。建议：
- 保留 Phase 0（已完成）和 Phase 0.5（已完成）的 CLI Spike 和 UI Reference 章节
- 原 Phase 1~3 的 MVP-1~MVP-9 合并为 Sprint 1 的子任务
- 新增 Sprint 2~6 章节，每个含验收清单

### technical-decisions.md 需要的更新

- **D-1** Agent 状态机扩展：保留 5 状态，但说明"per-channel 派生自 `agent_runs`"
- **D-6** 链式触发计数维度：明确 per-thread
- **D-8** Agent Workspace 规则：整体作废，改为 "Slark 不提供 Agent 独立 workspace"
- **D-9** Seed 数据：改为 "首次启动显示欢迎页引导 Create Project，不预置任何 Project / Agent / Channel"
- **新增 D-13** ~ **D-20**：对应 v1.0 的新决策（Goal 一等公民 / Workflow YAML / Responsibilities / System Agents / 运营闭环 / 隔离契约等）

### docs/ui-reference/ 需要的更新

- `components.md` 新增：Project 切换器、Create Project 向导、Team Suggestion 卡片、Workflow 进度条、Intelligence Tab、FEEDBACK Tab、Approval Card
- `routes.md` 路由从 `/channel/{id}` 改为 `/p/{projectName}/channel/{id}`，新增 `/p/{name}/intelligence`
- `local-adaptations.md`：修订，原 "去掉 Server 概念" 作废，改为 "Server 重命名为 Project，保留切换器 UI"

---

## 12. 版本历史

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v0.1 | 2026-04-22 | 首版：Channel 即 Project 简化模型 | - |
| v0.2 | 2026-04-23 | 校准：Server = Project；引入 projects 表 | - |
| v0.3 草案 | 2026-04-23 | 聚焦编程协作 / 砍自主学习型 Agent / 无 Agent workspace | - |
| **v1.0** | 2026-04-23 | **产品定位跃升**：Programmable AI Team OS；6 层架构；4 Loop；6 System Agents；Sprint 1~6 路线图；schema 不保留历史兼容字段 | - |

---

**本文档的角色**：产品层的北极星。任何新需求 / 新功能先问"是否符合 §1 定位和 §8 非目标"；冲突时要么拒绝，要么先修订本文档。
