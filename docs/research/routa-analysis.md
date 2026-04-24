# Routa 项目调研：Slark 可借鉴点分析

> **调研对象**: [phodal/routa](https://github.com/phodal/routa)（762 stars，active，MIT）
> **调研日期**: 2026-04-23
> **调研目的**: 分析 routa 的设计思路，提取可供 slark 借鉴的设计点，并明确不建议照搬的边界
> **参考版本**: main 分支截至 2026-04-22（Routa Desktop v0.18.0）

---

## 一、执行摘要（TL;DR）

### 整体判断

Routa 和 Slark 都属于 **多 Agent 编程协作** 赛道，但协调哲学截然不同：

| 维度 | Slark | Routa |
|------|-------|-------|
| 核心隐喻 | **聊天室**（Slack 式） | **协调平台**（看板 + 交付流水线） |
| 协调单元 | Channel + Thread | Kanban Card + Lane |
| Agent 驱动 | `@mention` 链式触发 | Kanban 列流转 + 特化 specialist |
| 作用域模型 | Project → Channel → Agent | Workspace → Board → Card → Session |
| 交付合同 | description + 历史消息 | specialist prompt + 证据契约（Dev Evidence / Review Findings / Completion Summary） |
| 验证边界 | 无明确 Gate（Agent 自评） | 分层 Gate（Harness Monitor + Entrix Fitness + Gate Specialist） |
| 运行形态 | 单后端（Fastify + SQLite） | 双后端（Next.js + Rust/Axum/Tauri） |
| 协议栈 | 自定义 WebSocket + NDJSON | ACP + MCP + A2A + AG-UI + A2UI + REST + SSE |
| 安装心智 | 本地单机、单用户 | 本地 desktop + self-hosted web 双形态 |

### 核心结论

1. **Routa 明显更"重"**，面向"企业级软件交付"。Slark 定位"本地单用户聊天室"，两者不是同类产品，**不适合做全面对标**
2. **真正值得借鉴的是 Routa 的几个设计思想**，而非它的形态或实现：
   - **Specialist 外化 + 角色合同**（ADR 0005）
   - **下游不信任上游的防御式 prompt**（ROUTA → CRAFTER → GATE）
   - **ADR 格式的架构决策记录**
   - **证据驱动的消息/任务扩展字段**
3. **明确不建议照搬**：双后端架构、Kanban-driven 自动化、MCP/ACP/A2A 多协议栈、Fitness Gate 体系。这些都与 Slark 的 "本地单用户聊天室" 定位相冲突（见 §六）
4. **P0 可立即落地的借鉴点有 3 个**（低成本高价值，见 §5.1），MVP 完成后推进

### 结论一句话

> Routa 是一个值得学习但不值得模仿的项目：**学其设计思想，不学其形态与规模**。Slark 的差异化卖点恰恰是 Routa 的对立面——"轻"、"本地"、"聊天室隐喻"。

---

## 二、Routa 项目概览

### 2.1 项目基础数据

- **GitHub**: [phodal/routa](https://github.com/phodal/routa)
- **Stars**: 762（活跃，24 个 Release，最新 Desktop v0.18.0 @ 2026-04-22）
- **提交量**: 3,527 commits
- **许可证**: MIT
- **语言比例**: TypeScript 61.2% / Rust 31.2% / JavaScript 3.6% / Python 3.6%
- **作者**: [phodal](https://github.com/phodal)（黄峰达 / Phodal Huang，国内较活跃的架构与 AI 工程实践开源作者）

### 2.2 产品定位（官方原文）

> **Workspace-first multi-agent coordination platform for software delivery**
>
> Routa 是一个以工作区为核心的多智能体协同平台，面向真实的软件交付流程。它把目标、任务、会话、追踪、证据和评审状态放回看板，而不是让这些信息淹没在单一聊天线程里。

**关键词**：
- **Workspace-first**：所有实体以 workspace 为顶层作用域
- **Multi-agent coordination**：多 Agent 编排，非单 Agent 聊天
- **Software delivery**：面向真实交付流程，不是写 demo
- **Kanban orchestration**：看板是核心协调界面（UI + 总线）
- **MCP / ACP / A2A support**：把自己定位为"agent 协议的枢纽"

### 2.3 运行形态

| 入口 | 适用场景 | 技术栈 |
|------|---------|--------|
| Desktop | 完整产品体验、本地优先 | Tauri + Rust/Axum + SQLite |
| CLI | 终端工作流、脚本化 | routa-cli（npm）+ routa-cli（crates.io） |
| Web | 自托管 / 浏览器接入 | Next.js 16.2 + Postgres/SQLite |

> 重点：**Web 和 Desktop 是"同一产品的两个运行表面"**，通过 `api-contract.yaml` 强制语义一致（ADR 0001），而不是两个独立产品。

### 2.4 核心协议栈

Routa 刻意把自己包装成"Agent 协议枢纽"：

| 协议 | 入口 | 用途 |
|------|------|------|
| REST | `/api/*` | 业务 CRUD |
| MCP | `/api/mcp`, `/api/mcp/tools` | 工具执行 + 协作能力 |
| ACP | `/api/acp/*` | spawn / prompt / stream / 运行时管理 |
| A2A | `/api/a2a/*` | Agent-to-Agent 互操作 |
| AG-UI | `/api/ag-ui` | UI 面向的 agent 流协议 |
| A2UI | `/api/a2ui/*` | Dashboard UI 协议表面 |
| SSE | ACP / notes / AG-UI 等 | 增量推送 |

### 2.5 核心交付能力（当前版本）

摘录自 "What You Can Do Today"：

- 创建 workspace 级别的 overview / Kanban / session / team / codebase 视图
- Agent 会话：create / prompt / cancel / reconnect / streaming / trace 检查
- 通过队列和每看板自动化策略在 specialist 泳道间路由任务
- 本地仓库管理：worktree / 文件搜索 / Git refs / commit 检查
- 将 GitHub 仓库导入为虚拟 workspace（浏览 tree / files / issues / PRs / comments）
- 接入 MCP 工具和自定义 MCP server
- schedule / webhook / background task / workflow run 做持续自动化
- 基于 findings / severity / trace / harness signals / fitness report 的评审
- Local-first desktop 模式 或 self-hosted web 模式

---

## 三、Routa 核心设计思想（深入分析）

### 3.1 Workspace-first 作用域（ADR 0003）

**决策**：所有实体（sessions / tasks / notes / kanban boards / codebases / worktrees / memories / schedules）都属于某个 workspace。API 路由必须显式携带 workspace context。

**演化背景**：早期版本用隐式全局作用域，导致：
- 不同项目的 session 混在同一个列表里
- Agent 配置或 specialist 应用边界不清
- MCP 工具作用域模糊（"git status" 指哪个 repo？）

**当前状态**：还在完成 workspace-centric 归一化，部分路径仍回退到 `"default"` workspace，被明确称为"迁移脚手架"，不是目标模型。

**对 Slark 的镜像**：Slark v0.2 已把 "Project = 顶层作用域"（见 `docs/product-brief.md` §7），方向完全一致。不需要额外借鉴。

### 3.2 Kanban-driven 自动化（ADR 0004）

**决策**：Kanban 列流转 = 自动化触发器。核心流程：

```text
1. Card 移动到 automation.enabled=true 的列
2. column-transition.ts 发出 COLUMN_TRANSITION 事件
3. workflow-orchestrator.ts 接收事件，通过 agent-trigger.ts 构建任务 prompt
4. 在 kanban-session-queue.ts 中排队（per-board concurrency limit 默认 1）
5. session 完成后，队列中下一张卡片自动晋升
6. 过期检测移除已移动或已有 session 的条目
```

**核心洞察**：Kanban **不是 UI 投影，而是协调总线**。代码里任何修改列状态的地方都要意识到"可能触发自动化"。

**ADR 0007 补充**：列流转的"交付准备度"（requireCommittedChanges / requireCleanWorktree / requirePullRequestReady）被显式建模为 `KanbanColumnAutomation.deliveryRules`，UI / REST API / MCP `move_card` / specialist prompt **共用一份策略评估器**，避免一条转换在不同路径下被不同 gate 拦截的不一致。

**对 Slark 的参考价值**：中等。Slark 当前 Tasks 面板仅是视觉状态，无自动化语义。详见 §5.3 P1 借鉴点 B-6。

### 3.3 分层 specialist 架构

这是 Routa **最有借鉴价值**的部分。它把 Agent 责任拆成 **两层**：

#### 第一层：核心角色（core roles）

```text
ROUTA (Coordinator) —— 只计划、只委派，永不编辑文件
CRAFTER (Implementor) —— 只实现范围内改动，不做顺手重构
GATE (Verifier) —— 只验证验收标准，证据不足不通过
```

每个核心角色有 `system_prompt`、`role_reminder`、`model_tier`、`default_adapter` 等字段（YAML 格式）。

**ROUTA Coordinator 硬规则**（摘录自 [routa.yaml](https://raw.githubusercontent.com/phodal/routa/main/resources/specialists/core/routa.yaml)）：

> 1. **NEVER edit code** — You have no file editing tools. Delegate implementation to CRAFTER agents.
> 2. **NEVER use checkboxes for tasks** — No `- [ ]` lists. Use `@@@task` blocks ONLY.
> 3. **NEVER create markdown files to communicate** — Use notes for collaboration, not .md files in the repo.
> 4. **Spec first, always** — Create/update the spec BEFORE any delegation.
> 5. **Wait for approval** — Present the plan and STOP. Wait for user approval before delegating.
> 6. **Waves + verification** — Delegate a wave, END YOUR TURN, wait for completion, then delegate a GATE.

**GATE Verifier 硬规则**：

> 1. Acceptance Criteria is the checklist. Do not verify against vibes, intent, or extra requirements.
> 2. No evidence, no verification.
> 3. No partial approvals. "APPROVED" only if every criterion is ✅ VERIFIED.
> 4. If you can't run tests, say so. Then compensate with stronger static evidence and label confidence.
> 5. Don't expand scope.

**GATE 输出格式**强制要求：Verdict + Confidence + 逐条 AC 状态（✅ / ⚠️ / ❌）+ Evidence index + Tests/Commands run + Risk Notes。

#### 第二层：看板泳道 specialist（kanban lane specialists）

每个 Kanban 列对应一个 specialist，**下游 specialist 默认不信任上游产物**：

| 泳道 | Specialist | Prompt 强制要求 | 产物写回卡片 |
|------|-----------|----------------|-------------|
| Backlog | Backlog Refiner | 只澄清，不编码；必须产出恰好一个 canonical YAML story | 含 AC / constraints / dependencies / out-of-scope / INVEST 快照 |
| Todo | Todo Orchestrator | 重新解析 YAML，拒绝质量不足卡片，产出 execution-ready brief | Execution Plan / Key Files / Dependency Plan / Risk Notes |
| Dev | Dev Crafter | 再次确认卡片可执行，只实现范围内改动，提交 + 干净 git | Dev Evidence（修改文件 / 测试记录 / 逐条 AC 验证 / 注意事项） |
| Review | Review Guard | 独立验证每条 AC，拒绝缺失证据、scope creep、dirty git | Review Findings（verdict / 逐条 AC 状态 / 发现的问题） |
| Done | Done Reporter | 终态，只留完成记录 | Completion Summary（交付内容 / 关键证据 / 完成时间） |
| Blocked | Blocked Resolver | 分类 blocker、解释根因，只有明确下一步时才路由回去 | Blocker Analysis（type / root cause / resolution / routing decision） |

**防御式设计的关键**：

> 下游不信任上游 —— Todo distrusts Backlog, Dev distrusts Todo, Review distrusts Dev。

这让错误在早期就能暴露，而不是"Agent 出了乱七八糟的代码但 Reviewer 也看不出"。

**Backlog Refiner 的 Exit Gate（自查清单）**：

| Todo will check | Your self-check |
|-----------------|-----------------|
| Canonical ```yaml block exists and parses | Would Todo be able to extract and parse the YAML without guessing? |
| `story.acceptance_criteria` has ≥ 2 testable items | Are there at least 2 AC items? Is each one objectively verifiable? |
| `story.constraints_and_affected_areas` is filled | Did you identify affected files, modules, or APIs? |

**对 Slark 的参考价值**：**高**。Slark 当前 Agent description 是自由文本，没有角色合同。详见 §5.1 B-2、§5.1 B-3。

### 3.4 Review Gate 三层架构

> "The delivery gate is a stacked decision path, not a single reviewer persona."

Routa 把 Review 拆成三层独立责任：

| 层级 | 名称 | 回答什么问题 | 典型输出 |
|------|------|------------|---------|
| 第一层 | **Harness Monitor** | "到底发生了什么？" | traces / 改动文件 / 执行命令 / git 状态 / 归因 |
| 第二层 | **Entrix Fitness** | "哪些事情必须成立？" | hard gates / 证据要求 / 文件预算 / 策略检查 |
| 第三层 | **Gate Specialist** | "这张卡是否可以前进？" | 逐条 AC 验证 + 路由决策（Done / Dev / 人工升级） |

**关键思想**：Review **不是另一个 Reviewer 的意见**，而是 "三个独立证据源的交叉验证"。

**对 Slark 的参考价值**：**偏低**（规模不匹配）。Slark 作为单用户本地工具不需要这么重。但"Review 是真正的 Gate，不是另一个有意见的 Reviewer"这个**思想**值得吸收，见 §5.3 P2-B-9。

### 3.5 Provider 归一化到 ACP（ADR 0002）

**决策**：所有 Agent CLI 运行时通过 per-provider adapter 归一化到 ACP（Agent Client Protocol）。

```text
Provider process or bridge
  → provider-specific output / notifications
  → adapter normalization
  → unified session updates
  → persistence, traces, UI streaming
```

**实现**：
- 标准 ACP-compatible CLI 直接对接
- Claude Code SDK 的 `stream-json` 流被 `claude-code-sdk-adapter.ts` 翻译为 ACP-like updates
- Docker-backed OpenCode 用同样的 adapter 模式
- Per-session 模型配置替代全局 env-var 模型选择（issue #33）

**对 Slark 的镜像**：Slark Phase 0 已经做了类似的事情：`CLIAdapter` 抽象 + `CLIEvent` 统一事件类型（text_delta / tool_started / tool_completed / error / done）。方向完全一致。

不需要额外借鉴，**但可以确认当前方向正确**。

### 3.6 Specialist 外化为 Markdown + YAML（ADR 0005）

**决策**：Specialist 不再硬编码在 TypeScript，而是以 Markdown + YAML frontmatter 外部化，按优先级链加载：

1. **Database 用户 specialist**（最高）—— 按 workspace 覆盖
2. **用户文件系统**（`~/.routa/specialists/*.md`）—— 用户级默认
3. **Bundled resources**（`resources/specialists/*.md`）—— 随产品分发
4. **硬编码 fallback** —— 最后兜底

**文件格式示例**：
```yaml
---
name: developer
description: Implements code changes
modelTier: standard
role: developer
roleReminder: Focus on clean, tested implementation
---
# Behavior instructions in Markdown body
```

**直接后果**：
- 新增 specialist role = 新增一个 `.md` 文件，不用改 TS 代码
- 用户可以覆盖任何内置 specialist
- DB > 文件 > bundled 的优先级是**确定性**的

**对 Slark 的参考价值**：**高**。详见 §5.1 B-2。

### 3.7 双后端语义一致性（ADR 0001）

**决策**：Web（Next.js）和 Desktop（Tauri + Rust）是 **一个产品的两个运行表面**：

1. 共享 domain model 词汇（workspace / session / task / kanban board / specialist / worktree）
2. 暴露相同的 API 形状，由 `api-contract.yaml` 统一契约
3. CI 跑 API 契约一致性测试（`npm run api:test:nextjs` vs `npm run api:test:rust`）

TypeScript 装配点是 `src/core/routa-system.ts`，Rust 装配点是 `crates/routa-core/src/state.rs`，二者在同样的 store / EventBus / domain services 上装配。

**对 Slark 的参考价值**：**不适用**。Slark 是单后端，不需要双后端一致性。但 `api-contract.yaml` 作为**前后端契约源**的做法，可迁移到 Slark 的 `packages/shared/src/events.ts`（当前已有，可以加强）。见 §6.1。

### 3.8 Orchestration Shell 模式（ADR 0006）

**决策**：长文件必须遵循 "**orchestration shell + domain hooks**" 结构：
- **orchestration shell**：薄的顶层入口，只路由流程、协调模块，**不承担实现负担**
- **domain hooks / modules**：实际逻辑，每个聚焦一个稳定 workflow boundary

**抽取顺序**：
1. 先按 workflow 分支拆（如 session 创建 vs prompt streaming vs provider dispatch）
2. workflow 分支稳定后再抽共享 helper
3. **永远不要一上来就建 `utils.ts`**（真正的重量往往在某个协议分支里）

**对 Slark 的参考价值**：**高**（编码风格）。Slark 未来的 `packages/server/src/messaging/` 和 `packages/server/src/agents/` 可能会膨胀，提前确立这一原则有益。

---

## 四、Routa vs Slark：定位差异

### 4.1 核心隐喻对比

| 维度 | Slark | Routa |
|------|-------|-------|
| 用户打开第一眼看到 | 频道列表 + 消息流 | Workspace Dashboard + Kanban |
| 用户发起工作方式 | "@Agent 帮我..." | "Create Card → 描述目标" |
| Agent 被谁触发 | 用户 @mention / 链式 @mention | 用户拖卡 / Kanban 自动化 |
| 交付确认方式 | Agent 自己说完了 | 卡片抵达 Done 列 + Review Gate 通过 |
| 协作痕迹载体 | 消息线 + Thread | Card 的多段产物（story / brief / evidence / findings / summary） |

### 4.2 Agent 概念差异

| 维度 | Slark Agent | Routa Specialist |
|------|-------------|------------------|
| 定义方式 | Create Agent Dialog 填 name / description / runtime / model / env_vars | Markdown + YAML frontmatter 文件 |
| 角色分化 | 无（每个 Agent 都是"通用助理"，靠 description 暗示） | 强分（ROUTA / CRAFTER / GATE / Backlog Refiner / ...） |
| 行为约束 | 靠用户写 description 暗示 | 靠 `system_prompt` 显式约束 + role_reminder 强化 |
| Prompt 强度 | 弱（只注入 description 和历史） | 强（注入 system_prompt + 防御式指令 + 工具列表） |
| 可扩展性 | 增加 Agent 通过 UI 创建 | 增加 Specialist 通过新建 `.md` 文件 |
| 跨用户共享 | 不支持（本地单用户） | 支持（DB > 用户目录 > bundled 优先级） |

### 4.3 数据模型差异

```
Slark:
  Project (= workspace)
    └── Channel
        ├── Messages（主线 + Thread）
        └── Tasks（仅状态变更，无自动化）
    └── Agents（全局或 project-scoped，通过 channel_agents 关联）

Routa:
  Workspace
    └── Kanban Board
        └── Card（随流转逐层加成 story → brief → evidence → findings → summary）
    └── Session（Agent 执行线程，workspace-scoped）
    └── Codebase + Worktree（ephemeral 执行副本）
    └── Notes / Memories / Artifacts
    └── Schedules / Webhooks / Background Tasks / Workflow Runs
```

Routa 的实体数量和关系**明显更重**，面向的是"真实的软件交付流水线"，而非"聊天记录"。

### 4.4 协议栈对比

| 层 | Slark | Routa |
|----|-------|-------|
| 传输 | WebSocket + REST | REST + SSE + MCP + ACP + A2A + AG-UI + A2UI |
| Agent 通信 | 自定义 CLIEvent 接口 | ACP（Agent Client Protocol，标准协议） |
| 工具调用 | 无（CLI 自己管） | MCP（标准工具接口） |
| Agent 互操作 | @mention 触发（同 slark 内） | A2A（跨 Agent 平台） |

**结论**：Routa 追求"**成为生态枢纽**"，Slark 追求"**做好单机体验**"。两个方向没有对错，但**不要混淆**。

---

## 五、可借鉴的设计点（按优先级）

> 下文用 "B-N"（Borrow-N）表示具体借鉴项。每项注明：**价值 × 成本 × 建议时机**。

### 5.1 P0（立刻可做 / 高价值低成本）

---

#### B-1：升级 `technical-decisions.md` 为 ADR 格式

- **价值**: ⭐⭐⭐⭐（高）
- **成本**: ⭐（低）
- **建议时机**: Phase 1 ~ Phase 2 之间 / 下次修改 `technical-decisions.md` 时

**现状**: Slark 当前 `docs/technical-decisions.md` 有 D-1 ~ D-12 共 12 条决策，结构是 "决策 / 理由"，但：
- 缺少 **Context**（背景 / 问题来源）
- 缺少 **Consequences**（后果 / 影响）
- 缺少 **日期 / 状态**（accepted / superseded / deprecated）
- 缺少 **Code References**（关联代码位置）
- 无 supersede 机制（新决策推翻老决策要怎么办？）

**Routa 的 ADR 格式**（摘自 ADR 0003）:

```markdown
# ADR 0003: Workspace-First Scope

- Status: accepted
- Date: 2026-02-25
- Derived from: [design-doc](../design-docs/workspace-centric-redesign.md), [issue #20]

## Context
（问题来源，为什么现在要做决策）

## Decision
（做了什么决定）

## Consequences
（这个决定带来什么后果，包括坏的后果）

## Code References
（哪些代码实现了这个决策）
```

**建议落地**:

1. 保留当前 `docs/technical-decisions.md` 作为**决策索引**（只列 D-编号 + 一句话摘要 + 状态 + 链接）
2. 每个决策拆出到 `docs/decisions/D-N-slug.md` 独立文件
3. 新增字段：`Status` / `Date` / `Context` / `Consequences` / `Code References`
4. 未来决策推翻老决策：老决策状态改为 `superseded`，新决策标注 `Supersedes: D-N`

**可先做的第一步**（如果不想马上做全量改造）：

- 在 `technical-decisions.md` 顶部补一张**决策演化表**：
  ```markdown
  | 决策 | 状态 | 日期 | Supersedes | Superseded by |
  |------|------|------|------------|---------------|
  | D-1 Agent 状态机 | accepted | 2026-04-22 | - | - |
  | D-12 Cursor 流式策略 | accepted | 2026-04-22 | - | - |
  ```

**收益**：
- 未来新人读文档能快速判断"这个决策还有效吗"
- v0.2 已经见证过 product-brief v0.1 → v0.2 的模型校准（Channel=Project → Server=Project），下次再有类似事件可以用 ADR 格式正式记录
- `product-brief.md` 开头的"校准块"可以迁移为标准 ADR

---

#### B-2：引入 Specialist / Agent Template 机制（外化角色合同）

- **价值**: ⭐⭐⭐⭐⭐（极高）
- **成本**: ⭐⭐（中低）
- **建议时机**: MVP-8（Agent 配置 UI）迭代版 / Phase 3+

**现状**: Slark 当前 Agent 的"能力"完全靠用户填 description 暗示（自由文本），没有：
- 角色模板（Architect / Dev / Reviewer / Assistant）
- system_prompt 注入
- 行为约束字段（can_edit_files / can_delegate / must_produce_evidence）

**痛点**：
- 用户创建 Agent 要靠"写好 description"，**进入门槛高**
- 两个用户创建的 "Architect" 可能行为完全不同，**不可复用**
- Slark 的 `docs/product-brief.md` 场景 A 描述"Architect → Dev-Main → Reviewer"分工，但当前**数据模型不支持角色分化**

**建议借鉴 Routa 的外部化机制**（简化版）：

**数据模型**：新增 `agent_templates` 表
```sql
CREATE TABLE agent_templates (
  id              TEXT PRIMARY KEY,            -- 'architect' / 'dev' / 'reviewer'
  name            TEXT NOT NULL,
  description     TEXT,                         -- 模板用途描述
  role            TEXT,                         -- 'coordinator' / 'implementor' / 'verifier'
  system_prompt   TEXT,                         -- 注入到 CLI 的角色 prompt
  role_reminder   TEXT,                         -- 短的单句"每次都提醒"
  recommended_model TEXT,
  can_edit_files  INTEGER DEFAULT 1,            -- 0 表示 Coordinator
  builtin         INTEGER NOT NULL DEFAULT 0,   -- 1 = bundled 模板
  created_at      INTEGER NOT NULL
);

ALTER TABLE agents ADD COLUMN template_id TEXT REFERENCES agent_templates(id);
ALTER TABLE agents ADD COLUMN system_prompt TEXT;  -- 覆盖模板的 system_prompt
```

**Create Agent Dialog 改造**：
- 新增 "From Template" 下拉（顶部），可选 `Architect / Dev / Reviewer / Assistant / Custom`
- 选中模板后，`description` / `system_prompt` 字段自动填充（用户可覆盖）

**运行时**：
- `ContextBuilder` 在拼接 prompt 时把 `agent.system_prompt`（或模板的）作为第一段注入
- 保留原 Slark 的 "团队成员列表 + description + 历史消息" 作为后续段

**文件外化（P1 可做）**：
- 在 `~/.slark/templates/` 支持用户自定义（`.yaml` 或 `.md`）
- 优先级链：`DB agent.system_prompt` > `~/.slark/templates/{id}.yaml` > bundled 模板

**Routa 现成可借鉴的 4 个模板**（需 Slark 化裁剪）：
| 模板 | 用途 | role_reminder |
|------|------|--------------|
| `assistant` | 通用助理（MVP 默认） | "Answer clearly and concisely. Reason step-by-step for non-trivial asks." |
| `architect` | 规划 / 设计 / 不写代码 | "You do NOT edit files directly. Delegate implementation via @mention." |
| `dev` | 按要求实现 / 提交 | "Stay within task scope. Run verification. Commit in small units." |
| `reviewer` | 验证 acceptance criteria | "Verify against ACs only. Require evidence. Output clear VERDICT." |

**收益**：
- 用户三分钟能建出"一个看起来像真同事"的 Agent，而不是盲写 description
- Slark 的核心卖点"多 Agent 协作"有了**落地载体**
- 为 P1/P2 的 Agent-to-Agent 合作（场景 A "Architect → Dev-Main"）打好基础

---

#### B-3：在 system_prompt 里加入"下游防御"指令

- **价值**: ⭐⭐⭐⭐（高）
- **成本**: ⭐（低）
- **建议时机**: B-2 落地的同时

**Routa 启发**：泳道 specialist 的核心设计是**下游不信任上游**。这让"Agent 链式协作中的误差"在早期暴露。

**Slark 场景**：当前 `@Architect 派任务给 @Dev-Main` 的场景里，Dev-Main 收到消息后**立刻开始实现**，没有任何"二次确认"步骤。如果 Architect 方案有漏洞，Dev-Main 直接按漏洞写。

**具体建议**：在内置 `dev` 模板的 system_prompt 里加入：

```text
## Before You Start

Before writing any code, you MUST:
1. Restate in one sentence what you believe the task is (based on the preceding message).
2. List the acceptance criteria you can extract from the upstream message.
3. If the acceptance criteria are vague or missing, STOP and ask the upstream sender for clarification.
   Do NOT proceed with assumed requirements.

## Scope Discipline

- Only implement what was asked. No refactors, no "while I'm here" improvements.
- If you find a related bug not in scope, mention it in a one-line note at the end but DO NOT fix it.
```

**在 `reviewer` 模板里**：

```text
## Verification Discipline (CRITICAL)

1. Verify ONLY against the acceptance criteria. Do not verify against "what I think should be true".
2. For each criterion, answer VERIFIED / DEVIATION / MISSING with concrete evidence.
3. If you cannot run tests, say so explicitly and compensate with static evidence, labeled Low confidence.
4. Output format is strict: "VERDICT: APPROVED|REJECTED" followed by per-AC findings. No vague confidence.
```

**收益**：
- 单 Agent 场景下即可见效（Agent 不会盲目执行模糊指令）
- 多 Agent 场景下形成天然的质量门
- 零 schema 改动，只是 prompt 层面的优化
- 配合 B-2，可以把这些 prompt 作为 bundled 模板的默认值

---

### 5.2 P1（MVP 之后 / 中等价值）

---

#### B-4：扩展消息 metadata 为"证据字段"

- **价值**: ⭐⭐⭐（中）
- **成本**: ⭐⭐（低）
- **建议时机**: MVP 交付后 / 用户反馈"看不清 Agent 到底做了什么"时

**Slark 现状**: `messages.metadata_json` 已经有一部分结构化字段（见 `technical-decisions.md` D-7），包括 `mentions / task_ref / chain_depth / tool_calls / agent_meta / system_event`。

**Routa 启发**: Routa 卡片随流转逐层加成 "story → brief → evidence → findings → summary"，下游 specialist 可以读到上游的结构化产物。

**建议扩展 D-7 `MessageMetadata`**:

```typescript
type MessageMetadata = {
  // 已有字段...
  mentions?: ...;
  task_ref?: ...;
  chain_depth?: ...;
  tool_calls?: ...;
  agent_meta?: ...;
  system_event?: ...;

  // === 新增：Agent 响应的证据面板 ===
  evidence?: {
    // 具体修改的文件（由 CLI tool_calls 聚合而来）
    files_changed?: Array<{
      path: string;
      action: 'created' | 'modified' | 'deleted';
      lines_added?: number;
      lines_removed?: number;
    }>;

    // 执行的验证命令（可选）
    tests_run?: Array<{
      command: string;
      exit_code: number;
      duration_ms: number;
      output_excerpt?: string;  // 截前 200 字符
    }>;

    // Git 产物（可选，Phase 4+ 如果加 git 集成）
    commit?: { sha: string; message: string };

    // 自评验收：Agent 自己对着 AC 打的 checklist
    self_verification?: Array<{
      criterion: string;
      status: 'passed' | 'skipped' | 'failed';
      note?: string;
    }>;
  };

  // === 新增：Agent 回复的分类 ===
  response_kind?: 'answer' | 'plan' | 'implementation' | 'verification' | 'blocker' | 'summary';
};
```

**UI 渲染**：
- 当 `evidence.files_changed` 存在时，消息卡片底部追加一个 **"Changed N files"** 可展开面板（列文件 + 行数）
- 当 `evidence.tests_run` 存在时，渲染一个 **"Verified"** 徽章（全绿）或 **"Failed: 1/3"**（红 + 可展开看哪个挂了）
- 当 `response_kind = 'blocker'` 时，消息整体用红色 system 样式

**收益**：
- Slark 从"Agent 说话的聊天室"升级为"Agent 交付证据的工作台"
- 不需要用户主动展开 Agent 回复里的 tool_calls 也能看到总览
- 为 B-5 / B-6 打基础

---

#### B-5：支持 `@@@task` 结构化任务块（消息 → Task 的零点击转换）

- **价值**: ⭐⭐⭐（中）
- **成本**: ⭐⭐（低）
- **建议时机**: MVP-9（Tasks 面板）之后的迭代 / Phase 4

**Routa 启发**: ROUTA Coordinator 在 spec note 里用 `@@@task ... @@@` 块定义任务，`set_note_content` 自动解析并创建 tasks，返回 taskIds。

**Slark 现状**: Task 只能通过 Tasks Tab 手动 `+ New Task` 创建。"As Task" 复选框在 MVP-5 占位但禁用。

**建议实现**:

1. **扩展 Message Router**：发送消息时扫描 `@@@task ... @@@` 块
2. **解析格式**（简化版，Slark 不需要 Routa 那么复杂）：

   ```
   @@@task @Dev-Main
   # 修复 WebSocket 重连 bug

   ## Scope
   packages/web/src/hooks/useWebSocket.ts

   ## Done when
   - 断网 30s 后能自动重连
   - 重连后订阅状态恢复
   @@@
   ```

3. **自动行为**:
   - 在当前 channel 创建 Task：`title=修复 WebSocket 重连 bug`，`assignee=Dev-Main`，`source_message_id=该消息`
   - 在 messages.metadata_json 里加 `created_tasks: [id]`，消息卡片下方自动显示 "Created #27"
   - 被 `@` 的 Agent 收到消息后优先 claim 这个 Task

4. **与 "As Task" 复选框的关系**:
   - "As Task" 复选框 = 整条消息作为 Task 标题
   - `@@@task` 块 = 一条消息可以声明**多个** Task
   - 两者互补，不冲突

**收益**：
- 用户在写需求时自然地结构化，不用先写消息再手动建 Task
- Architect Agent 可以输出 `@@@task` 块直接创建任务（配合 B-2 的 `architect` 模板）
- 让"消息流 ↔ 任务系统"双向打通

---

#### B-6：Task 状态变更触发 @mention（Kanban 自动化的轻量版）

- **价值**: ⭐⭐⭐（中）
- **成本**: ⭐⭐（中）
- **建议时机**: Phase 4+

**Routa 启发**: Kanban 列流转 = 自动化触发器。Routa 做得很重（有 `kanban-session-queue.ts` / `column-transition.ts` / `workflow-orchestrator.ts`）。

**Slark 场景化裁剪**：不做完整的 Kanban 自动化，只做 **Task 状态变更触发 @mention** 这一个具体能力。

**建议行为**：

| 从 | 到 | 自动动作 |
|----|-----|---------|
| `todo` | `in_progress` | 系统自动发消息 `"📌 {assignee} 开始处理 #{id}"` + 触发 `@{assignee}` |
| `in_progress` | `in_review` | 在 channel 发 `"👀 #{id} 请求 Review"` + 如果配置了 reviewer 则 `@{reviewer}` |
| `in_review` | `done` | 正常 move 消息，无自动触发 |
| 任意 | `blocked`（新增状态？） | 发 system 消息，暂不自动路由 |

**配置位置**：`channels` 表加 `default_reviewer_agent_id` 字段（可选），决定 in_review 时自动 @ 谁。

**注意事项**：
- **不要**让 Task 状态变更触发新 CLI spawn。只在 channel 里发消息 + @mention，由 Agent 自己决定如何响应。这保留了用户对"自动化深度"的控制
- 如果做了，需要在 `docs/technical-decisions.md` 新增 D-13（或用 ADR 格式）

**收益**：
- Kanban 自动化的 "80% 价值"（Task 生命周期驱动协作），但只付出 "20% 成本"
- Slark 保持"聊天室"隐喻不变（自动化依然通过 channel 消息体现）

---

### 5.3 P2（长期 / 低优先级或有争议）

---

#### B-7：Spec Note / Shared Document 作为 Thread 锚点

- **价值**: ⭐⭐（低-中）
- **成本**: ⭐⭐⭐（中-高）
- **建议时机**: 看用户反馈，不建议 MVP 后马上做

**Routa 启发**: ROUTA Coordinator 把 "Spec note" 作为 source of truth，通过 `set_note_content` 持续更新。

**Slark 争议点**：
- ✅ 好处：Architect 写"规范"，Dev 读"规范"实现，Reviewer 对"规范"验证，所有人对着同一份文档而不是散落在消息里
- ❌ 坏处：会引入 Note 实体，让产品从"聊天室"偏向"Notion 式知识库"。Slark 的视觉语言（Neo-Brutalism）和 Slack 心智都不适合重内容编辑

**如果要做**，建议最小方式：
- Thread 可选关联一个 "Spec Message"（就是 Thread 内某条消息被标记为"规范锚点"）
- Agent 在 Thread 内被调用时，system_prompt 注入 Spec Message 内容
- 不建新表，不做 rich editor

**更保守的替代方案**: 什么都不做。Slark 的 Thread + @mention 已经天然充当"共享上下文"的角色。

---

#### B-8：Blocked 消息类型 + Blocker Resolver

- **价值**: ⭐⭐（低）
- **成本**: ⭐⭐（中）
- **建议时机**: Phase 4+ / 用户抱怨"CLI 错误太乱"时

**Routa 启发**: 专门的 "Blocked" 泳道 + Blocked Resolver specialist，把"卡住的问题"显式化。

**Slark 场景**：当前 CLI crash / timeout / parse error 都产生一条红色 system 消息（见 D-11），用户只能自己处理。

**建议**：
- 新增 `messages.metadata_json.response_kind = 'blocker'`（配合 B-4）
- 在 `MessageMetadata.system_event` 里新增 `{ type: 'blocker'; classification: 'environment' | 'dependency' | 'ambiguity' | 'cli_error'; suggested_action: string }`
- UI 给 Blocker 消息加专门的 action bar：`[Retry] [Change Runtime] [Edit Agent Env] [Report]`

**收益**：比单纯的红色错误消息更可操作。但优先级不高（MVP 用户量小，错误直接看日志也行）。

---

#### B-9：分层 Review Gate（Review 边界是 Gate 而非意见）

- **价值**: ⭐⭐⭐⭐（思想借鉴价值高，实现借鉴价值低）
- **成本**: ⭐⭐⭐⭐（高，如果全做）
- **建议时机**: 永远不要全做。吸收思想即可

**Routa 启发**: Harness Monitor + Entrix Fitness + Gate Specialist 三层 Gate。

**不建议全做的原因**：
- Slark 是单用户本地工具，没有"企业交付"压力
- Harness Monitor 级别的 trace 观测对 CLI spawn-per-message 模型来说太重
- Entrix Fitness 是 CI 级别的工具，Slark 没有 CI

**建议吸收的思想**：
- 如果未来 Slark 引入 "Reviewer Agent" 角色（配合 B-2 的 `reviewer` 模板），其 system_prompt 必须包含：
  - "你不是提意见者，你是 Gate"
  - "只对着 acceptance criteria 验证"
  - "输出明确 verdict（APPROVED / REJECTED），不接受模糊判断"
- 这已经在 B-3 中体现。**B-9 = B-3 的思想源头**，不需要额外工作

---

## 六、不建议照搬的点（明确边界）

### 6.1 ❌ 双后端架构（Next.js + Rust/Axum）

**Routa 做法**: Web 和 Desktop 都跑同一套 domain，通过 `api-contract.yaml` 对齐。

**为什么不建议 Slark 做**:
- Slark 定位是**单机单用户**，不需要 Web 部署形态
- 用 Rust 写一套后端来满足 Tauri 是巨大的工作量（Routa 的 `crates/` 有 routa-core / routa-server / routa-cli / routa-rpc / routa-scanner / harness-monitor 等多个 crate）
- Slark 当前选择 Electron/Tauri + 现有 Node 后端（D-10）已经足够
- 双后端一致性测试（`entrix`）会成为 CI 负担

**Slark 的替代**：
- 保留单后端（Fastify + ws + better-sqlite3）
- 需要 Desktop 时用 Tauri 封壳 + 嵌入 Node 子进程（D-10 提到的方向）
- `packages/shared` 作为前后端契约即可

### 6.2 ❌ MCP / ACP / A2A / AG-UI / A2UI 多协议栈

**Routa 做法**: 把自己定位为"Agent 协议枢纽"，对接所有主流 Agent 协议。

**为什么不建议**:
- Slark 的 `docs/product-brief.md` §11 N-3 明确："Agent 账号认证（Slark 侧）不做 —— CLI 工具自己处理认证"
- Slark 的核心创新是"**用 CLI 工具替代 MCP**"（直接 spawn + NDJSON），刻意避开协议层
- 支持 ACP 意味着 Slark 要实现 Agent Client Protocol 的完整语义，违背"本地轻量"定位

**Slark 的替代**:
- 保留 `CLIAdapter` 抽象，只服务于 Slark 内部
- 如果未来要被外部 Agent 工具调用，先考虑 REST API（`/api/agents/:id/prompt`）而非 ACP

### 6.3 ❌ Fitness Gate 体系（entrix）

**Routa 做法**: `entrix run --tier fast | normal` 作为 CI 级别的 fitness 验证工具。

**为什么不建议**:
- Slark 规模小，`pnpm test / typecheck / lint` 一级验证够用
- entrix 本身是一个 Rust crate，维护成本高
- Slark 不做企业级交付，不需要 "policy decision" / "evidence gate" 等抽象

**Slark 的替代**:
- 继续用 Vitest + ESLint + Prettier + TypeScript strict
- 如果需要 "CI 门禁"，用 GitHub Actions 即可

### 6.4 ❌ Kanban 作为核心 UI

**Routa 做法**: Kanban 是核心入口，用户工作从"拖卡"开始。

**为什么不建议**:
- Slark 刻意选择 "Slack 式聊天室" 隐喻（`docs/product-brief.md` §1）
- Kanban 会让产品从"AI 员工聊天室"偏向 "AI Jira"，**目标用户群不一样**
- Slark 已有的频道内 Tasks Tab（MVP-9）是"辅助视图"，不是核心入口

**Slark 的边界**:
- Tasks 是**对话的附属产物**，不是驱动器
- 全局 Kanban 看板明确是 P2（`docs/product-brief.md` R-19）
- B-6（Task 状态触发 @mention）是**极简版** Kanban 自动化，不扩展为全套

### 6.5 ❌ 双语言 i18n / 国际化

**Routa 做法**: AGENTS.md 明确 "All UI-facing strings must go through the i18n system (e.g., `t('key')`)"。Routa 同时发 EN / 中文 README。

**为什么不建议**:
- Slark `docs/product-brief.md` §11 N-9 明确："MVP 英文为主（暖色 UI 英文视觉更协调）"
- i18n 框架引入会让所有 UI 代码都加 `t()` 包装，显著增加认知负担
- Slark 目标用户群较窄（熟悉 CLI 的开发者），英文 UI 足够

**Slark 的边界**:
- UI 全英文（`docs/ui-reference/local-adaptations.md` 已经遵循）
- 文档双语（README.md + 中文文档）

### 6.6 ❌ 通过 GitHub Issue 做外部追踪

**Routa 做法**: AGENTS.md 详细规定了 "Issue Feedback Loop" 流程，`docs/issues/` + GitHub issue 双向同步。

**为什么不建议**:
- Slark 作为个人项目（当前阶段），不需要 issue GC 机制
- 引入 `docs/issues/` 双向同步会增加维护成本
- 本地 TODO + git log 已经足够

**Slark 的边界**:
- 用 Slark 自己的 Tasks 面板做 TODO 管理（吃自己的狗粮）

---

## 七、行动建议

### 7.1 立刻可做（本周 / 下周）

按优先级：

1. **B-1 升级 `technical-decisions.md` 为 ADR 格式**（1-2 小时）
   - 最小改动：在文件头加决策演化表 + 每个 D-N 补 Context / Consequences / 日期
   - 可选进阶：拆分到 `docs/decisions/D-N-*.md`

2. **B-3 在 `docs/technical-decisions.md` 新增 D-13：默认 Agent system_prompt 防御指令**（1 小时）
   - 不用写代码，先确立"Slark 将要注入哪些防御 prompt"
   - 未来实现 B-2 时直接套用

### 7.2 短期规划（MVP 交付后 / Phase 4）

3. **B-2 引入 Agent Template 机制**（1-2 周）
   - Schema：新增 `agent_templates` 表 + `agents.template_id` / `agents.system_prompt`
   - UI：Create Agent Dialog 加 "From Template" 下拉
   - 内置 4 个模板：Assistant / Architect / Dev / Reviewer
   - 运行时：ContextBuilder 注入 system_prompt

4. **B-4 扩展 MessageMetadata 为证据字段**（3-5 天）
   - 仅扩展类型定义（`packages/shared/src/types.ts`）
   - UI 加 "Changed N files" / "Verified" 徽章
   - Cursor Adapter 聚合 tool_calls 到 evidence.files_changed

### 7.3 长期规划（Phase 5+）

5. **B-5 `@@@task` 结构化块** —— 看用户是否真的需要
6. **B-6 Task 状态变更触发 @mention** —— 看 Tasks 面板用量
7. **B-7~B-9** —— 根据用户反馈决定，可能永远不做

### 7.4 需要警惕的陷阱

在任何时候引入借鉴点之前，问一遍：

- [ ] **这个功能会让 Slark 偏离"聊天室"隐喻吗？** 如果会，拒绝
- [ ] **这个功能是否把 Slack 式的协作复杂化为 Jira 式？** 如果是，降级
- [ ] **这个功能要求用户"学一套新概念"吗？** 如果要，慎重
- [ ] **这个功能能用 prompt 层面解决的，是否非要改 schema？** 优先 prompt
- [ ] **这个功能会显著增加冷启动时间或资源占用吗？** 如果会，拒绝

---

## 八、附录

### 8.1 Routa 文档关键链接

| 文档 | 链接 |
|------|------|
| README.md | <https://github.com/phodal/routa/blob/main/README.md> |
| README.zh-CN.md | <https://github.com/phodal/routa/blob/main/README.zh-CN.md> |
| docs/ARCHITECTURE.md | <https://github.com/phodal/routa/blob/main/docs/ARCHITECTURE.md> |
| AGENTS.md | <https://github.com/phodal/routa/blob/main/AGENTS.md> |
| ADR 索引 | <https://github.com/phodal/routa/tree/main/docs/adr> |
| ADR 0001 双后端语义一致性 | <https://github.com/phodal/routa/blob/main/docs/adr/0001-dual-backend-semantic-parity.md> |
| ADR 0002 Provider 归一化到 ACP | <https://github.com/phodal/routa/blob/main/docs/adr/0002-provider-normalization-via-acp.md> |
| ADR 0003 Workspace-first 作用域 | <https://github.com/phodal/routa/blob/main/docs/adr/0003-workspace-first-scope.md> |
| ADR 0004 Kanban 驱动自动化 | <https://github.com/phodal/routa/blob/main/docs/adr/0004-kanban-driven-automation.md> |
| ADR 0005 Specialist 外化 | <https://github.com/phodal/routa/blob/main/docs/adr/0005-specialist-externalization.md> |
| ADR 0006 Orchestration Shell 模式 | <https://github.com/phodal/routa/blob/main/docs/adr/0006-orchestration-shell-pattern.md> |
| ADR 0007 Kanban 交付策略 | <https://github.com/phodal/routa/blob/main/docs/adr/0007-kanban-delivery-transition-policies.md> |
| ROUTA Coordinator Specialist | <https://github.com/phodal/routa/blob/main/resources/specialists/core/routa.yaml> |
| CRAFTER Implementor Specialist | <https://github.com/phodal/routa/blob/main/resources/specialists/core/crafter.yaml> |
| GATE Verifier Specialist | <https://github.com/phodal/routa/blob/main/resources/specialists/core/gate.yaml> |
| Backlog Refiner (Kanban lane) | <https://github.com/phodal/routa/blob/main/resources/specialists/workflows/kanban/backlog-refiner.yaml> |

### 8.2 借鉴点速查表

| 编号 | 借鉴点 | 价值 | 成本 | 优先级 | 建议时机 |
|------|--------|------|------|--------|---------|
| B-1 | ADR 格式文档 | ⭐⭐⭐⭐ | ⭐ | **P0** | 下次改 technical-decisions 时 |
| B-2 | Agent Template 机制 | ⭐⭐⭐⭐⭐ | ⭐⭐ | **P0** | MVP-8 迭代版 |
| B-3 | system_prompt 防御指令 | ⭐⭐⭐⭐ | ⭐ | **P0** | 配合 B-2 |
| B-4 | MessageMetadata 证据字段 | ⭐⭐⭐ | ⭐⭐ | P1 | MVP 交付后 |
| B-5 | `@@@task` 结构化块 | ⭐⭐⭐ | ⭐⭐ | P1 | Phase 4 |
| B-6 | Task 状态触发 @mention | ⭐⭐⭐ | ⭐⭐ | P1 | Phase 4+ |
| B-7 | Spec Note 共享文档 | ⭐⭐ | ⭐⭐⭐ | P2 | 看用户反馈 |
| B-8 | Blocked 消息类型 | ⭐⭐ | ⭐⭐ | P2 | 用户抱怨时 |
| B-9 | 分层 Review Gate（思想） | ⭐⭐⭐⭐ | - | P0 | 已在 B-3 体现 |

### 8.3 Slark vs Routa 快速对比总结

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│    Slark 的定位（永远不变）           Routa 的定位            │
│                                                             │
│    ───────────────────────           ────────────────────    │
│                                                             │
│    本地单用户聊天室                    企业级交付协调平台      │
│    Slack 式隐喻                        Kanban + Flow 式隐喻    │
│    @mention 驱动                       Column 流转驱动         │
│    Cursor CLI spawn                    ACP / MCP / A2A 协议栈   │
│    SQLite 单文件                        Postgres + SQLite + JSONL │
│    Fastify 单后端                      Next.js + Rust/Axum 双后端 │
│    暖黄 Neo-Brutalism                   （不关心视觉风格）     │
│                                                             │
│    === 共同点 ===                                            │
│    多 Agent 协作思想 / Workspace-first 作用域 / Provider Adapter 模式 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.4 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-23 | 首版，基于 routa main 分支截至 2026-04-22 |

---

**本文档的使用说明**：
- 阅读顺序建议：先读 §一（TL;DR）和 §四（定位差异），再读 §五（借鉴点），最后读 §六（不建议借鉴）
- 修订原则：新版本 routa 发布重大变更时同步更新；Slark 落地某个借鉴点后在 §七行动建议中标记状态
