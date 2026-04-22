# Technical Decisions & Defaults

> Slark 项目的默认技术决策与常量。开发中遇到本文档覆盖的问题时，以此为准；发现不合理时通过 PR 修改本文档 + 关联代码。

所有决策编号为 `D-N`，可以在代码注释和 commit message 中引用（例 "Fix D-4 budget overflow"）。

---

## D-1: Agent 状态机（重定义，适配 spawn-per-message 模型）

### 决策

使用以下 5 个状态替代原版的 `Online/Thinking/Working/Hibernating/Offline`:

| 状态 | 含义 | UI 状态点颜色 |
|------|------|---------------|
| `idle` | Agent 已配置、CLI 已检测可用、当前无进程 | 🟢 绿色 |
| `thinking` | 已 spawn 进程，正在消费 stdin 或等待首个事件 | 🟠 橙色 |
| `working` | 进程已产出 `text_delta` 或 `tool_started` | 🟠 橙色 |
| `error` | 上一次 spawn 失败/超时/非 0 退出 | 🔴 红色 |
| `stopped` | 用户显式 Stop，需手动 Start 才能再次响应 | ⚫ 灰色 |

### 理由

- `spawn-per-message` 模型下没有"长期在线"的进程，删除 `Online`/`Hibernating` 避免误导
- `idle` 对应原版 "Online"（已注册可用）
- `thinking` / `working` 拆分保留，前端可据此切换加载图标

### 状态转移

```
              spawn
   idle  ─────────────►  thinking  ─────────────►  working  ─────────────►  idle
    ▲                        │                        │                       │
    │                        │ timeout / crash        │ timeout / crash       │
    │                        ▼                        ▼                       │
    │                      error  ────── retry ────►  thinking                │
    │                                                                         │
    │                                                                         │
    │                          user click Stop                                │
    └─────────── stopped ◄─────────────────────────────────────────────────────┘
                   │
                   │ user click Start
                   ▼
                 idle
```

---

## D-2: CLI 事件 → Agent 状态映射

| CLI 事件（Phase 0 统一后的 `CLIEvent`） | Agent 状态变更 |
|----------------------------------------|-----------------|
| `spawn 前` | `idle` → `thinking` |
| 首个 `text_delta` 或 `tool_started` | `thinking` → `working` |
| `tool_started` 后续（已在 working） | 保持 `working` |
| `done`（进程正常退出） | `working` → `idle` |
| `error`（非 0 退出 / 超时 / parse 失败） | 任意 → `error` |
| 用户点 Stop | 任意 → `stopped`（同时 kill 进程） |
| 用户点 Start（从 `stopped` 或 `error`） | → `idle` |

所有状态变更通过 WebSocket `agent_status` 事件广播，前端 `useAgentStore` 订阅更新。

---

## D-3: Activity 记录粒度

`agent_activity` 表用于 Profile → Activity Tab 实时日志。**不等同于消息流**，只记录"元事件"。

### 记录规则

| 触发 | 写一条 activity | 示例 `detail` |
|------|-----------------|---------------|
| spawn 开始 | `type=thinking` | `"Spawning codex with model=gpt-5.4"` |
| 首个 text/tool 事件 | `type=working` | `"Started generating response"` |
| 每个 `tool_started` | `type=working` | `"Shell: ls -la /path"` |
| 每个 `tool_completed` | `type=output` | `"Shell completed (exit=0)"` |
| `done`（正常结束） | `type=idle` | `"Completed in 12.3s"` |
| `error` | `type=error` | `"Timeout after 300s"` |

**不记录**：
- `text_delta`（每个字符/片段都记录会爆炸）
- 心跳事件
- 用户消息本身（那是 messages 表的事）

### 保留策略

- 每个 agent 保留最近 **500 条 activity**，超出从头删除
- Profile → Activity Tab 分页加载（每页 50 条）

---

## D-4: Token 预算默认值

| 常量 | 默认值 | 说明 |
|------|--------|------|
| `MAX_CONTEXT_TOKENS` | `8000` | 单次 spawn 注入给 CLI 的总 token 上限（保守值，所有主流模型都 OK） |
| `DESCRIPTION_BUDGET` | `2000` | Agent `description` 占用的预算上限，超过截断 |
| `HISTORY_BUDGET` | `5500` | 对话历史占用预算，**按最近消息倒序填充直到用完** |
| `CURRENT_MESSAGE_BUDGET` | `500` | 当前触发消息占用预算（几乎不会超） |

### 截断策略

- Token 估算用 **"4 字符 ≈ 1 token"** 的粗估（不引入 tokenizer 依赖）
- 从最新消息往前累加字符数到 `HISTORY_BUDGET * 4`，超出就丢弃
- `description` 如果超限，从中间截断并用 `...` 代替（保留开头 + 结尾的职责说明）

### 可配置

上述常量写在 `packages/shared/src/constants.ts`，用户暂不在 UI 中配置。未来可加入 `Advanced Settings`。

---

## D-5: 并发控制

| 常量 | 默认值 | 说明 |
|------|--------|------|
| `MAX_CONCURRENT_PROCESSES` | `3` | 同时运行的 CLI 进程数上限 |
| `PROCESS_TIMEOUT_MS` | `300000`（5 分钟） | 单次 spawn 的超时时间 |
| `QUEUE_STRATEGY` | `FIFO` | 超出并发时的等待队列策略 |
| `QUEUE_MAX_SIZE` | `20` | 队列最大长度，超出直接拒绝并返回 error |

### 行为

- 请求来时：并发 < 3 → 立刻 spawn；并发 = 3 → 进入队列；队列满 → 立刻返回 `agent_status = error, detail="queue_full"`
- 进程结束后：检查队列，FIFO 弹出下一个
- 用户点 Stop：从队列中移除（如果在队列中），或 kill 进程（如果已 spawn）

---

## D-6: 链式触发防护

| 常量 | 默认值 | 说明 |
|------|--------|------|
| `MAX_CHAIN_DEPTH` | `10` | 一次链式触发最多传递多少层 |
| `MAX_AGENT_CONSECUTIVE_TRIGGERS` | `3` | 同一 agent 在一个 thread 内连续被触发次数上限 |
| `MAX_MENTIONS_PER_MESSAGE` | `5` | 单条消息 @mention 他人的上限（超出不触发后面的） |

### 行为

- 消息带 `chain_depth` metadata（从 0 开始）
- Message Router 在触发下一 Agent 前检查：
  - 当前 thread 消息数 >= `MAX_CHAIN_DEPTH` → 停止触发 + 发 system 消息 `"Chain depth limit reached"`
  - 同一 agent 在当前 thread 内连续被触发 >= 3 → 停止 + `"Possible infinite loop detected"`
- User 主动 @mention 不受 `consecutive` 限制（只防 Agent 间循环）

---

## D-7: `messages.metadata_json` 契约

TypeScript 类型（在 `packages/shared/src/types.ts` 中定义）:

```typescript
type MessageMetadata = {
  // 提及的 agent 列表（正则解析自 content）
  mentions?: Array<{ name: string; agent_id: string | null }>;

  // 关联的 task（当 Task 状态变更产生系统消息时）
  task_ref?: {
    id: number;
    title: string;
    status: 'todo' | 'in_progress' | 'in_review' | 'done';
    assignee_agent_id: string | null;
  };

  // 链式触发深度（0 = 用户首次发起）
  chain_depth?: number;

  // 链式触发中的"上游"消息 id
  triggered_by_message_id?: string;

  // CLI 工具调用记录（存在此消息的响应内）
  tool_calls?: Array<{
    tool: string;
    args: Record<string, unknown>;
    result?: string;
    success?: boolean;
    duration_ms?: number;
  }>;

  // 消息是否正在流式输出（未完成时为 true，完成后移除或置 false）
  streaming?: boolean;

  // Agent 响应的元信息（仅 sender_type=agent 时存在）
  agent_meta?: {
    runtime: string;        // "codex" / "claude" / "cursor"
    model: string;          // 实际使用的模型
    total_duration_ms: number;
    input_tokens_estimate?: number;
    output_tokens_estimate?: number;
  };

  // System 消息的事件类型（仅 sender_type=system 时存在）
  system_event?:
    | { type: 'task_created'; task_id: number; title: string }
    | { type: 'task_claimed'; task_id: number; agent: string }
    | { type: 'task_moved'; task_id: number; from: string; to: string; by: string }
    | { type: 'agent_error'; agent: string; message: string }
    | { type: 'chain_limit_reached'; detail: string };
};
```

### 规则

- metadata_json 字段非必需（`NULL` 合法）
- 插入时序列化 JSON；读取时按类型反序列化
- 前端渲染消息卡片时，根据 metadata 决定 task badge、@mention 样式等

---

## D-8: Agent Workspace 目录

### 路径

```
~/.slark/
├── slark.db                  # SQLite 数据库主文件
├── agents/
│   └── {agent_id}/           # 每个 Agent 一个目录
│       ├── (由 CLI 工具自行创建的文件，Slark 不预置)
│       └── (Claude Code 可能创建 CLAUDE.md 等)
└── logs/
    └── {date}/               # 按日期分目录
        └── {agent_id}.log    # Agent 执行日志
```

### 规则

- **Create Agent 时**：MVP-8 流程中 `mkdir -p ~/.slark/agents/{agent_id}/`
- **spawn CLI 时**：将该目录作为 `child_process.spawn` 的 `cwd`
- **Slark 不预置任何文件**（D-1 记忆哲学）
- **Delete Agent 时**：可选删除目录（需用户确认，默认保留作为"归档"）

### Workspace Tab UI

- 展示目录内文件树（递归最多 3 层）
- 支持打开查看纯文本 / markdown 文件
- 不支持编辑（MVP）——未来迭代可加

### 验证逻辑

Create Agent 前校验 `~/.slark/` 是否可写，不可写时报错并阻止创建。

---

## D-9: Seed 数据

首次启动（`slark.db` 不存在时）自动执行:

```
channels:
  - id: "general"
    name: "general"
    description: "General channel"
    type: "channel"

agents: (根据本地检测动态决定)
  - 如果 cursor-agent 已安装：
      创建 "Assistant" agent, runtime="cursor", model="composer-2-fast"
  - 否则跳过（只有欢迎页引导安装）

channel_agents:
  - 将 Assistant 加入 #general

messages: (空)
tasks: (空)
```

用户第一次打开应用就能立刻和 Assistant 对话，不会面对空白状态。

### MVP Runtime 范围（见 PLAN MVP-4）

MVP 只实装 Cursor 适配器。Runtime 下拉展示 6 个选项：

| Runtime | MVP 状态 |
|---------|---------|
| Cursor CLI | ✅ 可选，需本地安装 `cursor-agent` |
| Codex CLI | ❌ 标 "coming soon" 且 disabled |
| Claude Code | ❌ 标 "coming soon" 且 disabled |
| Kimi CLI | ❌ 标 "coming soon" 且 disabled |
| Copilot CLI | ❌ 标 "coming soon" 且 disabled |
| Gemini CLI | ❌ 标 "coming soon" 且 disabled |

### 如果本地没有 Cursor CLI？

- 不创建 Agent
- 欢迎页显示引导："No Cursor CLI detected. Install `cursor-agent` from Cursor IDE to create your first agent. [View Installation Guide]"

---

## D-10: 启动方式

### MVP 阶段

- 开发模式：`pnpm dev`（并发启动 web + server）
- 监听地址：`http://localhost:4178`（web） + `ws://localhost:4179`（server WebSocket）+ `http://localhost:4179`（server REST）
- 端口冲突自动降级到下一个可用端口

### 后续（Phase 4+）

- 打包为 Electron / Tauri 应用
- 单一可执行文件启动
- 系统托盘常驻

### 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `SLARK_HOME` | `~/.slark` | 数据目录 |
| `SLARK_PORT_WEB` | `4178` | 前端端口 |
| `SLARK_PORT_SERVER` | `4179` | 后端端口 |
| `SLARK_LOG_LEVEL` | `info` | 日志级别 |
| `SLARK_CLI_TIMEOUT_MS` | `300000` | 覆盖默认 CLI 超时 |

---

## D-11: Error / Loading / Empty 状态 UI 规范

### Error 状态

| 场景 | UI 表现 |
|------|---------|
| CLI spawn 失败 | 频道内产生 system 消息，红色文字："⚠ @Agent failed to start: {error_message}" |
| CLI 超时 | 频道内 system 消息："⏱ @Agent timed out after 5min" + Agent 状态点变红 |
| CLI parse error | 频道内 system 消息："🐛 @Agent output could not be parsed" |
| 网络断开（WS 掉线） | 全局 banner："⚠ Connection lost. Retrying..." |
| SQLite 写入失败 | Toast 通知："Failed to save message. Check disk space." |

### Loading 状态

| 场景 | UI 表现 |
|------|---------|
| Agent 正在 thinking（未出字） | 消息占位卡片 + 三点加载动画 "..."；Agent 状态点变橙色 |
| Agent 正在 working（tool_call） | 消息卡片显示当前工具 "🔧 Running: ls -la" |
| 初次加载频道历史 | 骨架屏（4-5 条消息占位） |
| 发送消息 | Send 按钮禁用 + 加载图标 |

### Empty 状态

| 场景 | UI 表现 |
|------|---------|
| 从未选择频道 | 欢迎页："Welcome to Slark" + 使用指引 |
| 空频道（无消息） | "No messages yet. Start a conversation." |
| 空 Tasks | "No tasks in this channel. Click + New Task to create one." |
| 空 Threads 全局页 | "No threads yet." |
| 未安装任何 CLI | 引导安装："Install Codex / Claude Code / Cursor CLI to get started." |

---

## 待执行阶段决策（非阻塞）

以下决策等到具体 Phase 时再定：

### O-1: 前端组件库选型（在 MVP-5 启动时定）

**推荐**：Tailwind + Radix UI Primitives（无样式 accessibility 原语，样式全自写）

理由：slock.ai 的 Neo-Brutalism 风格（2px 黑边 + 硬阴影 + 零渐变 + 粉黄强色）与 shadcn/ui 默认风格冲突严重，深度定制 shadcn 的成本 ≥ 自写；但完全裸写需要自行处理 a11y（Focus trap、Dialog、Menu 等）。Radix 是最佳中间方案。

### O-2: UI 对比验收方式（在 MVP-5 启动时定）

**推荐**：**组件清单逐项核验** + **关键页面并排截图**

理由：Playwright 视觉回归太重；纯人工太主观。折中：每个组件在 PR 描述中附上 before/after 截图，对照参考截图做肉眼检查。关键 3-5 个页面（Channel Main / DM / Profile / Create Dialog / Thread）做并排对比。

### O-3: CLI 适配器具体字段映射（Phase 0 完成后）

待 Phase 0 跑完后根据实际 JSON 输出更新 `docs/cli-event-format.md`。

### O-4: Electron/Tauri 打包选型（Phase 4，MVP 外）

不在 MVP 范围。

---

## D-12: Cursor CLI 流式策略（MVP-4 决定）

### 决策

Cursor CLI **不启用** `--stream-partial-output`，即 `CursorAdapter.capabilities.supportsTextDelta = false`。

### 为什么

Cursor 的 `--stream-partial-output` 会产生两阶段输出：
1. 多条 `assistant` chunk（模型实时 draft，片段化）
2. 最后 1 条 `assistant` 完整 replay（**经 Composer 重新整理过**，与前面累加的 chunks 内容不完全相同）
3. `result` 事件（`result.result` = 最终版 = 最后那条 assistant）

这导致前端会看到"流式显示了一段 draft → 突然被覆盖为整理后的最终版"的跳动，UX 不好。

关闭后的实际表现：
- `thinking.delta` 事件仍然流式（用户看到"思考过程"实时更新）
- `assistant` 事件一次性给出完整文本，emit 为 `text.completed`
- 前端在 thinking 阶段显示灰色思考动画，切换到 final answer 时一次性展示

### 权衡

- **TTFB**：5-15s（见 Phase 0 基线），但 thinking 阶段 4.5s 就开始流式反馈
- **未来优化方向**：Runner 层加"伪流式"切片 emit（固定间隔把 text.completed 分段 emit 为 text.delta），可获得打字机效果而不引入 replay 风险

