# Project Status — 项目当前状态（单一状态源）

> **本文档是 Slark 项目的唯一状态来源**。
> 询问"当前进展到哪了 / 下一步做什么 / 还有什么阻塞"时，只看这一份。
> 其他文档（PLAN.md / product-brief.md / technical-decisions.md）不维护状态，只维护内容。

**最近更新**：2026-04-30

---

## 1. 当前位置

| 项 | 值 |
|---|---|
| 当前 Sprint | **Sprint 4 — Delivery Loop（Scribe 沉淀）**（Kickoff 中，未动工） |
| 上一 Sprint | Sprint 3 — Responsibility + User Intervention（✅ 已交付，见 [`sprint3-milestone.md`](sprint3-milestone.md)） |
| 上上 Sprint | Sprint 2 — Workflow Framework（见 [`sprint2-milestone.md`](sprint2-milestone.md)） |
| 当前分支 | `main` |
| 类型检查 | ✅ pnpm typecheck 通过 |

### Sprint 3 已交付摘要

- ✅ **CP1** `responsibilities` 表（schema_version → 5）+ 自动从 YAML 推导 executor / approver
- ✅ **CP2** ApprovalCard 组件（替代 awaiting_approval 文字提示）+ Inbox 跨 Project 视图
- ✅ **CP3** `/comment` `/override` + `/abort` 真正 kill 子进程（清掉 TD-7）
- ✅ **CP4** Workflow YAML Import / Export + WorkflowsPage 管理页（清掉 TD-10）
- ✅ **CP5** 触发 workflow 后前端自动跳到 thread（清掉 TD-11）
- ✅ **CP6** Sprint 3 milestone 文档

---

## 2. 当前阻塞 / 待决议

Sprint 4 启动前需要拍板：

| # | 议题 | 建议默认 | 状态 |
|---|------|---------|------|
| Q-5 | System Agent (Scribe / Evaluator / Coach) 的 token 消耗是否计入 Agent 配额 | 独立配额（每月预算 $X 给系统 Agent） | ⏳ 待拍板 |
| Q-7 | Scribe 沉淀的 lessons 是否默认 public 到其他 Project | 默认 Project-private，跨 Project 复用留 Sprint 8+ | ⏳ 待拍板 |

### 已决议（历史，仅供检索）

| # | 议题 | 决议 | 决议日期 |
|---|------|------|---------|
| Q-1 ✅ | Team Architect 用哪个 runtime | Cursor Agent | 2026-04-23 |
| Q-2 ✅ | 未装 cursor-agent 时 Seed 行为 | Welcome 页友好降级 + 兜底三件套 | 2026-04-23 |
| Q-3 ✅ | `projects.goal` 长度上限 | 500 字符 | 2026-04-23 |
| Q-4 ✅ | Workflow YAML 版本控制 | YAML 存 `workflows.definition_yaml` 单字段；不引入 SQL 内 version | 2026-04-30 |

### 后续 Sprint 待决议（不阻塞当前）

- Q-6（Coach rollback）— Sprint 5 启动前再决议
- Q-8（Facilitator 触发方式）— Sprint 7 启动前再决议

---

## 3. 已完成 Sprint 摘要

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

Sprint 3 已完成。进入 Sprint 4 — Delivery Loop（Scribe 沉淀）。

### Sprint 4 主体（5~7 天）

1. **CP1** Scribe System Agent + `decisions` / `lessons` 表（schema_version → 6）
2. **CP2** Workflow Run 结束后自动触发 Scribe 回扫 → 写 pending review 队列
3. **CP3** Project 新增 **Intelligence Tab**（Pending Review / Knowledge Base / Decisions Timeline）
4. **CP4** ContextBuilder 升级：按 audience + 关键词过滤注入 lessons / decisions
5. **CP5** UX：reject reason 自动转为 lesson 候选；Approval Card 显示相关沉淀
6. **CP6** Sprint 4 milestone

详细范围与验收见 [`PLAN.md` Sprint 4](../PLAN.md#sprint-4-delivery-loopscribe-沉淀)。

### 启动前 checklist

- ⏳ **Q-5** 拍板（System Agent token 配额，建议独立配额）
- ⏳ **Q-7** 拍板（lessons 跨 Project 共享，建议默认 private）
- 扫 `docs/clawteam-comparison.md` §4.5：评估 **B-3** spec note 共享文档是否搭进 Intelligence Tab
- 扫 `docs/optimization-backlog.md`：O-1 Task in_progress 自动触发现仍待排

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
