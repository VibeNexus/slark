# Sprint 7 Milestone — Team-First-Collaborative Workflow Design (Facilitator)

> **交付日期**：2026-04-30
> **战略锚**：[`docs/product-brief.md`](product-brief.md) §D-15 / [`PLAN.md`](../PLAN.md) Sprint 7
> **战略价值**：Slark "Programmable AI Team OS" 最独特的机制落地 —— Workflow 不是手写也不是模板固化，而是**Team 自己讨论出来的**。护城河从"可用"升级为"独一无二"。

---

## 1. 交付清单

| Checkpoint | 状态 | 核心交付 | commit 前缀 |
|------------|------|---------|-------------|
| **CP1** schema + repo | ✅ | schema_version → 9；`workflow_sessions` 表 + repo；6 状态机 | `feat(sprint7-cp1)` |
| **CP2 + CP3** Facilitator + Session 状态机 | ✅ | `system-agents/facilitator.ts`；`routes/workflow-sessions.ts` 全套 REST；后台 fire-and-forget；YAML 二次校验 | `feat(sprint7-cp2-cp3)` |
| **CP4 + CP5** Approve UI + Failure 降级 | ✅ | WorkflowsPage `✨ From Team Discussion` 按钮；DESIGN SESSIONS 卡片（DRAFTING / AWAITING / APPROVED / REJECTED / FAILED）；自动 4s 轮询 | `feat(sprint7-cp4-cp5)` |
| **CP6** Sprint 7 milestone + 全项目收尾 | ✅ | 本文档 + status sync | `feat(sprint7-cp6)` |

### Q-8 / Q-9 决议落地

- **Q-8 ✅**：Facilitator Session 触发方式 = **手动**（用户在 Workflows 页点 `✨ From Team Discussion` 按钮启动）。
- **Q-9 ✅**：Session 实施约束：**单次 spawn**，`FACILITATOR_TIMEOUT_MS = 90s`。轮数限制隐式（不做多轮 spawn）。多轮版本留 Sprint 8+。

---

## 2. 手动验收 Runbook

### Step 1：启动 Session

1. 进入任意 Project 的 Workflows 页
2. 顶部点 **✨ From Team Discussion**
3. 输入 goal，例如 `An incident-response workflow: triage report, propose fix, ship patch`
4. 点 Start Session

### Step 2：观察状态机

1. 页面上方 DESIGN SESSIONS 出现一条 DRAFTING（脉冲黄色）
2. 90 秒内变成 **AWAITING APPROVAL**（粉色）
3. 卡片显示：rationale 一段 + 折叠的 draft YAML

### Step 3：Approve

1. 点 **▸ Show draft YAML** 检查 YAML 合法性（含 `version`、`trigger.command`、`steps`）
2. 点 **✓ Approve & Save Workflow**
3. 立即跳到 USER section 看到新 workflow，trigger_command 与 YAML 一致
4. 在 #general 输入 `/<trigger_command>` 应能正常驱动 workflow

### Step 4：Reject / Failed / Archive

1. 用错误模型的项目（如没有装 cursor-agent）→ Session 状态变 **FAILED** + fallback_reason
2. 失败时卡片提示用户走 Sprint 2 Template 路径（Import / 手写 YAML）
3. 任何终态可点 **Archive** 隐藏到归档

---

## 3. 已知限制与下一步

### 当前实现是 MVP（单次 spawn）

- **不是真正多轮多 agent 对话**：Facilitator 让 LLM 在内部模拟 round-table 输出 YAML，对话过程不可见。这换来了简单 + 快（90s 内出结果）。
- **真多轮版本（Sprint 8+ 规划）**：Facilitator 多轮串行 spawn 各 Team 成员 → 把对话 thread 化 → 用户能旁听 → 收敛产 YAML。涉及 thread 编排 + token 预算控制 + 中断恢复。

### 其他限制

- **trigger_command 冲突**：Approve 时检查同 project 内是否已有相同 trigger，409 时用户需在 `workflows` 页面删除冲突项再重 approve。
- **每个 Session 只产一份 YAML**：要换思路得新建 session。
- **Session 不可编辑 draft YAML**：只能 Approve / Reject。Approve 后 workflow 可继续 PATCH。

---

## 4. 全项目（Sprint 1 ~ 7）收尾

至此 6 层架构（Goal → Team → Workflow → Responsibility → Knowledge → Capability）+ 4 个运营闭环（Onboarding / Delivery / Evolution / Reuse）+ 6 个 System Agent（Team Architect / Scribe / Evaluator / Coach / Onboarder / Facilitator）全部落地。

### 已交付的 Sprint 列表

| Sprint | milestone | 战略产出 |
|--------|-----------|----------|
| 1 | [`sprint1`](sprint1-milestone.md) | Goal → AI Team；3 分钟可用团队 |
| 2 | [`sprint2`](sprint2-milestone.md) | Workflow YAML 执行引擎；3 内置模板 |
| 3 | [`sprint3`](sprint3-milestone.md) | Approval Card + Inbox + 内联指令完整化 + Import/Export |
| 4 | [`sprint4`](sprint4-milestone.md) | Scribe + Intelligence Tab + ContextBuilder Reuse Loop |
| 5 | [`sprint5`](sprint5-milestone.md) | Evaluator + Coach + FEEDBACK Tab + Description 演化 |
| 6 | [`sprint6`](sprint6-milestone.md) | Onboarder + Skill Matrix + Smart Assignee |
| 7 | 本文档 | Facilitator + From Team Discussion |

### Schema 历史

| version | Sprint | 新增内容 |
|---------|--------|---------|
| 1 | v0 MVP | channels / agents / messages / tasks / agent_activity / saved_messages / meta |
| 2 | Sprint 1 | projects + agent_runs + agent_activity.channel_id |
| 3 | Sprint 2 CP8 | drop agents.status |
| 4 | Sprint 2 CP1 | workflows + workflow_runs |
| 5 | Sprint 3 CP1 | responsibilities |
| 6 | Sprint 4 CP1 | decisions + lessons |
| 7 | Sprint 5 CP1 | agent_observations + agent_feedback |
| 8 | Sprint 6 CP1 | project_onboarding + agent_skills |
| 9 | Sprint 7 CP1 | workflow_sessions |

### 下一步（Sprint 8+ 远期路线）

详见 [`PLAN.md` §Sprint 8+](../PLAN.md#sprint-8-远期路线)。重点候选：

1. **Facilitator 多轮真对话**：把当前 single-shot 升级为多轮 spawn + thread 化（Q-9 真实落地）。
2. **R-18 多 runtime 适配**：Codex / Claude / Kimi / Copilot / Gemini 适配器。
3. **R-19 跨 Project 全局视图**：Inbox / Threads / Tasks 已经做了入口，但跨 Project Kanban 还没。
4. **B-1 Worktree 多 Agent 隔离**：解决 K-5 多 Agent 真正并发改代码冲突问题。
5. **B-3 任务依赖图**：tasks.blocked_by + 自动 unblock。
6. **Agent / Workflow Marketplace**：分享 YAML / Team Template。
7. **Description 演化跨 project 迁移**：当前 Coach 输出仅作用于该 project 内 agent。

---

## 5. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-30 | 初版：CP1~CP6 交付记录 + Sprint 1~7 全项目收尾 |
