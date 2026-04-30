# Project Status — 项目当前状态（单一状态源）

> **本文档是 Slark 项目的唯一状态来源**。
> 询问"当前进展到哪了 / 下一步做什么 / 还有什么阻塞"时，只看这一份。
> 其他文档（PLAN.md / product-brief.md / technical-decisions.md）不维护状态，只维护内容。

**最近更新**：2026-04-30

---

## 1. 当前位置

| 项 | 值 |
|---|---|
| 当前 Sprint | **Sprint 3 — Responsibility + User Intervention**（Kickoff 中，未动工） |
| 上一 Sprint | Sprint 2 — Workflow Framework（✅ 已交付，见 [`sprint2-milestone.md`](sprint2-milestone.md)） |
| 上上 Sprint | Sprint 1 — Foundation + Goal → AI Team（见 [`sprint1-milestone.md`](sprint1-milestone.md)） |
| 当前分支 | `main` |
| 类型检查 | ✅ pnpm typecheck 通过 |

### Sprint 2 已交付摘要

- ✅ **CP8** Sprint 1 收口（Project scope 路由 / per-channel agent status / drop `agents.status` / Activity filter / D-8 沙盒清理）
- ✅ **CP1** Workflow schema + Repo + REST（schema_version → 4）
- ✅ **CP2** 3 个内置模板（feature-development / bug-fix / research）+ auto-import
- ✅ **CP3** Workflow Runner 状态机 + step 推进 + `/command` 触发 + `/approve` `/reject` `/abort` 指令解析
- ✅ **CP4** Thread 顶部 WorkflowProgress 进度条 + `/command` 提示下拉 + WS `workflow_run_update` 实时推送
- ✅ **CP5** 多 Project 隔离 + Sprint 2 milestone 文档

---

## 2. 当前阻塞 / 待决议

无 Sprint 3 启动阻塞项；可立即启动。

### 已决议（历史，仅供检索）

| # | 议题 | 决议 | 决议日期 |
|---|------|------|---------|
| Q-1 ✅ | Team Architect 用哪个 runtime | Cursor Agent | 2026-04-23 |
| Q-2 ✅ | 未装 cursor-agent 时 Seed 行为 | Welcome 页友好降级 + 兜底三件套 | 2026-04-23 |
| Q-3 ✅ | `projects.goal` 长度上限 | 500 字符 | 2026-04-23 |
| Q-4 ✅ | Workflow YAML 版本控制 | YAML 存 `workflows.definition_yaml` 单字段；不引入 SQL 内 version；YAML 顶部 `version: "1"` 作软声明；历史走 Export → 用户自己 git 管理 | 2026-04-30 |

### 后续 Sprint 待决议（不阻塞当前）

- Q-5 / Q-7（System Agent token 配额、lessons 跨 Project）— Sprint 4 启动前再决议
- Q-6（Coach rollback）— Sprint 5 启动前再决议
- Q-8（Facilitator 触发方式）— Sprint 7 启动前再决议

---

## 3. 已完成 Sprint 摘要

### Sprint 2 — Workflow Framework

详见 [`sprint2-milestone.md`](sprint2-milestone.md)。

- `workflows` / `workflow_runs` 两张新表（schema_version → 4）
- 3 内置模板：`feature-development` / `bug-fix` / `research`
- WorkflowRunner 状态机：running ↔ awaiting_approval → completed/aborted/failed
- `/command` 触发 / `/approve` `/reject` `/abort` 指令解析
- Thread 顶部 WorkflowProgress 进度条 + `/command` 提示下拉

### Sprint 1 — Foundation + Goal → AI Team

详见 [`sprint1-milestone.md`](sprint1-milestone.md)。

- `projects` / `agent_runs` 两张新表
- `/api/projects` CRUD + `/api/projects/suggest-team`（Team Architect 系统 Agent）
- Create Project 三步向导 + Sidebar Project 切换器
- Welcome 页（fresh db 不再预置 `#general`）
- Agent Profile 简化为 PROFILE / ACTIVITY 两 Tab
- Engine 按 `project.workspace_path` 路由 cwd
- Team Architect 兜底三件套（Q-2 / D-19）

---

## 4. 已知技术债

Sprint 1 遗留的 6 项已在 CP8 中清完。Sprint 2 新增的延后项见下表（详细见 [`sprint2-milestone.md`](sprint2-milestone.md) §3）。

| # | 项 | 影响 | 计划清理时机 |
|---|---|------|------------|
| TD-7 | `/abort` 不真正 kill agent CLI 进程 | aborted run 后已 spawn 的 cursor-agent 仍跑完 | Sprint 3 — 把 `/abort` 集成 CLIRunner.abort + `agentRunRepo.listActiveInChannel` |
| TD-8 | Workflow YAML `input` 注入仅 summary（前 1000 字符）| 长输出会被截断，下游 step 看不到完整内容 | Sprint 3+（评估是否值得加 token 预算策略） |
| TD-9 | `/reject` reason 仅注入 prompt，不沉淀 lessons | 反馈不可复用 | Sprint 4 Scribe 落地后顺手补 |
| TD-10 | Workflow Import / Export 未实现 | 用户只能 PATCH definition_yaml 文本 | Sprint 3 §2.5 |
| TD-11 | 用户触发 workflow 后前端不自动跳到 thread | 体验断裂；需手动点 N replies | Sprint 3 UX 优化 |

---

## 5. 下一步建议

Sprint 2 已完成。进入 Sprint 3 — Responsibility + User Intervention。

### Sprint 3 主体（4~5 天）

1. **CP1** `responsibilities` 表（按 `product-brief.md` D-5）+ 从 YAML 自动推导 `executor`
2. **CP2** Approval Card 组件 + Inbox 视图（替代当前 `⏸ Reply /approve...` 文字提示）
3. **CP3** 内联指令协议完整化：`/comment` `/override` 落地；`/abort` 真正 kill agent runs（清掉 TD-7）
4. **CP4** Workflow YAML Import / Export（清掉 TD-10）
5. **CP5** UX 增强：用户触发 workflow 后自动跳 thread（清掉 TD-11）；reject reason 进 lessons 接口预留
6. **CP6** Sprint 3 milestone

详细范围与验收见 [`PLAN.md` Sprint 3](../PLAN.md#sprint-3-responsibility--user-intervention)。

### 启动前 checklist

- ✅ 无待决议项（Q-4 已落定，Sprint 3 范围内无新问题）
- 扫 `docs/clawteam-comparison.md` §4.5：兑现 **B-2** 协调协议注入 + **B-5** Plan Approval
- 扫 `docs/optimization-backlog.md`：评估是否将 **O-1** Task in_progress 自动触发 assignee 纳入 Sprint 3

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
