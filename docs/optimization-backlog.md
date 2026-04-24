# Slark 优化待办清单 (Optimization Backlog)

> **本文档的角色**：记录"**已决定要做、尚未排期**"的优化条目，作为 `PLAN.md` 的前置队列。
>
> **定位对比**：
>
> | 文档 | 性质 | 内容 |
> |------|------|------|
> | [`docs/product-brief.md`](product-brief.md) | 战略 | 产品定位 / 目标用户 / 非目标 |
> | [`PLAN.md`](../PLAN.md) | 战术（已排期） | 4 阶段 MVP 路线 + 验收清单 |
> | [`docs/technical-decisions.md`](technical-decisions.md) | 实现（已落地决策） | D-N 默认决策 |
> | [`docs/clawteam-comparison.md`](clawteam-comparison.md) | 调研（候选借鉴） | B-N 借鉴条目（ClawTeam） |
> | [`docs/research/routa-analysis.md`](research/routa-analysis.md) | 调研（候选借鉴） | B-N 借鉴条目（Routa） |
> | **本文档**（optimization-backlog.md） | **战术（未排期）** | **O-N 收敛后的待优化条目** |
>
> **条目编号**：`O-N`（Optimization-N），与 `D-N` / `B-N` / `K-N` 并列独立编号空间
>
> **生命周期**：
>
> ```
>   候选借鉴 (B-N)  ──┐
>   用户反馈        ──┼──► 讨论收敛 ──► O-N（本文档）──► 排期进 PLAN.md (MVP-N) ──► 交付完成
>   内部讨论        ──┘                                                              │
>                                                                                     │
>                                                                                     ▼
>                                                                         迁移到 technical-decisions.md (D-N)
>                                                                         或 PLAN.md "已完成路线"
> ```
>
> **何时读本文档**：
> - 规划下一个 Sprint / Phase 时，从本文档挑条目 → 进 `PLAN.md`
> - 有人提"Slark 要不要做 X"时，先查本文档是否已收敛（B-N 阶段还是 O-N 阶段）
> - 条目状态变化时（排期 / 完成 / 废弃）及时更新本文档
>
> **状态标记约定**：
>
> | 标记 | 含义 |
> |------|------|
> | `[待排期]` | 已决定做，等待纳入 PLAN.md 某个 MVP |
> | `[规划中]` 🔵 | 已进入 PLAN.md 某个 MVP，实现未开始 |
> | `[进行中]` 🟡 | 正在实现 |
> | `[已完成]` ✅ | 已交付，条目留档供溯源（一段时间后归档） |
> | `[已废弃]` ⛔ | 讨论后决定不做，移至文末"废弃条目"区 |

---

## 目录

- [一、Task 设施优化（O-1 ~ O-4）](#一task-设施优化)
- [二、废弃条目（不做的优化）](#二废弃条目不做的优化)
- [三、新增条目模板](#三新增条目模板)
- [四、版本历史](#四版本历史)

---

## 一、Task 设施优化

> **来源**：`docs/research/routa-analysis.md` §5.2 B-6 + `docs/clawteam-comparison.md` §5 B-3 / B-7 + 2026-04-23 与 routa 机制对比讨论
>
> **核心思路**：**不新增概念，只深挖现有 `tasks` / `messages` / `metadata_json` / `source_message_id` / `task_ref` 的关联关系**，把"散落的信息"聚合为"可感知的协作"。
>
> **心智对比**：
>
> ```
>   Routa:  拖 Kanban 卡  →  触发 Agent
>   Slark:  切 Task 状态  →  Agent 自然响应在聊天流中
> ```
>
> 同样的价值，完全不同的载体。Slark 保留聊天室隐喻。

---

### O-1: Task 状态变更 `in_progress` 自动触发 assignee

**状态**: `[待排期]`

**优先级**: 🔴 高（低成本、高价值、直接提升 MVP-9 完成度）

**来源**: `routa-analysis.md` §5.2 B-6 + 2026-04-23 讨论收敛

**价值**:
- Task 状态机本身就是协作指令，用户不需要在"点击状态"之后再手动 `@Alice`
- 让 `assignee_agent_id` 字段从"元数据"变成"活字段"
- 让 MVP-9 验收的"Task 生命周期"场景更像真的协作

---

**当前行为**:
- Tasks Tab 点击状态 badge 切到 `in_progress`
- 频道出现 system 消息 `"📌 Alice claimed #27 ..."`
- **然后就结束了**。用户必须手动在频道输入 `@Alice ...` 才会让 Alice 实际开始工作。

**目标行为**:
- Tasks Tab 点击状态 badge 切到 `in_progress`
- 频道出现 system 消息 `"📌 Alice claimed #27 ..."`
- **紧接着** Alice 开始流式回复（就像被 @ 过一次）
- Sidebar Alice 状态点变橙色（thinking → working）

---

**Schema 改动**: **无**（复用现有字段）

**代码改动**:

位置：`packages/server/src/messaging/task-transitions.ts` 或现有 task service 中 `moveTask()` 逻辑

伪码：
```typescript
async function moveTask(taskId, newStatus, movedBy) {
  const task = await taskRepo.updateStatus(taskId, newStatus);
  const systemMsg = await messageRepo.insertSystemMessage({
    channel_id: task.channel_id,
    metadata: { system_event: { type: 'task_moved', task_id, from, to } },
  });

  if (newStatus === 'in_progress' && task.assignee_agent_id) {
    await messageRouter.triggerAgent({
      agent_id: task.assignee_agent_id,
      channel_id: task.channel_id,
      triggered_by_message_id: systemMsg.id,
      chain_depth: 0,
      injected_context: `Task #${task.id} "${task.title}" is now assigned to you. Please start working on it.`,
    });
  }
}
```

**依赖**: MVP-7 已实现的 `messageRouter.triggerAgent()`（链式触发机制，`D-6`）

**链式防护**:
- 触发当做一次独立链，`chain_depth` 从 0 开始（不继承任何 Thread）
- 受 `MAX_CONCURRENT_PROCESSES`（D-5）限制，并发超限时进队列
- 受 `MAX_CHAIN_DEPTH`（D-6）限制，Agent 在回复中再 `@` 别人继续计数

---

**UI 影响**:
- Tasks Tab：无变化（仍然是点击 badge 切换）
- 频道主线：
  - 原有 system 消息 "📌 Alice claimed #27"（保留）
  - **紧接一条 Agent 消息气泡**开始流式渲染（原本需要用户手动 @）
- Sidebar：Alice 状态点自动变橙色

---

**验收标准**:
- [ ] 在 Tasks Tab 点击 `#27` 从 Todo 切到 In Progress
- [ ] 频道出现 system 消息后 **< 2s** 内出现 Alice 的气泡开始流式输出
- [ ] Sidebar Alice 状态点从 🟢 绿变 🟠 橙
- [ ] 完成后状态点变回绿，Task 保持 `in_progress`（状态不自动前进到 in_review，由用户决定）
- [ ] 如果 Task 没有 assignee，仅发 system 消息，**不**自动触发任何 Agent（与当前行为一致）
- [ ] 如果 assignee 当前 `status=stopped`，仅发 system 消息，**不**自动触发
- [ ] 关闭频道自动化（见下方"配置"）后恢复旧行为

---

**配置**:
- **默认开启**，无需用户手动启用（否则"优化不可见"）
- 可选加 `channels.task_automation_enabled INTEGER DEFAULT 1` 字段做频道级开关（P2，初版不做）

---

**风险**:

| 风险 | 说明 | 缓解 |
|------|------|------|
| assignee 不在频道 | Agent 从频道退出后 `assignee_agent_id` 仍指向它 | 触发前校验 `channel_agents` 存在，不在则仅发 system 消息 |
| 死循环：Agent 回复中 `@` 了另一个 task | 可能导致任务联级触发 | 受 `MAX_CHAIN_DEPTH`（D-6）限制，不是新问题 |
| 用户误点 badge | 本来只想看，结果触发了 | UI 保持点击 badge 切状态的显式操作；未来可加"undo"提示（P2） |

---

### O-2: Task 详情展开显示完整生命周期

**状态**: `[待排期]`

**优先级**: 🟡 中

**来源**: 2026-04-23 讨论（把"散落在消息流里的 Task 足迹"聚合展示）

**价值**:
- 用户不用翻历史找"当时 Alice 改了什么"
- Task 相关所有 system 消息 + Agent 实际工作消息在一处看到
- 让 `messages.metadata_json.task_ref` 和 `system_event.task_id` 的**反向查询**有落地场景

---

**当前行为**:
- Tasks Tab 里点击 `>` 展开 Task 只显示：
  - Task title
  - Assignee tag
  - 删除按钮
- "这个 Task 经历了什么"信息散落在频道消息流里，需要自己翻

**目标行为**:
- 展开后显示该 Task 的**时间线**：所有相关 system 消息 + Agent 实际工作消息的摘要
- 每条可点击 `[View in channel]` 跳到原消息上下文

---

**UI 形态（示意）**:

```
┌──────────────────────────────────────────────────────┐
│ ▼ #27  Implement auth module          [in_review]   │
│                                                      │
│   ↪ From message: "我们要加个 auth 模块..." by you    │
│     [View]                                           │
│                                                      │
│   Timeline:                                          │
│   📝 Created by you · 2h ago                         │
│   📌 Alice claimed (auto) · 1h ago                   │
│     └── [View in channel]                            │
│   💬 Alice replied · 55min ago                       │
│     └── 3 files changed (src/auth/*)                 │
│     └── [View in channel]                            │
│   ** Alice moved to In Review · 10min ago            │
│     └── [View in channel]                            │
│                                                      │
│   [Reassign] [Mark as Done] [Delete]                 │
└──────────────────────────────────────────────────────┘
```

**注意**："3 files changed" **不是新增字段**，是从**已有**的 `messages.metadata_json.tool_calls`（D-7）聚合派生的只读值。

---

**Schema 改动**: **无**（使用现有字段）

**新增 REST API**:

```
GET /api/tasks/:id/timeline
返回该 Task 相关的消息时间线，已按 created_at 排序
```

**查询逻辑**（伪 SQL）:
```sql
SELECT id, sender_type, sender_id, content, metadata_json, created_at
FROM messages
WHERE
  -- 系统消息关联该 task
  json_extract(metadata_json, '$.system_event.task_id') = :task_id
  -- 或 Agent 消息关联该 task（通过 @ 链式触发或 task_ref）
  OR json_extract(metadata_json, '$.task_ref.id') = :task_id
  -- 或原始消息（source_message_id）
  OR id = :source_message_id
ORDER BY created_at ASC;
```

**前端渲染逻辑**:
- 每条消息根据 `sender_type` 渲染不同图标（📝 / 📌 / 💬 / **）
- Agent 消息如果有 `tool_calls` 则显示 "N files changed"
- 点 `[View in channel]` 跳到 `/channel/:id?scrollTo=:messageId`

---

**前端改动位置**:
- `packages/web/src/components/TasksTab/TaskRow.tsx`（展开区域新增 Timeline 区块）
- `packages/web/src/hooks/useTaskTimeline.ts`（新增，调用上面的 REST API）

---

**验收标准**:
- [ ] Tasks Tab 点击 `>` 展开 Task 后显示 Timeline
- [ ] Timeline 包含至少：created / claimed（如有）/ assignee 的工作消息（如有）/ 状态变更（如有）
- [ ] Agent 消息条目显示 "N files changed"（来自 `tool_calls` 聚合）
- [ ] 点击 `[View in channel]` 正确跳转到频道内该消息并高亮 1.5s
- [ ] 如果 Task 没有 `source_message_id`，"From message" 行不显示（不是硬缺陷）
- [ ] 没有关联消息的 Task 只显示 Created 一条（空状态不崩）

---

**风险**:

| 风险 | 说明 | 缓解 |
|------|------|------|
| 性能：频道消息很多时查询慢 | `metadata_json` 是 TEXT 字段，`json_extract` 不走索引 | 数据量小时先不优化；后期可加生成列 + 索引 |
| 消息被删除后 timeline 出现断层 | Task 里的消息引用失效 | Timeline 显示 "[message deleted]" 占位 |
| Agent 消息的 `task_ref` 不一定填 | 现在只有 system 消息会填 `task_ref` | 推 O-1 时顺便：Agent 响应的消息也带 `task_ref`（来自触发上下文） |

---

### O-3: `source_message_id` 反向显示（消息 ↔ Task 双向追溯）

**状态**: `[待排期]`

**优先级**: 🟡 中

**来源**: 2026-04-23 讨论（`PLAN.md` MVP-2 已设计 `source_message_id` 字段，但 UI 没用起来）

**价值**:
- 让 "As Task" 机制闭环：用户从某条消息建了 Task，能在消息旁看到"已创建 #27"
- Task 详情里能看到"这个任务源自哪条消息"
- 字段已经存在，纯 UI 工程

---

**当前行为**:
- `tasks.source_message_id` 字段存在（PLAN.md MVP-2 schema）
- 后端 "As Task" 时正确写入（MVP-9 预留能力）
- **前端 UI 没有用这个字段**：
  - Task 详情里看不到来源消息
  - 消息卡片里看不到"已创建过 Task"

**目标行为**:
- Task 展开时显示 "↪ From message: ... [View]"（已在 O-2 UI 中体现）
- 频道内消息卡片下方，如果该消息创建过 Task，显示小标 "📝 Created #27"（点击跳到 Tasks Tab 该任务）

---

**Schema 改动**: **无**（两侧字段都已存在）

**需要补的一个小能力**:
- 反向查询：给定 message_id，找出 "由它创建的所有 tasks"
- 实现方式有两种：

| 方案 | 查询 | 优缺点 |
|------|------|------|
| A. 运行时 SQL | `SELECT id FROM tasks WHERE source_message_id = ?` | 简单；消息列表渲染时 N+1 查询风险 |
| B. 冗余到 metadata | `messages.metadata_json.created_task_ids: [27, 28]` | 渲染零额外查询；需要在创建 Task 时写入 |

**建议方案**: **B**（创建 Task 时同步更新消息 metadata），避免消息列表渲染时 N+1 查询。

---

**代码改动位置**:
- `packages/server/src/tasks/task.service.ts` 中 `createTask()`：如果 `source_message_id` 非空，同步更新该 message 的 `metadata_json.created_task_ids`
- `packages/server/src/tasks/task.service.ts` 中 `deleteTask()`：同步从 message metadata 移除
- `packages/web/src/components/MessageBubble/TaskRefFooter.tsx`（新增）：渲染 "📝 Created #27" 小标

---

**UI 形态（消息卡片底部小标）**:

```
┌── [你] 我们要加个 auth 模块，先请 @Alice 设计 ──┐
│                                                 │
│  ... message content ...                        │
│                                                 │
│  📝 Created #27 "Implement auth module"         │
└─────────────────────────────────────────────────┘
```

点击 `#27` 跳到 Tasks Tab 并展开该任务。

---

**验收标准**:
- [ ] 用户通过 "As Task" 从某条消息建 Task 后，该消息卡片底部出现 "📝 Created #N" 小标
- [ ] 点击小标正确跳到 Tasks Tab 并展开该任务（和 O-2 的展开态对齐）
- [ ] 删除 Task 后该消息的小标消失（刷新后或实时同步）
- [ ] 一条消息创建多个 Task 时显示 "📝 Created #27, #28"（罕见但合法）
- [ ] Task 详情（O-2 Timeline 的第一行）正确显示 "↪ From message: {原消息摘要} [View]"
- [ ] 点击 View 跳到频道该消息并高亮 1.5s

---

**风险**:

| 风险 | 说明 | 缓解 |
|------|------|------|
| 数据一致性：Task 创建/删除需要更新两处 | 事务失败时状态不一致 | 使用 SQLite 事务；或失败时静默降级为 SQL 查询方案 A |
| 历史数据：已存在的 Task 没有写 metadata | 老 Task 的源消息不显示小标 | 首次部署运行一次性迁移脚本回填 |

---

### O-4: Tasks Tab 增加"列视图"渲染切换

**状态**: `[待排期]`

**优先级**: 🟢 低（可延后到用户反馈后再评估）

**来源**: 2026-04-23 讨论（Slark 版"看板"的最小侵入形态）

**价值**:
- 重 Task 的频道可切到并列列视图，直观看"瓶颈在哪"
- 轻 Task 的频道保留列表视图，不打扰
- **不做拖拽**，避免偏向 Jira 心智；仍用点击 badge 切状态

---

**当前行为**:
- Tasks Tab 有过滤 tabs（All / Todo / In Progress / In Review / Done），选中后显示对应状态的列表
- 点击状态 badge 切换任务状态

**目标行为**:
- Tasks Tab header 增加 `[List] [Columns]` 视图切换按钮（默认 List）
- Columns 视图并列显示所有状态的列：

```
┌──── Tasks · [List] [Columns*] ────┐
│ Todo (3)    In Progress (2)    In Review (1)    Done (5)│
│ ┌───────┐   ┌───────┐          ┌───────┐        ┌───────┐│
│ │ #28   │   │ #27   │          │ #26   │        │ #23   ││
│ │ #29   │   │ #30   │          └───────┘        │ #24   ││
│ │ #31   │   └───────┘                           │ #25   ││
│ └───────┘                                       │ ...   ││
│                                                 └───────┘│
└─────────────────────────────────────────────────────────┘
```

- 每张卡片显示：编号 / 标题截断 / assignee tag
- **点击卡片上的状态 badge** 切状态（不做拖拽）
- 卡片之间**不**支持拖拽

---

**Schema 改动**: **无**

**前端改动**:
- `packages/web/src/components/TasksTab/TasksTab.tsx`：新增视图切换 state（`useSearchParams` 持久化到 URL `?tasksView=columns`）
- `packages/web/src/components/TasksTab/ColumnsView.tsx`（新增）
- 两种视图共用同一套 TaskCard 组件

---

**UI 约束**:
- 在 Slark 的**暖黄 Neo-Brutalism 设计语言下**实现列视图（每列 2px 黑边 + 硬阴影 + 状态色顶条）
- **不**引入拖拽库（如 dnd-kit）—— 保留"点击 badge 切状态"的唯一交互
- 列头数量与 `task_status` 枚举保持一致（todo / in_progress / in_review / done 四列）

---

**验收标准**:
- [ ] Tasks Tab 右上角出现 `[List] [Columns]` 切换按钮
- [ ] 点击 Columns 切换到四列视图，每列显示该状态的所有任务
- [ ] 每个卡片点状态 badge 仍能切换状态（O-1 的自动触发依然生效）
- [ ] 视图选择持久化到 URL（`?tasksView=columns`），刷新保持
- [ ] 视觉对齐 `docs/ui-reference/design-tokens.md`（2px 黑边 + 硬阴影 + 对应状态色）
- [ ] 默认视图是 List（保留 MVP-9 原体验）
- [ ] 小屏（< 768px）自动降级为 List 视图（不出现横向滚动）

---

**风险**:

| 风险 | 说明 | 缓解 |
|------|------|------|
| 偏向 Jira 心智 | 列视图看起来像看板 | **不做拖拽**；列名用任务状态术语而非 Kanban 术语；不出现 "Sprint" / "Epic" / "WIP limit" 等 |
| 小屏体验差 | 四列并排在手机上挤 | 小屏自动切 List（`@media`） |
| 过度设计 | 也许用户压根不切视图 | 先上线看埋点（默认 List，切过 Columns 的用户占比 < 5% 则考虑下架） |

---

## 二、废弃条目（不做的优化）

> **规则**：讨论后明确决定**不做**的优化放这里。目的是防止被同一话题反复讨论。

### ⛔ Reviewer 自动触发机制

**废弃日期**: 2026-04-23

**废弃理由**: **Slark 不区分 "reviewer" 这种特殊角色**。每个 Agent 都是"AI 同事"，角色分化由用户在 `agents.description` 中自由表达，**不在数据模型里固化**。

**具体拒绝的方案**:

| 被拒绝的方案 | 拒绝理由 |
|------------|---------|
| 新增 `tasks.reviewer_agent_id` 字段 | 把 "reviewer 是特殊角色" 固化到 schema，违背定位 |
| 新增 `channels.default_reviewer_agent_id` 字段 | 同上，且制造了"频道级特殊角色"概念 |
| Task 进 `in_review` 自动 @ 某个固定 Agent | 预设了协作拓扑（Dev → Reviewer），与 Slark 的"开放协作"不符 |
| Agent Template 里标 `role=reviewer` 并做特殊路由 | Agent Template（`routa-analysis.md` B-2）可以有 `role` 字段，但**只用于 prompt 注入**，不在路由层生效 |

**与 Slark 定位的关系**:
- `docs/product-brief.md` §3 场景 A 里的 "Architect → Dev → Reviewer" **是用户自己编排的协作拓扑**，靠 `@mention` 链式触发实现（MVP-7 的 `D-6`）
- **Slark 不为任何角色（Reviewer / Architect / Dev）做系统层面的特殊路由**
- 这是 Slark 和 Routa 的关键分岔：Routa 是 **"系统编排协作"**，Slark 是 **"用户编排协作，系统只做传导"**

**后续若变更此决策**:
- 需要先修改 `docs/product-brief.md` §9（编程协作室的语义）
- 创建 ADR 格式决策（新的 `D-N`）标 `Supersedes: O-废弃/reviewer-trigger`
- 在本条目下追加"已复活于 YYYY-MM-DD 依据 D-N"记录

**相关条目**:
- O-1 只触发 `assignee_agent_id`，**不**触发任何"reviewer 角色"
- 如果用户在频道内确实想让 Dev 完成后通知特定审查者，由用户在 Dev 的 `description` 中写 "完成后 @某某" 实现（Agent 层面自驱，非系统层面硬编码）

---

## 三、新增条目模板

> 新增 O-N 条目时复制以下模板：

```markdown
### O-N: <简短标题>

**状态**: `[待排期]` / `[规划中]` / `[进行中]` / `[已完成]` / `[已废弃]`

**优先级**: 🔴 高 / 🟡 中 / 🟢 低

**来源**: <文档引用 + 讨论日期>

**价值**:
- ...

---

**当前行为**:
- ...

**目标行为**:
- ...

---

**Schema 改动**: <有 / 无>

**代码改动**:
- 位置：<文件路径>
- 伪码：...

---

**UI 形态**:
- ...

---

**验收标准**:
- [ ] ...

---

**风险**:

| 风险 | 说明 | 缓解 |
|------|------|------|
| ... | ... | ... |
```

---

## 四、版本历史

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v0.1 | 2026-04-23 | 初版：O-1 ~ O-4 Task 设施优化条目；废弃"Reviewer 自动触发"决策 | - |

---

**本文档的角色**：**已决定要做、尚未排期**的优化单一清单。
**更新原则**：条目进 `PLAN.md` 后标 🔵；交付后标 ✅ 并在后续 Sprint 归档；决定不做的移至"废弃条目"区。
