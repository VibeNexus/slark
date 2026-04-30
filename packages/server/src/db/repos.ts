/**
 * Repository 层 — 封装各表的 CRUD。
 *
 * 设计原则：
 *   - 每个函数返回强类型对象（@slark/shared 的 Channel / Agent / ChatMessage 等）
 *   - JSON 字段（metadata_json / env_vars_json）自动序列化 / 反序列化
 *   - 时间戳字段由 repo 填（调用方无需传 created_at）
 *   - 不做业务校验（业务校验在 service 层）
 */

import type { Database } from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type {
  Agent,
  AgentActivity,
  AgentRun,
  AgentRunStatus,
  ActivityType,
  Channel,
  ChatMessage,
  MessageMetadata,
  Project,
  Task,
  Workflow,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowSource,
} from '@slark/shared';
import type {
  ReasoningEffort,
  Runtime,
  SenderType,
  TaskStatus,
} from '@slark/shared';
import { ACTIVITY_RETENTION_PER_AGENT } from '@slark/shared';

const now = (): number => Date.now();

// =============================================================================
// Projects (v1.0)
// =============================================================================

interface ProjectRow {
  id: string;
  name: string;
  display_name: string | null;
  workspace_path: string;
  goal: string;
  team_rules: string | null;
  color: string | null;
  created_at: number;
}

function rowToProject(r: ProjectRow): Project {
  return { ...r };
}

export const projectRepo = {
  list(db: Database): Project[] {
    return (
      db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all() as ProjectRow[]
    ).map(rowToProject);
  },

  getById(db: Database, id: string): Project | null {
    const row = db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as ProjectRow | undefined;
    return row ? rowToProject(row) : null;
  },

  getByName(db: Database, name: string): Project | null {
    const row = db
      .prepare('SELECT * FROM projects WHERE name = ?')
      .get(name) as ProjectRow | undefined;
    return row ? rowToProject(row) : null;
  },

  create(
    db: Database,
    input: {
      id?: string;
      name: string;
      display_name?: string | null;
      workspace_path: string;
      goal: string;
      team_rules?: string | null;
      color?: string | null;
    },
  ): Project {
    const id = input.id ?? nanoid();
    const ts = now();
    db.prepare(
      `INSERT INTO projects (id, name, display_name, workspace_path, goal, team_rules, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.name,
      input.display_name ?? null,
      input.workspace_path,
      input.goal,
      input.team_rules ?? null,
      input.color ?? null,
      ts,
    );
    return {
      id,
      name: input.name,
      display_name: input.display_name ?? null,
      workspace_path: input.workspace_path,
      goal: input.goal,
      team_rules: input.team_rules ?? null,
      color: input.color ?? null,
      created_at: ts,
    };
  },

  update(
    db: Database,
    id: string,
    patch: Partial<Omit<Project, 'id' | 'created_at'>>,
  ): Project | null {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.name !== undefined) {
      fields.push('name = ?');
      values.push(patch.name);
    }
    if (patch.display_name !== undefined) {
      fields.push('display_name = ?');
      values.push(patch.display_name);
    }
    if (patch.workspace_path !== undefined) {
      fields.push('workspace_path = ?');
      values.push(patch.workspace_path);
    }
    if (patch.goal !== undefined) {
      fields.push('goal = ?');
      values.push(patch.goal);
    }
    if (patch.team_rules !== undefined) {
      fields.push('team_rules = ?');
      values.push(patch.team_rules);
    }
    if (patch.color !== undefined) {
      fields.push('color = ?');
      values.push(patch.color);
    }
    if (!fields.length) return this.getById(db, id);
    values.push(id);
    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(db, id);
  },

  remove(db: Database, id: string): void {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  },
};

// =============================================================================
// Channels
// =============================================================================

interface ChannelRow {
  id: string;
  name: string;
  description: string | null;
  type: 'channel' | 'dm';
  project_id: string | null;
  created_at: number;
}

function rowToChannel(r: ChannelRow): Channel {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    project_id: r.project_id,
    created_at: r.created_at,
  };
}

export const channelRepo = {
  list(db: Database): Channel[] {
    return (db.prepare('SELECT * FROM channels ORDER BY created_at ASC').all() as ChannelRow[])
      .map(rowToChannel);
  },

  /** v1.0 新增：按 Project 过滤列表 */
  listByProject(db: Database, projectId: string): Channel[] {
    return (
      db
        .prepare('SELECT * FROM channels WHERE project_id = ? ORDER BY created_at ASC')
        .all(projectId) as ChannelRow[]
    ).map(rowToChannel);
  },

  getById(db: Database, id: string): Channel | null {
    const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as ChannelRow | undefined;
    return row ? rowToChannel(row) : null;
  },

  create(
    db: Database,
    input: {
      id?: string;
      name: string;
      description?: string | null;
      type: 'channel' | 'dm';
      project_id?: string | null;
    },
  ): Channel {
    const id = input.id ?? nanoid();
    const ts = now();
    db.prepare(
      'INSERT INTO channels (id, name, description, type, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      input.name,
      input.description ?? null,
      input.type,
      input.project_id ?? null,
      ts,
    );
    return {
      id,
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      project_id: input.project_id ?? null,
      created_at: ts,
    };
  },

  update(
    db: Database,
    id: string,
    patch: { name?: string; description?: string | null },
  ): Channel | null {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.name !== undefined) {
      fields.push('name = ?');
      values.push(patch.name);
    }
    if (patch.description !== undefined) {
      fields.push('description = ?');
      values.push(patch.description);
    }
    if (!fields.length) return this.getById(db, id);
    values.push(id);
    db.prepare(`UPDATE channels SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(db, id);
  },

  remove(db: Database, id: string): void {
    db.prepare('DELETE FROM channels WHERE id = ?').run(id);
  },
};

// =============================================================================
// Agents
// =============================================================================

interface AgentRow {
  id: string;
  name: string;
  avatar: string | null;
  description: string | null;
  runtime: string;
  model: string | null;
  reasoning: string | null;
  env_vars_json: string | null;
  project_id: string | null;
  created_at: number;
}

function rowToAgent(r: AgentRow): Agent {
  return {
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    description: r.description,
    runtime: r.runtime as Runtime,
    model: r.model,
    reasoning: r.reasoning as ReasoningEffort | null,
    env_vars: r.env_vars_json ? (JSON.parse(r.env_vars_json) as Record<string, string>) : {},
    project_id: r.project_id,
    created_at: r.created_at,
  };
}

export const agentRepo = {
  list(db: Database): Agent[] {
    return (db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all() as AgentRow[])
      .map(rowToAgent);
  },

  getById(db: Database, id: string): Agent | null {
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
    return row ? rowToAgent(row) : null;
  },

  getByName(db: Database, name: string): Agent | null {
    const row = db.prepare('SELECT * FROM agents WHERE name = ?').get(name) as AgentRow | undefined;
    return row ? rowToAgent(row) : null;
  },

  create(
    db: Database,
    input: {
      id?: string;
      name: string;
      avatar?: string | null;
      description?: string | null;
      runtime: Runtime;
      model?: string | null;
      reasoning?: ReasoningEffort | null;
      env_vars?: Record<string, string>;
      project_id?: string | null;
    },
  ): Agent {
    const id = input.id ?? nanoid();
    const ts = now();
    db.prepare(
      `INSERT INTO agents (id, name, avatar, description, runtime, model, reasoning, env_vars_json, project_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.name,
      input.avatar ?? null,
      input.description ?? null,
      input.runtime,
      input.model ?? null,
      input.reasoning ?? null,
      input.env_vars ? JSON.stringify(input.env_vars) : null,
      input.project_id ?? null,
      ts,
    );
    return {
      id,
      name: input.name,
      avatar: input.avatar ?? null,
      description: input.description ?? null,
      runtime: input.runtime,
      model: input.model ?? null,
      reasoning: input.reasoning ?? null,
      env_vars: input.env_vars ?? {},
      project_id: input.project_id ?? null,
      created_at: ts,
    };
  },

  /** v1.0 新增：按 Project 过滤 */
  listByProject(db: Database, projectId: string): Agent[] {
    return (
      db
        .prepare('SELECT * FROM agents WHERE project_id = ? ORDER BY created_at ASC')
        .all(projectId) as AgentRow[]
    ).map(rowToAgent);
  },

  update(
    db: Database,
    id: string,
    patch: Partial<Omit<Agent, 'id' | 'created_at'>>,
  ): Agent | null {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.name !== undefined) {
      fields.push('name = ?');
      values.push(patch.name);
    }
    if (patch.avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(patch.avatar);
    }
    if (patch.description !== undefined) {
      fields.push('description = ?');
      values.push(patch.description);
    }
    if (patch.runtime !== undefined) {
      fields.push('runtime = ?');
      values.push(patch.runtime);
    }
    if (patch.model !== undefined) {
      fields.push('model = ?');
      values.push(patch.model);
    }
    if (patch.reasoning !== undefined) {
      fields.push('reasoning = ?');
      values.push(patch.reasoning);
    }
    if (patch.env_vars !== undefined) {
      fields.push('env_vars_json = ?');
      values.push(JSON.stringify(patch.env_vars));
    }
    // CP8.3：agents.status 字段已删除；状态从 agent_runs 派生
    if (!fields.length) return this.getById(db, id);
    values.push(id);
    db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(db, id);
  },

  remove(db: Database, id: string): void {
    db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  },

  // channel_agents 关联表
  listInChannel(db: Database, channelId: string): Agent[] {
    return (
      db
        .prepare(
          `SELECT a.* FROM agents a
           JOIN channel_agents ca ON ca.agent_id = a.id
           WHERE ca.channel_id = ?
           ORDER BY a.created_at ASC`,
        )
        .all(channelId) as AgentRow[]
    ).map(rowToAgent);
  },

  addToChannel(db: Database, channelId: string, agentId: string): void {
    db.prepare(
      'INSERT OR IGNORE INTO channel_agents (channel_id, agent_id) VALUES (?, ?)',
    ).run(channelId, agentId);
  },

  removeFromChannel(db: Database, channelId: string, agentId: string): void {
    db.prepare('DELETE FROM channel_agents WHERE channel_id = ? AND agent_id = ?').run(
      channelId,
      agentId,
    );
  },
};

// =============================================================================
// Messages
// =============================================================================

interface MessageRow {
  id: string;
  channel_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  metadata_json: string | null;
  parent_id: string | null;
  reply_count: number;
  created_at: number;
}

function rowToMessage(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    channel_id: r.channel_id,
    sender_type: r.sender_type as SenderType,
    sender_id: r.sender_id,
    content: r.content,
    metadata: r.metadata_json ? (JSON.parse(r.metadata_json) as MessageMetadata) : null,
    parent_id: r.parent_id,
    reply_count: r.reply_count,
    created_at: r.created_at,
  };
}

export const messageRepo = {
  /** 查询频道主线消息（parent_id IS NULL），按时间倒序 */
  listChannelMain(
    db: Database,
    channelId: string,
    limit = 50,
    before?: string,
  ): ChatMessage[] {
    const rows = before
      ? (db
          .prepare(
            `SELECT * FROM messages
             WHERE channel_id = ? AND parent_id IS NULL
               AND created_at < (SELECT created_at FROM messages WHERE id = ?)
             ORDER BY created_at DESC LIMIT ?`,
          )
          .all(channelId, before, limit) as MessageRow[])
      : (db
          .prepare(
            `SELECT * FROM messages
             WHERE channel_id = ? AND parent_id IS NULL
             ORDER BY created_at DESC LIMIT ?`,
          )
          .all(channelId, limit) as MessageRow[]);
    return rows.map(rowToMessage).reverse();
  },

  /** 查询 Thread 内所有消息（包括根消息），按时间正序 */
  listThread(db: Database, rootMessageId: string): ChatMessage[] {
    const root = db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(rootMessageId) as MessageRow | undefined;
    if (!root) return [];
    const replies = db
      .prepare('SELECT * FROM messages WHERE parent_id = ? ORDER BY created_at ASC')
      .all(rootMessageId) as MessageRow[];
    return [rowToMessage(root), ...replies.map(rowToMessage)];
  },

  getById(db: Database, id: string): ChatMessage | null {
    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
    return row ? rowToMessage(row) : null;
  },

  create(
    db: Database,
    input: {
      id?: string;
      channel_id: string;
      sender_type: SenderType;
      sender_id: string | null;
      content: string;
      metadata?: MessageMetadata | null;
      parent_id?: string | null;
    },
  ): ChatMessage {
    const id = input.id ?? nanoid();
    const ts = now();

    db.prepare(
      `INSERT INTO messages (id, channel_id, sender_type, sender_id, content, metadata_json, parent_id, reply_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    ).run(
      id,
      input.channel_id,
      input.sender_type,
      input.sender_id,
      input.content,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.parent_id ?? null,
      ts,
    );

    // 如果有 parent，更新父消息 reply_count
    if (input.parent_id) {
      db.prepare('UPDATE messages SET reply_count = reply_count + 1 WHERE id = ?').run(
        input.parent_id,
      );
    }

    return {
      id,
      channel_id: input.channel_id,
      sender_type: input.sender_type,
      sender_id: input.sender_id,
      content: input.content,
      metadata: input.metadata ?? null,
      parent_id: input.parent_id ?? null,
      reply_count: 0,
      created_at: ts,
    };
  },

  updateContent(
    db: Database,
    id: string,
    content: string,
    metadata?: MessageMetadata | null,
  ): void {
    db.prepare('UPDATE messages SET content = ?, metadata_json = ? WHERE id = ?').run(
      content,
      metadata !== undefined
        ? metadata === null
          ? null
          : JSON.stringify(metadata)
        : undefined,
      id,
    );
  },
};

// =============================================================================
// Tasks
// =============================================================================

interface TaskRow {
  id: number;
  channel_id: string;
  title: string;
  status: string;
  assignee_agent_id: string | null;
  created_by: string;
  source_message_id: string | null;
  created_at: number;
  updated_at: number;
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    channel_id: r.channel_id,
    title: r.title,
    status: r.status as TaskStatus,
    assignee_agent_id: r.assignee_agent_id,
    created_by: r.created_by,
    source_message_id: r.source_message_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const taskRepo = {
  list(
    db: Database,
    filter: { channel_id?: string; status?: TaskStatus } = {},
  ): Task[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.channel_id) {
      where.push('channel_id = ?');
      params.push(filter.channel_id);
    }
    if (filter.status) {
      where.push('status = ?');
      params.push(filter.status);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    return (
      db.prepare(`SELECT * FROM tasks ${whereSql} ORDER BY id ASC`).all(...params) as TaskRow[]
    ).map(rowToTask);
  },

  getById(db: Database, id: number): Task | null {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    return row ? rowToTask(row) : null;
  },

  create(
    db: Database,
    input: {
      channel_id: string;
      title: string;
      assignee_agent_id?: string | null;
      created_by: string;
      source_message_id?: string | null;
    },
  ): Task {
    const ts = now();
    const result = db
      .prepare(
        `INSERT INTO tasks (channel_id, title, status, assignee_agent_id, created_by, source_message_id, created_at, updated_at)
         VALUES (?, ?, 'todo', ?, ?, ?, ?, ?)`,
      )
      .run(
        input.channel_id,
        input.title,
        input.assignee_agent_id ?? null,
        input.created_by,
        input.source_message_id ?? null,
        ts,
        ts,
      );
    const id = Number(result.lastInsertRowid);
    return {
      id,
      channel_id: input.channel_id,
      title: input.title,
      status: 'todo',
      assignee_agent_id: input.assignee_agent_id ?? null,
      created_by: input.created_by,
      source_message_id: input.source_message_id ?? null,
      created_at: ts,
      updated_at: ts,
    };
  },

  update(
    db: Database,
    id: number,
    patch: { title?: string; status?: TaskStatus; assignee_agent_id?: string | null },
  ): Task | null {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.title !== undefined) {
      fields.push('title = ?');
      values.push(patch.title);
    }
    if (patch.status !== undefined) {
      fields.push('status = ?');
      values.push(patch.status);
    }
    if (patch.assignee_agent_id !== undefined) {
      fields.push('assignee_agent_id = ?');
      values.push(patch.assignee_agent_id);
    }
    if (!fields.length) return this.getById(db, id);
    fields.push('updated_at = ?');
    values.push(now());
    values.push(id);
    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(db, id);
  },

  remove(db: Database, id: number): void {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  },
};

// =============================================================================
// Agent Activity
// =============================================================================

interface ActivityRow {
  id: number;
  agent_id: string;
  channel_id: string | null;
  type: string;
  detail: string | null;
  created_at: number;
}

function rowToActivity(r: ActivityRow): AgentActivity {
  return {
    id: r.id,
    agent_id: r.agent_id,
    channel_id: r.channel_id ?? null,
    type: r.type as ActivityType,
    detail: r.detail,
    created_at: r.created_at,
  };
}

export const activityRepo = {
  list(
    db: Database,
    agentId: string,
    limit = 50,
    before?: number,
    channelId?: string,
  ): AgentActivity[] {
    const where: string[] = ['agent_id = ?'];
    const params: unknown[] = [agentId];
    if (before !== undefined) {
      where.push('id < ?');
      params.push(before);
    }
    if (channelId) {
      where.push('channel_id = ?');
      params.push(channelId);
    }
    params.push(limit);
    const rows = db
      .prepare(
        `SELECT * FROM agent_activity
         WHERE ${where.join(' AND ')}
         ORDER BY id DESC LIMIT ?`,
      )
      .all(...params) as ActivityRow[];
    return rows.map(rowToActivity);
  },

  append(
    db: Database,
    input: {
      agent_id: string;
      type: ActivityType;
      detail?: string | null;
      channel_id?: string | null;
    },
  ): AgentActivity {
    const ts = now();
    const result = db
      .prepare(
        'INSERT INTO agent_activity (agent_id, channel_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        input.agent_id,
        input.channel_id ?? null,
        input.type,
        input.detail ?? null,
        ts,
      );
    const id = Number(result.lastInsertRowid);

    // 保留策略（D-3）：超过 500 条删除最旧（全 channel 合并）
    db.prepare(
      `DELETE FROM agent_activity
       WHERE agent_id = ? AND id NOT IN (
         SELECT id FROM agent_activity WHERE agent_id = ? ORDER BY id DESC LIMIT ?
       )`,
    ).run(input.agent_id, input.agent_id, ACTIVITY_RETENTION_PER_AGENT);

    return {
      id,
      agent_id: input.agent_id,
      channel_id: input.channel_id ?? null,
      type: input.type,
      detail: input.detail ?? null,
      created_at: ts,
    };
  },
};

// =============================================================================
// Agent Runs (v1.0 新增，对齐 D-1 / D-18)
//
// 替代 v0 的 agents.status 单值字段。每次 spawn 开一个 run，结束时更新 ended_at。
// 查询 Agent 在指定 channel 的当前状态：
//   SELECT status FROM agent_runs WHERE agent_id=? AND channel_id=? AND ended_at IS NULL
//   ORDER BY started_at DESC LIMIT 1
// =============================================================================

interface AgentRunRow {
  id: number;
  agent_id: string;
  channel_id: string;
  status: string;
  started_at: number;
  ended_at: number | null;
  error_msg: string | null;
}

function rowToAgentRun(r: AgentRunRow): AgentRun {
  return {
    id: r.id,
    agent_id: r.agent_id,
    channel_id: r.channel_id,
    status: r.status as AgentRunStatus,
    started_at: r.started_at,
    ended_at: r.ended_at,
    error_msg: r.error_msg,
  };
}

export const agentRunRepo = {
  /** 开启一个 run，返回 id */
  start(
    db: Database,
    input: { agent_id: string; channel_id: string; status: AgentRunStatus },
  ): AgentRun {
    const ts = now();
    const result = db
      .prepare(
        `INSERT INTO agent_runs (agent_id, channel_id, status, started_at, ended_at, error_msg)
         VALUES (?, ?, ?, ?, NULL, NULL)`,
      )
      .run(input.agent_id, input.channel_id, input.status, ts);
    return {
      id: Number(result.lastInsertRowid),
      agent_id: input.agent_id,
      channel_id: input.channel_id,
      status: input.status,
      started_at: ts,
      ended_at: null,
      error_msg: null,
    };
  },

  /** 更新活跃 run 的 status（如 thinking → working） */
  updateStatus(db: Database, id: number, status: AgentRunStatus): void {
    db.prepare('UPDATE agent_runs SET status = ? WHERE id = ?').run(status, id);
  },

  /** 结束一个 run（设置 ended_at） */
  end(db: Database, id: number, errorMsg?: string | null): void {
    const ts = now();
    db.prepare(
      'UPDATE agent_runs SET ended_at = ?, error_msg = ? WHERE id = ?',
    ).run(ts, errorMsg ?? null, id);
  },

  /** 查找 Agent 在指定 channel 的当前活跃 run（若有） */
  getActive(db: Database, agentId: string, channelId: string): AgentRun | null {
    const row = db
      .prepare(
        `SELECT * FROM agent_runs
         WHERE agent_id = ? AND channel_id = ? AND ended_at IS NULL
         ORDER BY started_at DESC LIMIT 1`,
      )
      .get(agentId, channelId) as AgentRunRow | undefined;
    return row ? rowToAgentRun(row) : null;
  },

  /** 列出 Agent 所有活跃 run（跨 channel）—— Sidebar 判断"任意 channel 在跑"用 */
  listActiveForAgent(db: Database, agentId: string): AgentRun[] {
    const rows = db
      .prepare(
        `SELECT * FROM agent_runs
         WHERE agent_id = ? AND ended_at IS NULL
         ORDER BY started_at DESC`,
      )
      .all(agentId) as AgentRunRow[];
    return rows.map(rowToAgentRun);
  },

  /** 列出 Channel 所有活跃 run（Stop All 用） */
  listActiveInChannel(db: Database, channelId: string): AgentRun[] {
    const rows = db
      .prepare(
        `SELECT * FROM agent_runs
         WHERE channel_id = ? AND ended_at IS NULL
         ORDER BY started_at DESC`,
      )
      .all(channelId) as AgentRunRow[];
    return rows.map(rowToAgentRun);
  },
};

// =============================================================================
// Workflows (Sprint 2 / D-16)
// =============================================================================

interface WorkflowRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  trigger_command: string;
  definition_yaml: string;
  source: string;
  created_at: number;
  updated_at: number;
}

function rowToWorkflow(r: WorkflowRow): Workflow {
  return {
    id: r.id,
    project_id: r.project_id,
    name: r.name,
    description: r.description,
    trigger_command: r.trigger_command,
    definition_yaml: r.definition_yaml,
    source: r.source as WorkflowSource,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const workflowRepo = {
  list(db: Database): Workflow[] {
    return (db.prepare('SELECT * FROM workflows ORDER BY created_at ASC').all() as WorkflowRow[])
      .map(rowToWorkflow);
  },

  listByProject(db: Database, projectId: string): Workflow[] {
    return (
      db
        .prepare('SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at ASC')
        .all(projectId) as WorkflowRow[]
    ).map(rowToWorkflow);
  },

  getById(db: Database, id: string): Workflow | null {
    const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as
      | WorkflowRow
      | undefined;
    return row ? rowToWorkflow(row) : null;
  },

  /** 按 project + trigger 查（用于 MessageRouter 命令分发）*/
  getByTrigger(db: Database, projectId: string, triggerCommand: string): Workflow | null {
    const row = db
      .prepare('SELECT * FROM workflows WHERE project_id = ? AND trigger_command = ?')
      .get(projectId, triggerCommand) as WorkflowRow | undefined;
    return row ? rowToWorkflow(row) : null;
  },

  create(
    db: Database,
    input: {
      id?: string;
      project_id: string;
      name: string;
      description?: string | null;
      trigger_command: string;
      definition_yaml: string;
      source?: WorkflowSource;
    },
  ): Workflow {
    const id = input.id ?? nanoid();
    const ts = now();
    db.prepare(
      `INSERT INTO workflows (id, project_id, name, description, trigger_command, definition_yaml, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.project_id,
      input.name,
      input.description ?? null,
      input.trigger_command,
      input.definition_yaml,
      input.source ?? 'user',
      ts,
      ts,
    );
    const wf = this.getById(db, id);
    if (!wf) throw new Error(`workflow ${id} insert failed`);
    return wf;
  },

  update(
    db: Database,
    id: string,
    patch: Partial<{
      name: string;
      description: string | null;
      trigger_command: string;
      definition_yaml: string;
    }>,
  ): Workflow | null {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.name !== undefined) {
      fields.push('name = ?');
      values.push(patch.name);
    }
    if (patch.description !== undefined) {
      fields.push('description = ?');
      values.push(patch.description);
    }
    if (patch.trigger_command !== undefined) {
      fields.push('trigger_command = ?');
      values.push(patch.trigger_command);
    }
    if (patch.definition_yaml !== undefined) {
      fields.push('definition_yaml = ?');
      values.push(patch.definition_yaml);
    }
    if (!fields.length) return this.getById(db, id);
    fields.push('updated_at = ?');
    values.push(now());
    values.push(id);
    db.prepare(`UPDATE workflows SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(db, id);
  },

  remove(db: Database, id: string): void {
    db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
  },
};

// =============================================================================
// Workflow Runs (Sprint 2)
// =============================================================================

interface WorkflowRunRow {
  id: number;
  workflow_id: string;
  channel_id: string;
  thread_id: string | null;
  status: string;
  current_step: string | null;
  started_by: string;
  started_at: number;
  ended_at: number | null;
  state_json: string;
}

function rowToWorkflowRun(r: WorkflowRunRow): WorkflowRun {
  return {
    id: r.id,
    workflow_id: r.workflow_id,
    channel_id: r.channel_id,
    thread_id: r.thread_id,
    status: r.status as WorkflowRunStatus,
    current_step: r.current_step,
    started_by: r.started_by,
    started_at: r.started_at,
    ended_at: r.ended_at,
    state_json: r.state_json,
  };
}

export const workflowRunRepo = {
  getById(db: Database, id: number): WorkflowRun | null {
    const row = db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(id) as
      | WorkflowRunRow
      | undefined;
    return row ? rowToWorkflowRun(row) : null;
  },

  listByWorkflow(db: Database, workflowId: string, limit = 50): WorkflowRun[] {
    const rows = db
      .prepare(
        'SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?',
      )
      .all(workflowId, limit) as WorkflowRunRow[];
    return rows.map(rowToWorkflowRun);
  },

  listByChannel(db: Database, channelId: string, limit = 50): WorkflowRun[] {
    const rows = db
      .prepare(
        'SELECT * FROM workflow_runs WHERE channel_id = ? ORDER BY started_at DESC LIMIT ?',
      )
      .all(channelId, limit) as WorkflowRunRow[];
    return rows.map(rowToWorkflowRun);
  },

  /** 找 channel 当前活跃 run（running / awaiting_approval），可选按 thread 过滤 */
  getActive(
    db: Database,
    channelId: string,
    threadId?: string | null,
  ): WorkflowRun | null {
    const sql = threadId
      ? `SELECT * FROM workflow_runs
         WHERE channel_id = ? AND thread_id = ?
         AND status IN ('running','awaiting_approval')
         ORDER BY started_at DESC LIMIT 1`
      : `SELECT * FROM workflow_runs
         WHERE channel_id = ? AND status IN ('running','awaiting_approval')
         ORDER BY started_at DESC LIMIT 1`;
    const row = (
      threadId
        ? db.prepare(sql).get(channelId, threadId)
        : db.prepare(sql).get(channelId)
    ) as WorkflowRunRow | undefined;
    return row ? rowToWorkflowRun(row) : null;
  },

  create(
    db: Database,
    input: {
      workflow_id: string;
      channel_id: string;
      thread_id?: string | null;
      started_by: string;
      current_step: string;
      state_json?: string;
    },
  ): WorkflowRun {
    const ts = now();
    const result = db
      .prepare(
        `INSERT INTO workflow_runs
         (workflow_id, channel_id, thread_id, status, current_step, started_by, started_at, ended_at, state_json)
         VALUES (?, ?, ?, 'running', ?, ?, ?, NULL, ?)`,
      )
      .run(
        input.workflow_id,
        input.channel_id,
        input.thread_id ?? null,
        input.current_step,
        input.started_by,
        ts,
        input.state_json ?? '{}',
      );
    const run = this.getById(db, Number(result.lastInsertRowid));
    if (!run) throw new Error('workflow_run insert failed');
    return run;
  },

  /** 更新 status / current_step / state_json（部分） */
  update(
    db: Database,
    id: number,
    patch: Partial<{
      status: WorkflowRunStatus;
      current_step: string | null;
      state_json: string;
      thread_id: string | null;
      ended: boolean;
    }>,
  ): WorkflowRun | null {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.status !== undefined) {
      fields.push('status = ?');
      values.push(patch.status);
    }
    if (patch.current_step !== undefined) {
      fields.push('current_step = ?');
      values.push(patch.current_step);
    }
    if (patch.state_json !== undefined) {
      fields.push('state_json = ?');
      values.push(patch.state_json);
    }
    if (patch.thread_id !== undefined) {
      fields.push('thread_id = ?');
      values.push(patch.thread_id);
    }
    if (patch.ended) {
      fields.push('ended_at = ?');
      values.push(now());
    }
    if (!fields.length) return this.getById(db, id);
    values.push(id);
    db.prepare(`UPDATE workflow_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(db, id);
  },
};
