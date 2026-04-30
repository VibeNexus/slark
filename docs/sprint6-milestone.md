# Sprint 6 Milestone — Onboarding Loop + Skill Matrix

> **交付日期**：2026-04-30
> **战略锚**：[`docs/product-brief.md`](product-brief.md) §D-20 / [`PLAN.md`](../PLAN.md) Sprint 6
> **战略价值**：新 Project 不再"空手起跑"——Onboarder 自动总结 codebase；agent_skills 自动维护能力地图。

---

## 1. 交付清单

| Checkpoint | 状态 | 核心交付 | commit 前缀 |
|------------|------|---------|-------------|
| **CP1** schema | ✅ | schema_version → 8；`project_onboarding` / `agent_skills`；`onboardingRepo` / `skillRepo` | `feat(sprint6-cp1)` |
| **CP2 + CP3** Onboarder + UI | ✅ | `system-agents/onboarder.ts`：read README/package.json/git log → cursor JSON；Project 创建后异步触发；ProjectIndexPage Onboarding 卡片 | `feat(sprint6-cp2-cp3)` |
| **CP4 + CP5** Skill Matrix + 推荐 | ✅ | `engine.ts` 在 tool.completed 后 bumpTouch；`skillRoutes`；TasksPanel New Task 集成 `Suggested by Skill Matrix` | `feat(sprint6-cp4-cp5)` |
| **CP6** Sprint 6 milestone | ✅ | 本文档 + status sync | `feat(sprint6-cp6)` |

---

## 2. 手动验收 Runbook

### Step 1：Onboarding 卡片

1. Welcome → Create Project → 用一个真实 git 仓库做 workspace
2. 创建完成后立即看 Welcome 卡片（如果没有 channel）：1.5s 内 Onboarding 卡片从灰底"分析中…"变成 cyan 底成品（overview + tech_stack chips + conventions）
3. 点 **Re-run** 重新触发 Onboarder

### Step 2：Skill Matrix 自动统计

1. 让某 agent 完成几个任务，使其 tool_call 涉及 `src/foo/...` 等路径
2. 后端日志看 `[engine] skill tracking` 没报错
3. `sqlite3 ~/.slark/slark.db "SELECT * FROM agent_skills"` 看到记录

### Step 3：Create Task 智能推荐

1. 频道 Tasks Tab → "+ New Task"
2. Title 输入 `fix foo bug`（关键词 `foo`）
3. Assignee 下面应出现 **Suggested by Skill Matrix: @AgentName (3)** 之类
4. 点击 chip → 自动选中

---

## 3. 已知限制

- **路径抽取启发式**：只处理 absolute / 知名前缀（src / tests / scripts 等）；其他自定义目录可能漏识别。后续可由 Onboarder 提供项目层目录列表反哺正则。
- **Onboarder 对超大 README / monorepo**：仅取 README ≤ 8000 字 + package.json ≤ 4000 字 + 20 commits。worktree 类工程可能不够全面。
- **关键词推荐**：当前用 title 第一个 ≥ 3 字符 token；可改为 NLP 提取（远期）。

---

## 4. Sprint 7 启动 checklist

- [ ] **Q-8 拍板**：Facilitator Session 触发方式（建议手动）
- [ ] 预审 Q-9：Session 最大时长 / token 消耗
- 扫 `optimization-backlog.md`：是否纳入 O-1 / 其他

Sprint 7 概要：Team-First-Collaborative Workflow Design — Facilitator System Agent + Workflow Design Session 对话流。详见 `PLAN.md Sprint 7`。

---

## 5. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-30 | 初版：CP1~CP6 交付记录 |
