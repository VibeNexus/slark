/**
 * CLI 适配器与 Runner 接口（从 spike/src/types.ts 迁移 + 精炼）
 */

// =============================================================================
// 统一事件类型
// =============================================================================

export type CLIEvent =
  | { type: 'session.started'; session_id: string; meta?: Record<string, unknown> }
  | { type: 'session.completed'; duration_ms?: number; usage?: UsageInfo }
  | { type: 'thinking.delta'; text: string }
  | { type: 'thinking.completed' }
  | { type: 'text.delta'; text: string }
  | { type: 'text.completed'; text: string }
  | {
      type: 'tool.started';
      call_id: string;
      tool: string;
      args: Record<string, unknown>;
    }
  | {
      type: 'tool.completed';
      call_id: string;
      tool: string;
      success: boolean;
      result?: string;
      exit_code?: number;
      duration_ms?: number;
    }
  | { type: 'error'; message: string; code?: string; recoverable?: boolean };

export interface UsageInfo {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  extra?: Record<string, unknown>;
}

// =============================================================================
// Adapter capabilities
// =============================================================================

export interface AdapterCapabilities {
  supportsTextDelta: boolean;
  supportsThinking: boolean;
  supportsWorkingDirectory: boolean;
  supportsEnvVars: boolean;
  supportsModelSelection: boolean;
  supportsReasoningEffort: boolean;
  supportsStdinContext: boolean;
}

// =============================================================================
// Adapter
// =============================================================================

export interface CLIAdapter {
  readonly name: string;
  readonly capabilities: AdapterCapabilities;

  checkInstallation(): Promise<{
    installed: boolean;
    version?: string;
    path?: string;
    error?: string;
  }>;

  buildCommand(params: BuildCommandParams): SpawnSpec;
  parseLine(line: string): CLIEvent[];
  getSupportedModels(): Promise<string[]>;
}

export interface BuildCommandParams {
  prompt: string;
  model?: string | null;
  reasoning?: string | null;
  workingDirectory?: string;
  envVars?: Record<string, string>;
  stdinContext?: string;
  permissive?: boolean;
}

export interface SpawnSpec {
  command: string;
  args: string[];
  env?: Record<string, string>;
  stdin?: string;
  cwd?: string;
}

// =============================================================================
// Runner
// =============================================================================

export interface RunnerOptions {
  timeoutMs?: number;
  onEvent?: (event: CLIEvent) => void;
  onRawLine?: (line: string) => void;
  onStderr?: (line: string) => void;
  /** 外部控制：在进行中可主动 abort */
  signal?: AbortSignal;
}

export interface RunnerResult {
  exitCode: number | null;
  fullText: string;
  events: CLIEvent[];
  duration_ms: number;
  timedOut: boolean;
  aborted: boolean;
}
