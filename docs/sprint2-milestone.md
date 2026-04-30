# Sprint 2 Milestone — Workflow Framework

> **交付日期**：2026-04-30
> **战略锚**：[`docs/product-brief.md`](product-brief.md) §D-4 / [`PLAN.md`](../PLAN.md) Sprint 2
> **目标（S-4）**：声明式 Workflow（YAML）可以执行成一个完整 thread —— 触发 → 分步 → 路由 → 完结
> **首要差异化**：Slark 从"聊天室"跃升为"工作流引擎"

本文档是 Sprint 2 的交付记录 + 手动验收 runbook。Sprint 3 启动前可回读本文档了解当前基线。

---

## 1. 交付清单（CP1 ~ CP8 + CP1~CP5）

> Sprint 2 包含 **CP8 Sprint 1 收口** 和 **CP1 ~ CP5 主体**。
> CP8 见 [`docs/sprint1-milestone.md`](sprint1-milestone.md) §3 / `git log -1 985b925`。

| Checkpoint | 状态 | 核心交付 | commit 前缀 |
|------------|------|---------|-------------|
| **CP8** Sprint 1 收口 | ✅ | 路由 Project scope / per-channel agent status / drop `agents.status` / Activity filter / D-8 沙盒清理 | `feat(sprint2-cp8)` |
| **CP1** Schema + Repo + REST | ✅ | `workflows` / `workflow_runs` 两张表（schema_version → 4）；`workflowRepo` / `workflowRunRepo`；REST 端点（list / create / update / delete / runs / abort / active-run） | `feat(sprint2-cp1)` |
| **CP2** Builtin templates | ✅ | 3 内置模板（`feature-development` / `bug-fix` / `research`）；Project 创建时 auto-import；启动时给已有 Project 补齐 | `feat(sprint2-cp2)` |
| **CP3** Workflow Runner | ✅ | 状态机（running / awaiting_approval / completed / aborted / failed）；step 推进；`/command` 触发 / `/approve` / `/reject` / `/abort` 指令解析 | `feat(sprint2-cp3)` |
| **CP4** Thread 进度 UI | ✅ | `WorkflowProgress` 组件 + `/command` 提示下拉 + `workflow_run_update` WS 实时推送 | `feat(sprint2-cp4)` |
| **CP5** 多 Project 隔离验收 + milestone | ✅ | 本文档；多 Project 同时跑 workflow 互不干扰 | `feat(sprint2-cp5)` |

### 未纳入 Sprint 2（延后）

| 编号 | 名称 | 决定 | 目标时机 |
|------|------|------|---------|
| Workflow Import / Export | YAML 文件下载 + 上传 | 延后 | Sprint 3 |
| Approval Card 组件 | 进 thread 的精致批准 UI | 延后 | Sprint 3 |
| Inbox 视图 | 跨 channel 的待批准动作汇总 | 延后 | Sprint 3 P1 |
| `/abort` kill agent runs | abort 时 kill 该 step 的活跃 CLI 进程 | 延后 | Sprint 2+ 技术债 |
| Workflow 自动开 thread | 用户触发 workflow 后前端自动跳到该 thread | 延后 | UX 优化 |

---

## 2. 手动验收 Runbook

### 前置条件

1. Node.js ≥ 20，pnpm ≥ 10
2. 已安装 `cursor-agent`（`cursor-agent --version` 能跑）
3. 至少一个真实代码仓库可作为 Project 的 workspace_path

### Step 0：启动服务

```bash
pnpm install
pnpm dev
```

启动日志中应看到：

```
@slark/server: ✓ Database initialized at ~/.slark/slark.db
@slark/server: [workflows] builtin templates seeded ...   # 仅当首次或新增 project 时
@slark/server: ✓ Slark server listening on http://127.0.0.1:4179
@slark/web:    ➜ Local: http://localhost:4178/
```

### Step 1：基础 workflow 跑通（feature-development）

1. 浏览器打开 `http://localhost:4178/`
2. Welcome → Create Project（用一个真实 git 仓库的路径）
3. 等 Team Architect 推荐 → Approve（创建 Architect / Dev / Reviewer 三个 Agent）
4. 进入 `#general` 频道，输入框输入 `/n` —— 应弹出 `/new-feature` 提示
5. Tab 补全后追加任意需求，例：`/new-feature add a /health endpoint`
6. 按 Send

**预期表现**：

- 主区只看到自己的消息 + N replies 计数（thread 已被 workflow 占用作 root）
- 点 N replies 进 thread，顶部出现 **WorkflowProgress** 进度条：
  - workflow 名 = `feature-development`，Step 1/4
  - 步骤 pill：`design`（current/动效）→ `await_approval`（todo）→ `implement` → `review`
  - status = `Running`
- thread 内：
  - system header `⚙ Step 1/4: design → @Architect`
  - `@Architect` 流式回复（橙色 thinking → 绿色 idle）
- Architect 完成后：
  - system header `⚙ Step 2/4: await_approval`
  - 进度条 status → `Awaiting approval`，黄色提示条要求 `/approve` 或 `/reject`

### Step 2：approve 路径

1. thread 输入框输入 `/approve` → Send
2. 预期：
   - system msg `✓ Approval received — proceeding to step "implement"`
   - 进度条切到 Step 3/4 implement
   - `@Dev` 自动 spawn 开始改代码（看到 thinking → working → idle）
3. Dev 完成后自动进 review（Step 4/4），Reviewer 是 approve_or_reject step
4. thread 内 `/approve` → 进度条变 `Completed ✅`，system msg `✅ Workflow completed.`

### Step 3：reject 路径（带反馈）

1. 重新跑一次 `/new-feature` 或 `/bug-fix`
2. 第一个 await_approval 时输入 `/reject please add error handling`
3. 预期：
   - system msg `↩ Rejected — going back to step "design" (reason: please add error handling)`
   - 进度条回到 Step 1
   - 第二轮 design 时，prompt 注入会包含 `User feedback on previous attempt: please add error handling`（看 Architect 第二轮回复内容是否提及了错误处理）

### Step 4：abort 验收

1. 在任意 running step（agent 还在跑）期间，点击进度条右上角 ABORT 按钮（或在 thread 内输入 `/abort`）
2. 确认对话框 → 预期：
   - system msg `⛔ Workflow aborted — aborted by user`
   - 进度条 status = Aborted
   - 后续 step 不再推进

### Step 5：多 Project 隔离（关键验收）

1. Sidebar Project 切换器 → `+ New Project`，建第二个 Project（不同 workspace_path）
2. 两个 Project 各自跑一条 `/new-feature` workflow
3. 预期：
   - 两个 thread 互不干扰，进度独立推进
   - `workflow_runs` 表两条独立记录（不同 channel_id）
   - `workflow_run_update` WS 事件按 channel 分发，切换 Project 后只看到当前 Project 的进度
   - 各自的 Architect 在自己的 workspace_path 执行（可让 Architect `pwd` 验证）

### Step 6：内置模板覆盖检查

1. `GET http://localhost:4179/api/projects/<id>/workflows`
2. 预期：3 条记录（feature-development / bug-fix / research），`source = "builtin"`
3. PATCH 修改其中一个 `definition_yaml`（如改 description）→ 重启服务 → workflow 不被覆盖（idempotent import 跳过已存在）

### Step 7：YAML 校验（错误处理）

```bash
curl -X POST http://localhost:4179/api/projects/<id>/workflows \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "broken",
    "trigger_command": "/broken",
    "definition_yaml": "name: broken\ntrigger:\n  command: /broken\nsteps:\n  - id: a\n    owner: \"@NoSuch\"\n    on_complete: missing"
  }'
```

预期：HTTP 400 `step "a" references unknown step "missing"`

---

## 3. 已知限制与下一步

### 技术债（Sprint 3 清理）

- **`/abort` 不真正 kill agent CLI 进程**：当前仅把 run 标 aborted，已 spawn 的 cursor-agent 进程会继续跑完。Sprint 2 路由器未集成 CLIRunner.abort()。
- **Workflow YAML 的 `input` 字段仅注入 summary**：完整 message body 没有传递；如 step 输出很长会被 1000 字符截断。
- **奖励/反馈循环未沉淀**：`/reject` 的 reason 仅注入下一轮 prompt，不进入 `lessons` 表（Sprint 4 Scribe 落地）。
- **Workflow Import / Export 未实现**：用户只能通过 PATCH definition_yaml 修改；下载/上传 YAML 文件留给 Sprint 3。
- **本地用户 owner 限制**：YAML parser 限制 `owner=local-user` 必须搭配 `action=approve_or_reject`。其他 `local-user` 输入 step 类型暂不支持。
- **进度条不自动开 thread**：用户 `/new-feature ...` 后需手动点 N replies 进 thread；Sprint 3 可加自动跳转。

### UX 待优化（Sprint 3+）

- Approval Card 卡片化（当前是文字提示 + `/approve` 命令）
- Workflow runs 历史浏览（`GET /api/workflows/:id/runs` 已有，UI 未做）
- `/abort` 二次确认（当前 only 在前端 ABORT 按钮有 confirm dialog）
- Project Settings 页面看/编辑 workflows YAML（当前必须 REST PATCH）

### 产品待决（对齐 `product-brief.md §10`）

| # | 决议 deadline | 当前状态 |
|---|-------------|---------|
| Q-4 | Sprint 2 启动前 | ✅ 已决议（YAML 单字段 + Export，无 SQL version 字段）|
| Q-5 / Q-7 | Sprint 4 启动前 | 待定（System Agent token 配额；lessons 跨 Project 共享）|
| Q-6 | Sprint 5 启动前 | 待定（Coach rollback）|
| Q-8 | Sprint 7 启动前 | 待定（Facilitator 触发方式）|

---

## 4. Sprint 3 启动 checklist

按 [`PLAN.md`](../PLAN.md) "Sprint 启动前必做 checklist"：

- [ ] 扫 `product-brief.md §10`：Sprint 3 没有专属决议；可以直接启动
- [ ] 扫 `clawteam-comparison.md §4.5`：Sprint 3 兑现 **B-2**（协调协议注入 / 内联指令） + **B-5**（Plan Approval 流程）
- [ ] 扫 `optimization-backlog.md`：O-1 Task `in_progress` 自动触发 assignee 在 Sprint 2 Workflow Runner 完成后可再评估纳入 Sprint 3
- [ ] 处理本文档 §3 列出的技术债（特别是 `/abort` kill 进程，会阻塞 user override 体验）

Sprint 3 交付概要：Responsibility + User Intervention —— `responsibilities` 表 / Approval Card / `/comment` `/override` 指令 / Workflow Import-Export 文件 / Inbox 视图（P1）。详见 `product-brief.md §9` + `PLAN.md Sprint 3`。

---

## 5. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-30 | 初版：CP8 + CP1~CP5 交付记录 + 手动验收 runbook + 已知限制清单 |
