# Phase 0: CLI Bridge 技术验证 (Spike)

> 目标: 在写业务代码之前，验证 Codex CLI / Claude Code / Cursor CLI 的非交互模式行为，确定 CLI Bridge 的正确实现方式。

## 背景

Slark 的核心创新是用本地 CLI 工具替代 MCP 协议驱动 Agent。CLI Bridge 是整个项目的最大技术风险点 -- 如果 CLI 工具的非交互模式不可用或行为不符合预期，整个架构需要重新设计。

### 已确认的 CLI 工具接口

| CLI 工具 | 本地状态 | 非交互命令 | 流式输出 |
|----------|---------|-----------|---------|
| Codex CLI v0.118.0 | 已安装 | `codex exec "prompt" --json` | JSONL 事件 |
| Claude Code | 未安装 | `claude -p "prompt" --output-format stream-json` | NDJSON 事件 |
| Cursor CLI | 未确认路径 | `cursor agent -p "prompt" --output-format stream-json` | NDJSON 事件 |

### 共同特征（已确认）

三个 CLI 工具都是 **spawn-per-message 模型**:
- 每次调用是一次独立执行（不是长驻进程）
- 通过命令行参数或 stdin pipe 传入 prompt
- stdout 输出 JSONL/NDJSON 格式的事件流
- 进程在任务完成后自动退出

---

## 验证计划

### Step 1: 环境准备

**1.1 确认 Codex CLI**

```bash
codex --version
# 预期: codex-cli 0.118.0
```

**1.2 安装 Claude Code**

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

需要确认:
- 是否需要 `ANTHROPIC_API_KEY` 环境变量
- 安装后命令名是 `claude` 还是其他

**1.3 确认 Cursor CLI**

```bash
# 方式 1: Cursor IDE 内置 CLI
which cursor
cursor --version

# 方式 2: 如果 cursor 命令不存在，尝试通过 Cursor IDE 安装
# Cursor → Command Palette → "Install 'cursor' command"

# 方式 3: 直接使用 Cursor 应用路径
/Applications/Cursor.app/Contents/MacOS/Cursor --version
```

需要确认:
- 是否需要 `CURSOR_API_KEY` 或 `cursor auth login`
- 命令名是 `cursor` 还是 `cursor-agent`

---

### Step 2: Codex CLI 验证

**2.1 基础 JSONL 输出测试**

```bash
# 创建临时 git 仓库（codex 要求 git 环境）
mkdir -p /tmp/slark-spike && cd /tmp/slark-spike && git init

# 运行并捕获完整 JSONL 输出
codex exec --json --ephemeral -m o3-mini \
  "回复一段简短的自我介绍，不超过50字" \
  2>/dev/null | tee codex-output.jsonl
```

**需要记录**:
- [ ] 每行 JSON 的 `type` 字段有哪些值
- [ ] text 内容在哪个字段（是增量 delta 还是完整 text）
- [ ] tool_call 事件的结构（如果有）
- [ ] 最终完成事件的格式
- [ ] 错误事件的格式
- [ ] 从 spawn 到第一个 text 事件的延迟（秒）

**2.2 模型选择测试**

```bash
codex exec --json --ephemeral -m gpt-4.1 "say hello" 2>/dev/null | head -5
codex exec --json --ephemeral -m o3-mini "say hello" 2>/dev/null | head -5
```

**需要记录**:
- [ ] `-m` 参数支持哪些模型名称
- [ ] 不同模型的首 token 延迟差异

**2.3 工作目录 + Sandbox 测试**

```bash
codex exec --json --ephemeral \
  -C "$(pwd)" \
  -s workspace-write \
  -m o3-mini \
  "列出当前目录下的文件" \
  2>/dev/null | tee codex-workdir.jsonl
```

**需要记录**:
- [ ] Agent 是否能正确读取指定目录
- [ ] `-s workspace-write` 是否允许文件写入
- [ ] tool_call 事件中文件操作的格式

**2.4 上下文注入测试（stdin pipe）**

```bash
# 测试通过 stdin 注入历史消息上下文
echo "以下是历史对话:
[User] 我们在开发一个聊天应用
[Assistant] 好的，需要什么帮助？
---
请基于以上上下文回答：这个项目用的什么技术栈？" | \
codex exec --json --ephemeral -m o3-mini - \
  2>/dev/null | tee codex-context.jsonl
```

**需要记录**:
- [ ] stdin 注入是否成功（Agent 能否引用历史内容）
- [ ] stdin 和命令行参数 prompt 的优先级/组合方式
- [ ] 长上下文（>4000 字符）是否正常工作

**2.5 环境变量注入测试**

```bash
CUSTOM_VAR="test_value" codex exec --json --ephemeral -m o3-mini \
  "读取环境变量 CUSTOM_VAR 的值" \
  2>/dev/null | tee codex-env.jsonl
```

---

### Step 3: Claude Code 验证

**3.1 基础 NDJSON 输出测试**

```bash
claude -p --output-format stream-json \
  "回复一段简短的自我介绍，不超过50字" \
  2>/dev/null | tee claude-output.ndjson
```

**需要记录**:
- [ ] 事件 `type` 字段的所有可能值
- [ ] text 内容字段路径（与 Codex 对比）
- [ ] tool_call 事件结构（与 Codex 对比）
- [ ] 首 token 延迟

**3.2 工具控制测试**

```bash
claude -p --output-format stream-json \
  --allowedTools "Read,Write,Bash" \
  "列出当前目录下的文件" \
  2>/dev/null | tee claude-tools.ndjson
```

**3.3 轮次限制测试**

```bash
claude -p --output-format stream-json \
  --max-turns 3 \
  "分析当前目录的项目结构" \
  2>/dev/null | tee claude-turns.ndjson
```

**需要记录**:
- [ ] `--max-turns` 是否有效限制了 Agent 的执行轮次
- [ ] 超过限制后的行为（静默停止 / 错误事件 / 摘要输出）

**3.4 上下文注入测试**

```bash
echo "以下是历史对话:
[User] 我们在开发一个聊天应用
[Assistant] 好的，需要什么帮助？
---
请基于以上上下文回答：这个项目用的什么技术栈？" | \
claude -p --output-format stream-json \
  2>/dev/null | tee claude-context.ndjson
```

---

### Step 4: Cursor CLI 验证

**4.1 基础 NDJSON 输出测试**

```bash
cursor agent -p --output-format stream-json \
  "回复一段简短的自我介绍，不超过50字" \
  2>/dev/null | tee cursor-output.ndjson
```

**已知的事件格式**（来自社区文档）:

```jsonl
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]},"session_id":"..."}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]},"session_id":"..."}
{"type":"tool_call","subtype":"started","tool_call":{"shellToolCall":{"args":{"command":"..."}}},"session_id":"..."}
{"type":"tool_call","subtype":"completed","tool_call":{"shellToolCall":{"result":{"success":{"exitCode":0}}}},"session_id":"..."}
{"type":"result","subtype":"success","duration_ms":12345,"session_id":"..."}
```

**需要记录**:
- [ ] 实际输出是否与上述格式一致
- [ ] `--force` / `--yolo` 模式下 tool_call 的行为差异
- [ ] 认证方式（CURSOR_API_KEY vs cursor auth login）

**4.2 增量输出测试**

```bash
cursor agent -p --output-format stream-json \
  --stream-partial-output \
  "写一段 100 字的项目介绍" \
  2>/dev/null | tee cursor-stream.ndjson
```

**需要记录**:
- [ ] `--stream-partial-output` 是否输出增量 text delta
- [ ] delta 事件的格式（是在 assistant 事件内还是独立事件类型）

---

### Step 5: 统一适配器接口定义

基于 Step 2-4 的实际验证结果，定义以下接口:

```typescript
// === 通用事件类型（三个 CLI 的输出统一映射到这些类型） ===

type CLIEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'text_done'; content: string }
  | { type: 'tool_started'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_completed'; tool: string; success: boolean; result?: string }
  | { type: 'error'; message: string; code?: string }
  | { type: 'done'; duration_ms?: number }

// === 适配器接口 ===

interface CLIAdapter {
  readonly name: string;                    // 'codex' | 'claude' | 'cursor'
  readonly isAvailable: boolean;            // 本地是否已安装

  checkInstallation(): Promise<{
    installed: boolean;
    version?: string;
    path?: string;
  }>;

  buildCommand(params: {
    prompt: string;
    model?: string;
    reasoning?: 'low' | 'medium' | 'high' | 'xhigh';
    workingDirectory?: string;
    envVars?: Record<string, string>;
    maxTurns?: number;
  }): { command: string; args: string[]; env?: Record<string, string> };

  parseEvent(line: string): CLIEvent | null;

  getSupportedModels(): string[];
}

// === 进程运行器（所有适配器共享） ===

interface CLIRunner {
  run(
    adapter: CLIAdapter,
    params: RunParams,
    onEvent: (event: CLIEvent) => void,
  ): Promise<{ exitCode: number; fullText: string }>;

  abort(processId: string): void;
}

interface RunParams {
  prompt: string;
  context?: string;           // stdin pipe 注入的上下文
  model?: string;
  reasoning?: string;
  workingDirectory?: string;
  envVars?: Record<string, string>;
  maxTurns?: number;
  timeoutMs?: number;         // 默认 300000 (5 分钟)
}
```

**需要验证后调整**:
- [ ] `parseEvent` 的具体实现（三个 CLI 的 JSON 字段映射）
- [ ] `buildCommand` 的参数是否完整覆盖所有 CLI 选项
- [ ] stdin pipe 是否是所有 CLI 都支持的上下文注入方式

---

### Step 6: 基线数据采集

运行以下测试采集性能基线:

| 测试项 | Codex | Claude Code | Cursor CLI |
|--------|-------|-------------|------------|
| 首 token 延迟（简单 prompt） | ? | ? | ? |
| 首 token 延迟（4K 上下文注入） | ? | ? | ? |
| 完整回复延迟（50 字回复） | ? | ? | ? |
| 进程启动到退出（空 prompt） | ? | ? | ? |
| stdin 最大支持长度 | ? | ? | ? |

---

## 交付物清单

完成 Phase 0 后应产出以下文件:

```
slark/
├── spike/
│   ├── README.md                    # 验证结果总结
│   ├── test-codex.sh                # Codex CLI 测试脚本
│   ├── test-claude.sh               # Claude Code 测试脚本
│   ├── test-cursor.sh               # Cursor CLI 测试脚本
│   ├── outputs/
│   │   ├── codex-output.jsonl       # Codex 原始输出样本
│   │   ├── claude-output.ndjson     # Claude 原始输出样本
│   │   └── cursor-output.ndjson     # Cursor 原始输出样本
│   └── src/
│       ├── types.ts                 # CLIEvent + CLIAdapter 接口定义
│       ├── codex-adapter.ts         # Codex 适配器原型
│       ├── claude-adapter.ts        # Claude 适配器原型
│       ├── cursor-adapter.ts        # Cursor 适配器原型
│       ├── runner.ts                # CLIRunner 进程运行器原型
│       └── demo.ts                  # 端到端演示脚本
└── docs/
    └── cli-event-format.md          # 三个 CLI 事件格式对照文档
```

---

## 验收标准

Phase 0 完成的标志:

1. **三个 CLI 至少有两个验证通过**（其中一个未安装可接受，记录原因）
2. **统一适配器接口已定义**，且至少一个适配器原型可运行 demo
3. **事件格式对照文档已完成**，明确了 parseEvent 的映射规则
4. **上下文注入方式已确定**（stdin pipe / 命令行参数 / 临时文件）
5. **性能基线数据已采集**，首 token 延迟在可接受范围（<10s）
6. **`spike/src/demo.ts` 可运行**:
   - 传入一段 prompt
   - 调用适配器 spawn CLI 进程
   - 流式打印 text_delta 事件到终端
   - 最终输出完整回复文本

---

## 风险与备选方案

| 风险 | 影响 | 备选方案 |
|------|------|---------|
| Codex CLI 在非 git 目录下无法运行 | 需要 `--skip-git-repo-check` | 每个 Agent workspace 初始化为 git 仓库 |
| Claude Code 安装失败或需要付费 | 少一个适配器 | 优先保证 Codex + Cursor 可用 |
| Cursor CLI 需要 GUI 才能运行 | headless 模式不可用 | 确认 `CURSOR_API_KEY` 认证是否可绕过 GUI |
| stdin pipe 不支持长上下文 | 上下文注入失败 | 改用临时文件写入 prompt，通过文件路径传入 |
| 首 token 延迟 >10s | 用户体验差 | 前端增加 "Agent is starting..." 加载动画 |
| JSONL 事件格式不稳定（跨版本变化） | 解析器需要频繁更新 | 适配器内做容错解析，未知事件类型静默忽略 |

---

## 执行顺序

```
Day 1 上午: Step 1 (环境准备) + Step 2 (Codex 验证)
Day 1 下午: Step 3 (Claude 验证) + Step 4 (Cursor 验证)
Day 2 上午: Step 5 (接口定义) + Step 6 (基线数据)
Day 2 下午: 编写适配器原型 + demo.ts + 文档
```
