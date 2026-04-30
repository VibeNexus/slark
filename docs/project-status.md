# Project Status — 项目当前状态（单一状态源）

> **本文档是 Slark 项目的唯一状态来源**。
> 询问"当前进展到哪了 / 下一步做什么 / 还有什么阻塞"时，只看这一份。
> 其他文档（PLAN.md / product-brief.md / technical-decisions.md）不维护状态，只维护内容。

**最近更新**：2026-04-30

---

## 1. 当前位置

| 项 | 值 |
|---|---|
| 当前 Sprint | **Sprint 2 — Workflow Framework**（Kickoff 中，未动工）|
| 上一 Sprint | Sprint 1 — Foundation + Goal → AI Team（✅ 已交付，见 [`sprint1-milestone.md`](sprint1-milestone.md)） |
| 当前分支 | `main`（与 `origin/main` 对齐） |
| 最近提交 | `cbde398 feat(sprint1-cp7): Sprint 1 milestone doc + Team Architect spawn hardening` |
| 类型检查 | ✅ pnpm typecheck 通过 |

---

## 2. 当前阻塞 / 待决议

Sprint 2 启动前必须拍板：

| # | 议题 | 建议默认 | 状态 |
|---|------|---------|------|
| Q-4 | Workflow YAML 的版本控制方式 | 存 SQL 的 `definition_yaml` 字段 + 提供 Export，不引入 SQL 内 version 字段 | ⏳ **待拍板** |

非阻塞但需关注：
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

## 4. 已知技术债（Sprint 2+ 清理）

来自 Sprint 1 的延后项，按修复优先级排序：

| # | 项 | 影响 | 计划清理时机 |
|---|---|------|------------|
| TD-1 | 路由仍是 `/channel/:id`，未切到 `/p/:projectName/channel/:id`（CP5c） | 多 Project 链接分享会混 | Sprint 2（与 Workflow thread 路由一起做） |
| TD-2 | StatusDot 仍读 `agents.status`，未从 `agent_runs` 派生 per-channel | 多 Project 并发时状态点会跳 | Sprint 2 |
| TD-3 | `agents.status` 字段仍双写保留 | 一处真相未确立 | TD-2 完成后一并删 |
| TD-4 | `~/.slark/agents/{id}/` 目录与 CLIRunner fallback 仍存在（D-8 沙盒未彻底移除）| 已无业务依赖，但是死代码 | 所有 Project 都强制 workspace_path 后清理 |
| TD-5 | Activity Tab 的 channel filter 后端已支持，UI 未暴露 | 多 Project 时 Activity 混展 | Sprint 2 顺手做 |
| TD-6 | `README.md` / `PLAN.md` 仍有 v0 时代描述（"首次启动预置 #general"等）| 文档与实际行为不符 | **本次文档简化中处理** |

---

## 5. 下一步建议

按顺序执行：

1. **拍板 Q-4**（5 分钟决策）→ 解锁 Sprint 2
2. 文档基线同步（本次正在做的事，PLAN/README/brief/decisions 收敛）
3. 顺手清掉 TD-1 ~ TD-3：路由 Project scope + StatusDot per-channel 派生 + 删 `agents.status`
4. 进入 Sprint 2 实质开发：
   - Schema：`workflows` / `workflow_runs`
   - YAML parser/validator + Workflow Runner
   - 内置 3 个模板：`feature-development` / `bug-fix` / `research`
   - `/new-feature` 等 command 触发
   - Thread 顶部进度条
   - `await_approval` step 最小暂停/继续（完整批准流见 Sprint 3）

详细 Sprint 2 范围与验收见 [`PLAN.md` Sprint 2](../PLAN.md#sprint-2-workflow-framework甬道落地---template-路径)。

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
