# Sprint 1 Milestone — Foundation + Goal → AI Team

> **交付日期**：2026-04-23
> **战略锚**：[`docs/product-brief.md`](product-brief.md) v1.0.1 / [`PLAN.md`](../PLAN.md) Sprint 1
> **目标（S-1）**：从启动 Slark 到发出第一条 @ 消息 ≤ 3 分钟

本文档是 Sprint 1 的交付记录 + 手动验收 runbook。后续 Sprint 启动前可回读本文档了解当前基线。

---

## 1. 交付清单（CP1 ~ CP6）

| Checkpoint | 状态 | 核心交付 | commit 前缀 |
|------------|------|---------|-------------|
| **CP1** Schema 基础 | ✅ | `projects` / `agent_runs` 两张新表（纯加法，不破坏 v0） | `feat(sprint1-cp1)` |
| **CP2** Projects API + Seed | ✅ | `/api/projects` CRUD；Seed 识别"全新 db"改为 no-op，v0 遗留保持原样 | `feat(sprint1-cp2)` |
| **CP3** Engine agent_runs | ✅ | spawn 同时开 agent_run + 更新 agents.status（双写），cwd 按 project_id 路由 | `feat(sprint1-cp3)` |
| **CP4** Team Architect | ✅ | `/api/projects/suggest-team` + 兜底三件套（Q-2 / Review 5） | `feat(sprint1-cp4)` |
| **CP5a** Create Project 向导 | ✅ | 三步向导 + Welcome 页 CTA，Approve 后批量创建 Project/Channel/Agents | `feat(sprint1-cp5a)` |
| **CP5b** Sidebar Project 切换器 | ✅ | Sidebar 顶部下拉替换原 KaisTeam；channels/agents 按当前 Project 过滤 | `feat(sprint1-cp5b)` |
| **CP6** Profile 简化 | ✅ | Agent Profile 从 3 Tab 减到 2 Tab（删 WORKSPACE） | `feat(sprint1-cp6)` |

### 未纳入 Sprint 1（延后）

| 编号 | 名称 | 决定 | 目标时机 |
|------|------|------|---------|
| **CP5c** | 路由重构 `/p/:projectName/channel/:id` | 延后 | Sprint 2+（与其他导航改进合并） |
| StatusDot per-channel 派生 | 前端按 channel 组织 Agent 状态 | 延后 | Sprint 2+ |
| D-8 沙盒彻底移除 | 后端 `~/.slark/agents/{id}/` 回退仍在 | 延后 | 等所有 Project 都强制 workspace_path 后再删 |
| Activity Tab channel filter UI | 后端已支持，UI 未暴露 | 延后 | Sprint 2+ |

这些延后项不影响 S-1 的端到端流程（Welcome → Send），只是 v1.0 清洁度还没满分。

---

## 2. 手动验收 Runbook

### 前置条件

1. Node.js ≥ 18，pnpm ≥ 8
2. 已安装 `cursor-agent`（`cursor-agent --version` 能跑）
3. `~/.slark/slark.db` 不存在（首次验收请 `rm ~/.slark/slark.db`）

### Step 0：启动服务

```bash
pnpm install
pnpm dev
```

预期终端看到：

```
@slark/server: [seed] fresh db — no auto-seeded data; user will Create Project from the welcome page
@slark/server: ✓ Slark server listening on http://127.0.0.1:4179
@slark/server:   REST:      http://127.0.0.1:4179/api/health
@slark/server:   WebSocket: ws://127.0.0.1:4179/ws
@slark/web:     ➜ Local:   http://localhost:4178/
```

### Step 1：S-1 端到端计时（核心验收）

**起点**：打开浏览器 `http://localhost:4178/` 看到 Welcome 页（**开始计时**）

**操作序列**：
1. 点击大号粉色按钮 `+ Create your first Project`
2. Step 1：
   - Name：`slark-dev`（自动 slug 化）
   - Workspace Path：`/Users/你/code/slark`（真实的代码仓库路径）
   - Goal：`Explore Slark's own codebase and answer questions about it`
3. 点 `Next: Suggest Team →`，等 5~15 秒
4. Step 2：看到推荐团队 3 个 Agent 卡片，点 `Approve & Create`
5. 页面自动跳到 `/channel/<id>`
6. 在输入框输入 `@Architect hello`，点 Send 按钮（**终点，停止计时**）

**S-1 验收**：**计时 ≤ 3 分钟** 即通过。

**同步观察**：
- Sidebar 顶部显示 `slark-dev`（点击可看 workspace_path）
- Sidebar CHANNELS 出现 `#general`
- Sidebar DIRECT MESSAGES 出现 Architect / Dev / Reviewer（或 Team Architect 推荐的名字）
- Send 后 Architect 状态点变橙色 → 流式回复 → 变绿

### Step 2：多 Project 并发隔离验收

1. 再次点 Sidebar 顶部下拉 → `+ New Project`
2. 创建第二个 Project（Name：`blog`，Workspace Path 用另一个真实仓库）
3. 该 Project 下 Sidebar 自动切换
4. 在新 Project 的 `#general` 输入 `@Architect hello`
5. 点 Sidebar Project 切换器，回到 `slark-dev`
6. 在 `#general` 再输入 `@Architect what's in this repo?`

**验收**：
- 切换 Project 后 Sidebar 只显示当前 Project 的 channels / agents
- 两个 Project 的 Architect **是两个独立的 agent_id**（agents 表各一条，名字相同但 id 不同）
- 每个 Architect 的 spawn cwd 指向自己 Project 的 `workspace_path`
  - 可通过 `@Architect run pwd` 验证
- 对话历史完全隔离

### Step 3：Team Architect 兜底验收

1. 临时让 `cursor-agent --version` 失败：`alias cursor-agent=false` 或 `mv $(which cursor-agent) /tmp/cursor-agent.bak`
2. 重启 `pnpm dev`
3. Welcome → Create Project → Step 1 → 填任意 goal → Next
4. Step 2 **应看到**：
   - 黄色警告条 `⚠ Team Suggestion unavailable`
   - fallback reason 显示 `cursor-agent not installed...`
   - 默认三件套 Architect + Dev + Reviewer（runtime 标 `no runtime`）
5. 点 Approve & Create，Project 创建成功
6. 测试完毕恢复 cursor-agent：`mv /tmp/cursor-agent.bak $(which cursor-agent)`

### Step 4：Schema 迁移（v0 升级路径）验收

1. 准备一个 v0 遗留 db（旧版 Slark 跑过的 `~/.slark/slark.db`）
2. 用 Sprint 1 代码启动：`pnpm dev`
3. 启动日志应看到：
   ```
   [seed] v0 legacy data detected (N channels / M agents, 0 projects).
   Consider deleting ~/.slark/slark.db to restart fresh under v1.0 (Q-12 / N-14).
   ```
4. 旧数据可继续使用（channels / agents / messages 不变），但新 Create Project 流程走完整 v1.0 语义

---

## 3. 已知限制与下一步

### 技术债（下个 Sprint 清理）

- **`agents.status` 单值字段仍写入**：CP3 已打 agent_runs 双写，但 `agents.status` 保留以兼容 v0 前端；**CP5c 前端路由改造时可一并删**
- **D-8 legacy workspace 目录仍创建**：`~/.slark/agents/{id}/` 在 Create Agent 时仍 mkdir，CLIRunner 也保留 fallback；**所有 Project 都有 workspace_path 后再彻底移除**
- **StatusDot 仍读 agent.status**：不按 channel 区分；多 Project 并发时 Sidebar 状态点会来回切换。Sprint 2+ 改为从 `agent_runs` 派生

### UX 待优化（Sprint 2+）

- 路由带 Project scope：`/p/:name/channel/:channelId`（S-1 不需要，但多 Project 分享链接时会混淆）
- Workspace Path 前端 `<input type="file" webkitdirectory>` 选择器（目前只是文本输入）
- Team Architect 失败时 Step 2 的重试按钮（目前只能退回 Step 1 重进）
- Team Rules 字段的 ContextBuilder 注入（schema 已加字段，engine 还没读）

### 产品待决（对齐 `product-brief.md §10`）

| # | 决议 deadline | 当前状态 |
|---|-------------|---------|
| Q-1 / Q-2 / Q-3 | Sprint 1 启动前 | ✅ 已决议，落地于 CP4 / CP5a |
| Q-4 | Sprint 2 启动前 | **等 Sprint 2 启动 meeting 拍板**（Workflow YAML 版本控制） |
| Q-5 | Sprint 4 启动前 | 待定（System Agent token 配额） |
| Q-6 | Sprint 5 启动前 | 待定（Coach rollback） |
| Q-7 | Sprint 4 启动前 | 待定（lessons 跨 Project 共享） |
| Q-8 | Sprint 7 启动前 | 待定（Facilitator 触发方式） |

---

## 4. Sprint 2 启动 checklist

按 [`PLAN.md`](../PLAN.md) "Sprint 启动前必做 checklist"：

- [ ] 扫 `product-brief.md §10`：拍板 **Q-4**（Workflow YAML 版本控制）
- [ ] 扫 `docs/clawteam-comparison.md §4.5`：Sprint 2 需要兑现 B-4（团队模板 = 3 个内置 workflow 模板）
- [ ] 扫 `docs/research/routa-analysis.md`：检查 Routa 对 Workflow 的借鉴点
- [ ] 扫 `docs/optimization-backlog.md`：O-1 🔴 任务 in_progress 自动触发 —— Sprint 2 启动时考虑纳入（契合 Workflow Framework 语义）

Sprint 2 交付概要：Workflow Framework（甬道 Template 路径）—— `workflows` / `workflow_runs` 表 + YAML 解析器 + 3 内置模板 + `/new-feature` 触发。详见 `product-brief.md §9` + `PLAN.md Sprint 2`。

---

## 5. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-23 | 初版：CP1~CP6 交付记录 + 手动验收 runbook + 已知技术债清单 |
