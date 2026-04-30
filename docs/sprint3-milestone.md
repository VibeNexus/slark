# Sprint 3 Milestone — Responsibility + User Intervention

> **交付日期**：2026-04-30
> **战略锚**：[`docs/product-brief.md`](product-brief.md) §D-5 / [`PLAN.md`](../PLAN.md) Sprint 3
> **战略价值**：AI 团队**有边界、可控、可审计**。用户成为整个系统的最终 approver。

本文档是 Sprint 3 的交付记录 + 手动验收 runbook。Sprint 4 启动前可回读了解当前基线。

---

## 1. 交付清单（CP1 ~ CP6）

| Checkpoint | 状态 | 核心交付 | commit 前缀 |
|------------|------|---------|-------------|
| **CP1** Responsibilities | ✅ | `responsibilities` 表（schema_version → 5）+ 从 YAML 自动推导 executor / approver；新 agent 创建后回填；`GET /api/workflows/:id/responsibilities` | `feat(sprint3-cp1)` |
| **CP2** Approval Card + Inbox | ✅ | `ApprovalCard` 组件（替代 awaiting_approval 文字提示）+ `InboxPage` 跨 Project 列待办；`GET /api/workflow-runs?status=` | `feat(sprint3-cp2)` |
| **CP3** Control commands + abort kill | ✅ | `/comment` `/override` 解析；`/abort` 真正 kill `cursor-agent` 子进程（清掉 TD-7）；`abortAgentRun` / `abortChannelAgentRuns` engine API | `feat(sprint3-cp3)` |
| **CP4** Workflow Import / Export | ✅ | `GET /api/workflows/:id/export` (YAML 下载) + `POST /api/projects/:id/workflows/import` (overwrite 可选)；新建 `WorkflowsPage` 管理页 | `feat(sprint3-cp4)` |
| **CP5** Auto-jump thread | ✅ | 用户触发 workflow 后前端自动跳到该 thread（清掉 TD-11）；`autoJumpedRunIds` 防止反复跳 | `feat(sprint3-cp5)` |
| **CP6** Sprint 3 milestone | ✅ | 本文档 + `docs/project-status.md` / `PLAN.md` 同步 | `feat(sprint3-cp6)` |

### 未纳入 Sprint 3（延后）

| 编号 | 名称 | 决定 | 目标时机 |
|------|------|------|---------|
| `/override` 在 `running` 状态生效 | 当前仅在 `awaiting_approval` 等同 `/approve`；running 时返回提示要求 `/abort` | 延后 | Sprint 4+（涉及 step output 占位 + agent kill 同步语义）|
| Responsibility UI 编辑器 | 当前完全自动 derive；用户不能手动改 role/authority | 延后 | Sprint 7 配合 Facilitator |
| Workflow YAML 行内编辑器 | 当前必须 PATCH definition_yaml 文本或 Export/Import 替换 | 延后 | Sprint 4+ |
| `/reject` reason 沉淀到 `lessons` | 仅注入下一轮 prompt | 延后 | Sprint 4 Scribe 落地后顺手 |

---

## 2. 手动验收 Runbook

### 前置

1. Node.js ≥ 20，pnpm ≥ 10
2. `cursor-agent` 已安装并登录
3. 至少一个真实代码仓库可作为 Project workspace_path
4. 升级旧 db：本 Sprint schema_version → 5（新增 `responsibilities` 表，自动迁移幂等）

### Step 0：启动

```bash
pnpm install
pnpm dev
```

启动日志中应看到（首次升级到 v5 / 已有 workflows 时）：

```
@slark/server: [workflows] derived responsibilities ...
```

### Step 1：Approval Card 流程

1. Welcome → Create Project
2. Approve & Create 完成后立即在 #general 输入 `/n`，Tab 补全到 `/new-feature`，加任意需求按 Send
3. **预期 (CP5)**：浏览器自动跳到 thread（不再需要手动点 N replies）
4. Thread 顶部 WorkflowProgress 进度条 + Architect 流式回复
5. Architect 完成 → 进度条变 `Awaiting approval` → thread 末尾出现 **Approval Card**

   ```
   ⏸ Approval needed
   feature-development · step "await_approval"
   ▸ Output of previous step "design"   <details collapsible>
   [✓ Approve]  [↩ Reject…]  [Abort]
   ```

6. 点 ✓ Approve → 自动推进到 implement step
7. Reviewer step 时点 ↩ Reject…，输入 reason "请补充错误处理" → 提交
   - 预期：thread 内有 system msg `↩ Rejected — going back to step "implement"...`
   - 进度条回退；下一轮 Dev 的 prompt 包含 reject reason（在 ApprovalCard 历史里也会显示）

### Step 2：`/abort` 真正 kill agent (CP3 / TD-7)

1. 触发 `/new-feature any goal` 让 Architect 跑起来（thinking → working）
2. 进度条右上角点 ABORT（或在 thread 输入 `/abort`）
3. **预期**：
   - 后端日志看到 `runner.ts: 'Process aborted by user'` 类型错误事件
   - thread system msg `⛔ Workflow aborted — aborted by user (killed 1 active agent run)`
   - Architect 的占位消息变 `⚠ Process aborted by user`
   - **关键**：`ps aux | grep cursor-agent` 不再有该进程

### Step 3：`/comment` `/override`

1. thread 内任意时刻输入 `/comment please double-check the migration`
   - 预期：system msg `💬 please double-check the migration`，run 状态不变
2. 触发 `/new-feature foo`，Architect 完成进入 await_approval 后，输入 `/override skipping the approval` 
   - 预期：等同 /approve，进度条推进；system msg 包含 `[override] skipping the approval`
3. 在 running 状态下 `/override` → 提示 `/override only works while awaiting approval; use /abort to cancel`

### Step 4：Inbox 视图

1. Sidebar 顶部工具行点 **Inbox**（在 Search 下方）
2. 触发 2~3 个不同 Project 的 workflow，让其中一些进入 awaiting_approval
3. **预期**：
   - Inbox AWAITING APPROVAL 标签显示个数 + 列表
   - 每行：Project · #channel · workflow 名 · current step · ago
   - 点击行自动跳到对应 channel 的 thread
   - Inbox 每 5s 刷新

### Step 5：Workflows 页 + Import / Export

1. Sidebar 工具行点 **Workflows**（仅当 currentProject 存在时显示）
2. 看到 BUILTIN section 三条（feature-development / bug-fix / research）+ USER section（当前空）
3. 点某 builtin 的 **Export** → 浏览器下载 `feature-development.workflow.yaml`
4. 编辑该文件改 description / 加一个 step 等
5. 回到 Workflows 页，勾选 **overwrite on import** + 点 **Import YAML…** 选刚改过的文件
6. **预期**：状态行显示 `Updated: feature-development (/new-feature)`；列表更新；触发 `/new-feature` 走的是新 YAML
7. 测试冲突：把 trigger_command 改成 `/new-feature` 但 name 改了，**不勾** overwrite → 上传 → 应看到 409 错误信息

### Step 6：Responsibilities 自动推导

```bash
# 拿一个 workflow 的 responsibilities
curl http://localhost:4179/api/workflows/<wf_id>/responsibilities | jq
```

**预期**：

```json
[
  { "step_id": "design", "agent_id": "<architect_id>", "role": "executor", "authority": "no_authority" },
  { "step_id": "await_approval", "agent_id": "local-user", "role": "approver", "authority": "must_approve" },
  ...
]
```

PATCH workflow `definition_yaml` 改 owner（如把 implement 的 owner 从 `@Dev` 改成 `@Architect`）→ 立即重新 derive，`responsibilities` 表会反映。

### Step 7：multi-Project 隔离回归（确保 Sprint 2 验收没回退）

1. 两个 Project 各跑一条 workflow → 进度条互不干扰
2. Inbox 同时显示两个 Project 的 awaiting runs
3. /abort 一个 Project 的 workflow，不影响另一个

---

## 3. 已知限制与下一步

### 技术债（Sprint 4 清理）

- **`/override` running 状态不支持**：用户必须先 `/abort` 然后重启 workflow。涉及 step output 占位 + agent kill 同步语义，留给后续。
- **`reject` reason 不进 lessons 表**：等 Sprint 4 Scribe 落地。
- **Responsibilities UI 编辑器缺失**：当前仅自动 derive；用户编辑只能改 YAML。

### UX 待优化（Sprint 4+）

- Workflow YAML 行内编辑器（前端 textarea + 解析高亮，目前必须 export 改了再 import）
- Approval Card 显示前一步消息的链接（点击跳到该 message 而非展开 summary）
- Inbox 加 muted/snoozed 状态

### 产品待决（对齐 `product-brief.md §10`）

| # | 决议 deadline | 当前状态 |
|---|-------------|---------|
| Q-5 / Q-7 | Sprint 4 启动前 | 待定（System Agent token 配额；lessons 跨 Project 共享）|
| Q-6 | Sprint 5 启动前 | 待定（Coach rollback）|
| Q-8 | Sprint 7 启动前 | 待定（Facilitator 触发方式）|

---

## 4. Sprint 4 启动 checklist

- [ ] **Q-5 拍板**：System Agent token 是否计入 Agent 配额（建议：独立配额）
- [ ] **Q-7 拍板**：Scribe 沉淀的 lessons 是否默认 public 跨 Project（建议：默认 Project-private）
- [ ] 扫 `clawteam-comparison.md` §4.5：本 Sprint 兑现 **B-3** spec note 共享文档（如做 Intelligence Tab 顺势集成）
- [ ] 扫 `optimization-backlog.md`：现状 O-1 ~ O-4 仍未做，**评估** O-1 Task `in_progress` 自动触发 assignee 是否搭进 Sprint 4 Scribe（语义相通）

Sprint 4 交付概要：Delivery Loop（Scribe 沉淀）—— 每个 Workflow Run 结束后 Scribe 自动回扫 thread → 写入 `decisions` / `lessons`；新增 Intelligence Tab；ContextBuilder 升级按 audience 注入。详见 `product-brief.md §9` + `PLAN.md Sprint 4`。

---

## 5. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-30 | 初版：CP1~CP6 交付记录 + 手动验收 runbook + 已知限制清单 |
