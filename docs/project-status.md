# Project Status — 项目当前状态（单一状态源）

> **本文档是 Slark 项目的唯一状态来源**。
> 询问"当前进展到哪了 / 下一步做什么 / 还有什么阻塞"时，只看这一份。
> 其他文档（PLAN.md / product-brief.md / technical-decisions.md）不维护状态，只维护内容。

**最近更新**：2026-04-30

---

## 1. 当前位置

| 项 | 值 |
|---|---|
| 当前 Sprint | **Sprint 2 — Workflow Framework** |
| 当前焦点 | **CP1 — Workflow schema + Repo + REST**（CP8 Sprint 1 收口已完成） |
| 上一 Sprint | Sprint 1 — Foundation + Goal → AI Team（✅ 已交付，见 [`sprint1-milestone.md`](sprint1-milestone.md)） |
| 当前分支 | `main` |
| 类型检查 | ✅ pnpm typecheck 通过 |

### 已完成的 Sprint 2 子任务

- ✅ **CP8 — Sprint 1 收口**（路由 Project scope / WS agent_status 含 channel_id / StatusDot per-channel / 删除 `agents.status` / Activity Tab channel filter / D-8 沙盒 fallback 死代码清理）

---

## 2. 当前阻塞 / 待决议

无 Sprint 2 启动阻塞项。

### 已决议（Sprint 2 范围）

| # | 议题 | 决议 | 决议日期 |
|---|------|------|---------|
| Q-4 ✅ | Workflow YAML 的版本控制方式 | YAML 存 `workflows.definition_yaml` 单字段；**不引入** SQL 内 version 字段；YAML 顶部 `version: "1"` 作软声明；历史版本走 Export → 用户自己 git 管理；Sprint 2 简化为直接编辑 YAML 文本，Sprint 3 加 Import/Export | 2026-04-30 |

### 后续 Sprint 待决议（不阻塞当前）

- Q-5 / Q-7（System Agent token 配额、lessons 跨 Project）— Sprint 4 启动前再决议
- Q-6（Coach rollback）— Sprint 5 启动前再决议
- Q-8（Facilitator 触发方式）— Sprint 7 启动前再决议

---

## 3. Sprint 1 已交付（摘要）

详细交付清单与手动验收 runbook 见 [`sprint1-milestone.md`](sprint1-milestone.md)。

CP1 ~ CP7 全部完成：

- `projects` / `agent_runs` 两张新表（schema 重构）
- `/api/projects` CRUD + `/api/projects/suggest-team`（Team Architect）
- Create Project 三步向导 + Sidebar Project 切换器
- Welcome 页（fresh db 不再预置 `#general`）
- Agent Profile 简化为 PROFILE / ACTIVITY 两 Tab
- Engine 按 `project.workspace_path` 路由 cwd，spawn 同时记录 `agent_runs`
- Team Architect 兜底三件套（Q-2 / D-19）

---

## 4. 已知技术债

Sprint 1 遗留的 6 项技术债已全部在 CP8 / 文档简化中清理完成。

如有新发现技术债，按以下格式新增记录。

| # | 项 | 影响 | 计划清理时机 |
|---|---|------|------------|
| _（暂无）_ | | | |

---

## 5. 下一步建议

CP8 Sprint 1 收口已完成。下一步进入 Sprint 2 主体。

### CP1 ~ CP5 — Sprint 2 主体（6~8 天）

1. **CP1** Workflow schema + Repo + REST（1 天）
   - `workflows` / `workflow_runs` 两张表
   - REST：`GET/POST/PATCH/DELETE /api/projects/:id/workflows`、`GET /api/workflow-runs/:id`、`POST /api/workflow-runs/:id/abort`
2. **CP2** YAML Parser + 3 内置模板（1.5 天）
   - parser/validator + 3 内置模板（feature-development / bug-fix / research）
   - 模板首次进入 Project 自动 import
3. **CP3** Workflow Runner 核心（2~3 天，最重）
   - 状态机：running / completed / aborted / failed
   - 单步执行 → 等结果 → 推进下一步
   - `await_approval` 最小暂停/继续（完整批准流见 Sprint 3）
4. **CP4** `/command` 触发 + Thread 进度条可视化（1.5 天）
5. **CP5** 多 Project 隔离 + Sprint 2 milestone 文档（0.5 天）

详细范围与验收见 [`PLAN.md` Sprint 2](../PLAN.md#sprint-2-workflow-framework当前焦点)。

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
