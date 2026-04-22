# Slark

> 本地 AI Agent 协作平台 — [slock.ai](https://slock.ai) 的本地开源复刻版。
> Agent 能力由 **Cursor CLI** 驱动，无需登录、无需 MCP、所有数据 100% 本地存储。

## ✨ 特性

- 🟡 **1:1 还原 slock.ai UI** — Neo-Brutalism 风格（暖黄侧边栏 / 奶油主区 / 2px 黑边 / 粉色 CTA）
- 🤖 **多 Agent 协作** — 通过 `@mention` 在频道/Thread 内触发任意 Agent
- 🔗 **链式触发 + Thread 隔离** — Agent 之间互相 `@mention` 自动形成 Thread 对话，主线保持整洁
- 📝 **Tasks 管理** — 频道内 Tasks Tab + 全局 Kanban 看板 + 状态变更系统消息
- 🔍 **全文搜索 / 收藏 / 全局 Threads 聚合**
- 💾 **100% 本地** — SQLite 存储在 `~/.slark/slark.db`，不经任何云端服务器
- 🛠️ **适配器架构** — MVP 专注 Cursor CLI，后续可扩展 Codex / Claude Code / 其他 runtime

## 🚀 快速开始

### 前置

- **Node.js ≥ 20**, **pnpm ≥ 10**
- **[Cursor CLI](https://cursor.sh)** (`cursor-agent`) 已安装并登录
  - MVP 当前唯一支持的 Runtime
  - 其他 runtime（Codex / Claude / Kimi / Copilot / Gemini）在 UI 中标为 "coming soon"

### 启动

```bash
pnpm install
pnpm dev                # 并发启动前后端

# 然后访问
# → http://localhost:4178   前端 UI
# → http://127.0.0.1:4179   后端 API + WebSocket
```

首次启动会：
- 在 `~/.slark/slark.db` 创建 SQLite 数据库
- 预置 `#general` 频道
- 如检测到 `cursor-agent`，自动创建一个 `Assistant` Agent 加入 `#general`

### 常用命令

```bash
pnpm dev             # 并发启动前后端
pnpm dev:web         # 仅前端（Vite @ 4178）
pnpm dev:server      # 仅后端（Fastify + tsx watch @ 4179）

pnpm build           # 递归构建所有 packages
pnpm typecheck       # 递归类型检查
pnpm lint            # ESLint
pnpm format          # Prettier
```

### 快捷键

- `⌘/Ctrl + K` — 全局搜索
- `Enter` — 发送消息
- `⌘/Ctrl + Enter` — 多行字段保存（Agent Profile 内联编辑等）
- `Esc` — 关闭对话框

## 🏗️ 架构

```
┌──────────────┬─────────────────────┬────────────────────┐
│  Web (React) │  WebSocket + REST   │  Server (Fastify)  │
│  4178        │  ← → + /api/*       │  4179              │
└──────────────┴─────────────────────┴────────────────────┘
                                               │
                                               ↓
                              ┌────────────┬────────────────┐
                              │  SQLite    │  CLI Bridge    │
                              │ ~/.slark   │  cursor-agent  │
                              │ /slark.db  │  spawn + NDJSON│
                              └────────────┴────────────────┘
```

### 五个核心模块

- **M1 — CLI Bridge** (`packages/server/src/agents/`) 替代 MCP，通过 `spawn + NDJSON` 与 CLI 工具通信
- **M2 — Agent Engine** 上下文构建（description + 团队列表 + 对话历史 + token 预算裁剪）+ 状态机
- **M3 — Message Bus** (`packages/server/src/messaging/`) WebSocket + @mention 解析 + 链式触发 + Thread 管理
- **M4 — Data Layer** (`packages/server/src/db/`) SQLite 7 张表 + Repository 封装
- **M5 — Frontend UI** (`packages/web/src/`) React 19 + Tailwind v4 + Zustand + Radix

## 📂 目录结构

```
slark/
├── packages/
│   ├── web/              # React 19 + Vite + Tailwind v4 前端
│   ├── server/           # Fastify + ws + better-sqlite3 后端
│   └── shared/           # 前后端共享类型、常量、事件协议
├── spike/                # Phase 0 CLI Bridge 技术验证产物
├── docs/
│   ├── technical-decisions.md    # 12 条默认决策（D-1~D-12）
│   ├── phase0-cli-spike.md       # Phase 0 验证计划
│   ├── cli-event-format.md       # CLI 事件格式对照
│   └── ui-reference/             # UI 基准（17 张截图 + 4 份规范）
├── PLAN.md               # 主设计文档（4 阶段路线 + 验收清单）
├── pnpm-workspace.yaml
└── package.json
```

## 📖 核心文档

| 文档 | 用途 |
|------|------|
| [PLAN.md](PLAN.md) | 项目总览 + 4 阶段实施路线 + 每阶段验收清单 |
| [docs/technical-decisions.md](docs/technical-decisions.md) | 状态机、Token 预算、并发、错误 UI 等默认决策 |
| [docs/ui-reference/README.md](docs/ui-reference/README.md) | UI 视觉基准（17 张真实截图 + 4 份规范） |
| [docs/cli-event-format.md](docs/cli-event-format.md) | 三个 CLI 的事件格式对照 |
| [spike/README.md](spike/README.md) | Phase 0 CLI 验证结果总结 |

## 🧪 已完成路线

- ✅ **Phase 0** — CLI Spike（Cursor / Codex 实测，统一适配器接口）
- ✅ **Phase 0.5** — UI 基准采集（17 张 slock.ai 截图 + 规范文档）
- ✅ **Phase 1** — Monorepo 骨架 + SQLite 7 表 + REST + WebSocket
- ✅ **Phase 2** — Cursor 适配器 + 上下文构建 + 并发队列 + 端到端流式回复
- ✅ **Phase 3** — UI Shell + 链式触发 + Thread Panel + Agent Profile + Tasks 面板
- ✅ **Phase 3+** — Edit/Members Dialog / Create Channel / 全局 Threads Tasks Saved / Search / 代码高亮 / Task 编辑 / 可编辑 Profile / As Task 联动

## 🔮 后续迭代

- 多 Runtime 适配器正式接入（Codex / Claude / Kimi / Copilot / Gemini）
- Agent-to-Agent 主动 DM
- 桌面通知 / 声音
- 深色主题
- Pixel-art 头像

## 📜 许可

MIT — 详见 [LICENSE](LICENSE)
