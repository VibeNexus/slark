# Sprint 5 Milestone — Evolution Loop（Agent 成长）

> **交付日期**：2026-04-30
> **战略锚**：[`docs/product-brief.md`](product-brief.md) §D-20 / [`PLAN.md`](../PLAN.md) Sprint 5
> **战略价值**：Agent description 随时间演化，团队越用越强（达成 S-6）。

---

## 1. 交付清单（CP1 ~ CP6）

| Checkpoint | 状态 | 核心交付 | commit 前缀 |
|------------|------|---------|-------------|
| **CP1** observations + feedback schema | ✅ | schema_version → 7；`agent_observations` / `agent_feedback`；`observationRepo` / `feedbackRepo` | `feat(sprint5-cp1)` |
| **CP2** Evaluator | ✅ | `system-agents/evaluator.ts`：cron 24h + `runEvaluatorOnce`；遍历 agent → spawn cursor 标记 observations | `feat(sprint5-cp2)` |
| **CP3** Coach | ✅ | `system-agents/coach.ts`：聚合 negative tag ≥ 3 触发；产 `description_after` + rationale；写 `agent_feedback` | `feat(sprint5-cp3)` |
| **CP4 + CP5** FEEDBACK Tab + Apply / Reject / Rollback | ✅ | Agent Profile 第 3 Tab；REST `/api/agents/:id/feedback*`；Apply 写 `description`；Rollback 恢复 `description_before` | `feat(sprint5-cp4-cp5)` |
| **CP6** Sprint 5 milestone | ✅ | 本文档 + `docs/project-status.md` / `PLAN.md` 同步 | `feat(sprint5-cp6)` |

### Q-6 决议落地

**Q-6 ✅**：Coach Apply 后**能回滚**。`agent_feedback.description_before` 在创建时即快照保存（不因后续 description 变化而失效），rollback 接口直接 `agentRepo.update(description_before)` + status='rolled_back'。

---

## 2. 手动验收 Runbook

### Step 0：升级 schema

旧 db 重启后会自动建 `agent_observations` / `agent_feedback` 两张新表，schema_version → 7。

### Step 1：构造 negative observation 场景

短时间内难以让 cursor-agent 自然产生 ≥ 3 条同 tag 的 negative observation。最快验证方式：手动跑 Coach。

1. 启动服务，让任意 agent 跑几次 task（生成消息）
2. Agent Profile → FEEDBACK Tab → 点击 **▶ Run Coach now**
3. 因为没有 observations，Coach 提示 "No new proposal" — 这是预期

### Step 2：完整流程（开发模式）

如要完整跑通 Evaluator → Coach → Apply：

1. 让 agent 跑过几个 task，产 messages
2. 等待 60s（Evaluator 首次延迟）→ Evaluator 自动跑，写 `agent_observations`
3. 同一轮 tick 内 Coach 跑（24h 一轮）：如果有 ≥ 3 条同 tag negative observation，会写 `agent_feedback` (status='pending')
4. FEEDBACK Tab 出现 PENDING 卡片
5. 点 **▸ Show description diff** 看 before/after
6. 点 **✓ Apply** → 立即 alert 确认 → agents.description 更新 → 卡片状态变 APPLIED
7. 在 ProfileTab 看 description 已是 description_after
8. 回到 FEEDBACK Tab，点 **↶ Rollback** → 二次确认 → description 恢复到 description_before；卡片变 ROLLED BACK

### Step 3：DB 验证

```bash
sqlite3 ~/.slark/slark.db "SELECT id, status, applied_at, rolled_back_at FROM agent_feedback ORDER BY id DESC LIMIT 5;"
```

应能看到 status 流转 + 时间戳同步更新。

```bash
sqlite3 ~/.slark/slark.db "SELECT tag, polarity, created_at FROM agent_observations ORDER BY id DESC LIMIT 10;"
```

---

## 3. 已知限制

- **触发阈值偏严**：`COACH_NEGATIVE_THRESHOLD = 3` 同 tag 才触发；UI 提供"Run Coach now"绕过窗口判断但仍走 negative 阈值。如要更激进的提议，可在 dev 期手动降阈值。
- **observation tag 标准化**：Evaluator 不强制 tag 词典；不同会话可能产生 `missing_error_handling` 与 `error_handling_missing` 等近义 tag，影响聚合。Sprint 5 范围内不做归一化（属未来 NLP 增强）。
- **Apply 对 in-flight spawn 不生效**：正在跑的 cursor-agent 进程已带旧 description；新 description 在下次 spawn 生效。
- **Rollback 链式**：每个 feedback 有自己的 description_before snapshot；如果 A 已 applied，B 又 applied，回滚 A 会跳过 B 直接到 A 之前的状态（这是 snapshot 的特性，不是缺陷）。

---

## 4. Sprint 6 启动 checklist

- ✅ 无 Q-N 待决议
- 扫 `optimization-backlog.md`：O-1 Task `in_progress` 自动触发 assignee — Sprint 6 / Skill Matrix 后再评估

Sprint 6 概要：Onboarding Loop + Skill Matrix。详见 `PLAN.md Sprint 6`。

---

## 5. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-30 | 初版：CP1~CP6 交付记录 |
