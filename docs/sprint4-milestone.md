# Sprint 4 Milestone — Delivery Loop（Scribe 沉淀）

> **交付日期**：2026-04-30
> **战略锚**：[`docs/product-brief.md`](product-brief.md) §D-20 / [`PLAN.md`](../PLAN.md) Sprint 4
> **战略价值**：Slark 成为**项目知识资产的管理后台**，每次协作产出自动沉淀。

---

## 1. 交付清单（CP1 ~ CP6）

| Checkpoint | 状态 | 核心交付 | commit 前缀 |
|------------|------|---------|-------------|
| **CP1** decisions / lessons schema + REST | ✅ | schema_version → 6；`decisionRepo` / `lessonRepo`；`/api/projects/:id/{decisions,lessons}` + PATCH/DELETE | `feat(sprint4-cp1)` |
| **CP2** Scribe System Agent | ✅ | `system-agents/scribe.ts`：spawn + 严格 JSON 解析；30s timeout；fallback 静默 | `feat(sprint4-cp2)` |
| **CP3** 自动触发 + `/sediment` | ✅ | `completeRun` 后台 fire Scribe；`/sediment` 手动指令；reject reason 经 transcript 入 Scribe | `feat(sprint4-cp3)` |
| **CP4** Intelligence Tab | ✅ | `IntelligencePage`：PENDING / KNOWLEDGE BASE / DECISIONS 三标签；Approve/Reject/Edit/Delete | `feat(sprint4-cp4)` |
| **CP5** ContextBuilder Reuse Loop | ✅ | Project Goal + Team Rules + audience 过滤的 lessons / decisions 注入 prompt 顶部；`use_count` bump | `feat(sprint4-cp5)` |
| **CP6** Sprint 4 milestone | ✅ | 本文档 + `docs/project-status.md` / `PLAN.md` 同步 | `feat(sprint4-cp6)` |

### Q-5 / Q-7 决议落地

- **Q-5 ✅**：System Agent（Scribe / Evaluator / Coach）使用独立的 timeout 常量（`SCRIBE_TIMEOUT_MS=60s`），spawn 走相同的 `runCLI` 与并发队列；token 配额仍走单进程 5min 预算（不计入 per-Agent 配额）。
- **Q-7 ✅**：Scribe 沉淀的 lessons 默认 `audience='all'` 但**仅在该 Project 内**使用（`listByProject` / `listForInjection` 都按 `project_id` 过滤）。跨 Project 共享留 Sprint 8+。

---

## 2. 手动验收 Runbook

### Step 0：升级 schema

旧 db 重启后会自动 `CREATE TABLE IF NOT EXISTS decisions / lessons`，schema_version 升到 6。无破坏性迁移。

### Step 1：跑通 Workflow → Scribe → Pending → Approve 全链路

1. 触发 `/new-feature add a /health endpoint`，正常走完 design → approve → implement → review → approve
2. workflow 完成时 thread 内出现：
   - `✅ Workflow completed.`
   - 几秒后 `📚 Scribe sedimented N decision(s) + M lesson(s) — review them in Intelligence.`
3. Sidebar 工具行点 **Intelligence** → PENDING tab 看到 N+M 个待审条目
4. 任一条点 ✓ Approve → 移到 KNOWLEDGE BASE / DECISIONS

### Step 2：手动 `/sediment`

1. 在任意 thread 输入 `/sediment do a quick pass`
2. 立即出现 `📚 Scribe is reviewing this thread…`
3. 几秒后出现 `📚 Scribe sedimented ...`
4. Intelligence Pending 看到结果

### Step 3：注入闭环

1. 在 PENDING 里 approve 一个针对 `audience='Architect'` 的 lesson（kind='do'）
2. 在 #general @Architect 任意问题
3. Architect 回复中应能看到这条 lesson 的精神（在 prompt 中已注入）
4. 数据库验证：`SELECT use_count FROM lessons WHERE id=...` 应增加

### Step 4：手动添加

1. Intelligence DECISIONS tab → "+ New Decision" → 填表 → Create
2. 立即出现在列表（`recorded_by='local-user'`，状态直接 approved）
3. 同样在 KNOWLEDGE BASE 测试 lesson 手动添加

---

## 3. 已知限制（Sprint 5 / 后续清理）

- **TD-9 闭环但未正式关闭**：reject reason 通过 transcript 进入 Scribe prompt，但没有"显式 reject→lesson 候选"的捷径。等用户反馈再决定是否做。
- **Scribe 输出仍可能为空**：cursor-agent 对短 thread 经常返回空数组；这是合理行为。
- **lessons 跨 project 共享**：v1.0 范围外（Q-7 决议）。
- **prompt 注入截断**：每条 lesson body 注入时按 200 字截断；过长 lesson 不会丢但只显示前 200 字。

---

## 4. Sprint 5 启动 checklist

- [ ] **Q-6 拍板**：Coach 建议 Apply 后能否回滚（建议：能，agent_feedback 保留 diff 历史）
- [ ] 扫 `optimization-backlog.md`：评估 O-1 是否纳入 Sprint 5

Sprint 5 概要：Evolution Loop —— Evaluator 后台评估 + Coach 提 description 修改建议 + Agent Profile FEEDBACK Tab。详见 `PLAN.md Sprint 5`。

---

## 5. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-30 | 初版：CP1~CP6 交付记录 + 手动验收 runbook |
