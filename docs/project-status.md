# Project Status — 项目当前状态（单一状态源）

> **本文档是 Slark 项目的唯一状态来源**。
> 询问"当前进展到哪了 / 下一步做什么 / 还有什么阻塞"时，只看这一份。
> 其他文档（PLAN.md / product-brief.md / technical-decisions.md）不维护状态，只维护内容。

**最近更新**：2026-04-30

---

## 1. 当前位置

| 项 | 值 |
|---|---|
| 当前 Sprint | **Sprint 7 — Team-First-Collaborative Workflow Design**（Kickoff 中） |
| 上一 Sprint | Sprint 6 — Onboarding Loop + Skill Matrix（✅ 已交付，见 [`sprint6-milestone.md`](sprint6-milestone.md)） |
| 上上 Sprint | Sprint 5 — Evolution Loop（见 [`sprint5-milestone.md`](sprint5-milestone.md)） |
| 当前分支 | `main` |
| 类型检查 | ✅ pnpm typecheck 通过 |

### Sprint 6 已交付摘要

- ✅ **CP1** `project_onboarding` / `agent_skills` 表（schema_version → 8）
- ✅ **CP2 + CP3** Onboarder System Agent + Project 创建异步触发 + Onboarding 卡片
- ✅ **CP4 + CP5** Skill Matrix 从 tool_call 自动统计 + Create Task 智能推荐 assignee
- ✅ **CP6** Sprint 6 milestone 文档

---

## 2. 当前阻塞 / 待决议

Sprint 7 启动前需要拍板：

| # | 议题 | 建议默认 | 状态 |
|---|------|---------|------|
| Q-8 | Facilitator Session 触发方式 | 手动触发（用户掌控感） | ⏳ 待拍板 |
| Q-9 | Facilitator Session 最大时长 / token 消耗 | 30 分钟 / 总轮数 ≤ 12 | ⏳ 待拍板 |

### 已决议（历史，仅供检索）

| # | 议题 | 决议 | 决议日期 |
|---|------|------|---------|
| Q-1 ✅ | Team Architect 用哪个 runtime | Cursor Agent | 2026-04-23 |
| Q-2 ✅ | 未装 cursor-agent 时 Seed 行为 | Welcome 页友好降级 + 兜底三件套 | 2026-04-23 |
| Q-3 ✅ | `projects.goal` 长度上限 | 500 字符 | 2026-04-23 |
| Q-4 ✅ | Workflow YAML 版本控制 | YAML 存 `workflows.definition_yaml` 单字段；不引入 SQL 内 version | 2026-04-30 |
| Q-5 ✅ | System Agent token 配额 | 独立 timeout，不计入 per-Agent 配额 | 2026-04-30 |
| Q-6 ✅ | Coach Apply 后能否回滚 | 能；`agent_feedback.description_before` 创建时快照保存 | 2026-04-30 |
| Q-7 ✅ | Scribe lessons 跨 Project 共享 | 默认 Project-private | 2026-04-30 |

### 后续 Sprint 待决议（不阻塞当前）

- Q-8（Facilitator 触发方式）— Sprint 7 启动前再决议

---

## 3. 已完成 Sprint 摘要

### Sprint 6 — Onboarding Loop + Skill Matrix

详见 [`sprint6-milestone.md`](sprint6-milestone.md)。

- `project_onboarding` / `agent_skills`（schema_version → 8）
- Onboarder System Agent（README + package.json + git log → 总结）
- Project 创建后异步触发 Onboarder + Onboarding 卡片
- Skill Matrix 从 tool_call 自动统计 + Create Task `Suggested by Skill Matrix`

### Sprint 5 — Evolution Loop（Agent 成长）

详见 [`sprint5-milestone.md`](sprint5-milestone.md)。

- `agent_observations` / `agent_feedback` 两张新表（schema_version → 7）
- Evaluator 24h cron 扫消息 → 写 observations
- Coach 聚合 negative tag → 产 description 修改建议
- Agent Profile FEEDBACK Tab：Apply / Reject / Rollback（Q-6 决议保留 diff 历史）

### Sprint 4 — Delivery Loop（Scribe 沉淀）

详见 [`sprint4-milestone.md`](sprint4-milestone.md)。

- `decisions` / `lessons` 两张新表（schema_version → 6）
- Scribe System Agent（严格 JSON + 60s timeout + 静默 fallback）
- Workflow 完成自动触发 Scribe；`/sediment` 手动指令
- Intelligence Tab（Pending / Knowledge Base / Decisions）
- ContextBuilder 注入 Project Goal + audience 过滤的 lessons + decisions

### Sprint 3 — Responsibility + User Intervention

详见 [`sprint3-milestone.md`](sprint3-milestone.md)。

- `responsibilities` 表（schema_version → 5）+ 自动从 YAML 推导
- ApprovalCard + Inbox 视图
- `/comment` `/override` 完整化；`/abort` 真正 kill `cursor-agent` 子进程
- Workflow YAML Import / Export + WorkflowsPage 管理页
- 触发 workflow 后前端自动跳 thread

### Sprint 2 — Workflow Framework

详见 [`sprint2-milestone.md`](sprint2-milestone.md)。

- `workflows` / `workflow_runs` 两张新表（schema_version → 4）
- 3 内置模板：`feature-development` / `bug-fix` / `research`
- WorkflowRunner 状态机 + `/command` 触发 + Thread 进度条

### Sprint 1 — Foundation + Goal → AI Team

详见 [`sprint1-milestone.md`](sprint1-milestone.md)。

- `projects` / `agent_runs` 两张新表
- Create Project 三步向导 + Team Architect 系统 Agent + 兜底三件套
- Sidebar Project 切换器；Welcome 页（不再预置 `#general`）
- Agent Profile 简化为 PROFILE / ACTIVITY 两 Tab

---

## 4. 已知技术债

Sprint 3 完成后剩余的延后项（详见 [`sprint3-milestone.md`](sprint3-milestone.md) §3）：

| # | 项 | 影响 | 计划清理时机 |
|---|---|------|------------|
| TD-8 | Workflow YAML `input` 注入仅 summary（前 1000 字符）| 长输出会被截断，下游 step 看不到完整内容 | Sprint 4+（评估是否值得加 token 预算策略） |
| TD-9 | `/reject` reason 仅注入 prompt，不沉淀 lessons | 反馈不可复用 | Sprint 4 Scribe 落地后顺手补 |
| TD-12 | `/override` 在 `running` 状态不支持，必须先 `/abort` | 用户体验略别扭 | Sprint 4+（涉及 step output 占位 + agent kill 同步语义） |
| TD-13 | Responsibilities UI 编辑器缺失（仅自动 derive）| 用户不能手动调整 role/authority | Sprint 7 配合 Facilitator |
| TD-14 | Workflow YAML 行内编辑器缺失 | 必须 export 改了再 import | Sprint 4+ |

**已清理**：TD-1 ~ TD-7（CP8 / Sprint 3 CP3）、TD-10（CP4）、TD-11（CP5）。

---

## 5. 下一步建议

Sprint 6 已完成。进入 Sprint 7 — Team-First-Collaborative Workflow Design。

### Sprint 7 主体（6~8 天）

1. **CP1** `workflow_sessions` 表（schema_version → 9）+ Facilitator 入口
2. **CP2** Facilitator System Agent（多轮对话主持产 YAML draft）
3. **CP3** Workflow Design Session 状态机（轮次推进 / 收敛 / 终止）
4. **CP4** Session 结束后 YAML draft Approve UI（写入 workflows 表）
5. **CP5** Failure 降级提示 + Session 归档
6. **CP6** Sprint 7 milestone + 全项目收尾

详细范围与验收见 [`PLAN.md` Sprint 7](../PLAN.md#sprint-7-team-first-collaborative-workflow-designfacilitator)。

### 启动前 checklist

- ⏳ **Q-8** 拍板（Facilitator Session 触发方式 — 建议手动）
- ⏳ **Q-9** 拍板（Session 最大时长 / 总轮数）

---

## 6. 文档体系（简化后）

| 文档 | 唯一职责 |
|------|---------|
| **本文档**（`project-status.md`）| 项目当前状态 / 阻塞 / 技术债 / 下一步 |
| [`PLAN.md`](../PLAN.md) | 当前 + 未来 Sprint 的范围与验收（不维护"已完成"细节） |
| [`docs/sprint1-milestone.md`](sprint1-milestone.md) | Sprint 1 历史交付记录（不再变更） |
| [`docs/product-brief.md`](product-brief.md) | 战略：定位 / 目标用户 / 核心决策 / 非目标 |
| [`docs/technical-decisions.md`](technical-decisions.md) | 稳定技术决策与默认值（D-N） |
| [`docs/optimization-backlog.md`](optimization-backlog.md) | 已决定但未排期的优化（O-N） |
| [`README.md`](../README.md) | 一句话简介 + 真实启动方式 |

调研 / 视觉 / 实验类（不在主线，仅参考）：

- [`docs/clawteam-comparison.md`](clawteam-comparison.md) — ClawTeam 借鉴条目（B-N）
- [`docs/research/routa-analysis.md`](research/routa-analysis.md) — Routa 借鉴条目
- [`docs/cursorsdkadapter.md`](cursorsdkadapter.md) — Cursor SDK / cookbook 引入条目（S-N）
- [`docs/cli-event-format.md`](cli-event-format.md) — CLI 事件格式
- [`docs/phase0-cli-spike.md`](phase0-cli-spike.md) — Phase 0 验证记录
- [`docs/ui-reference/`](ui-reference/README.md) — UI 视觉基准
- [`spike/README.md`](../spike/README.md) — Phase 0 spike 产物

---

## 7. 维护规则

- **状态变化时只改本文档**。其他文档不要再写"当前 Sprint""已完成 X""下一步 Y"。
- Sprint 切换时：把当前 Sprint 摘要挪到对应 milestone 文档（如 `sprint2-milestone.md`），更新本文档第 1 / 3 节。
- 新决策落地后：把对应 Q-N 从第 2 节移除，必要时迁移到 `technical-decisions.md`。
- 技术债清理后：从第 4 节移除。
