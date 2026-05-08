/**
 * Projects Service — 聚合 globalProjectsStore + per-workspace project.json 为 Project 实体
 *
 * 上层 routes / system-agents 通过本服务拿到完整的 `Project`（含 workspace_path）。
 * 不再直接读 SQL `projects` 表（D-21）。
 */

import { existsSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { Project } from '@slark/shared';
import {
  projectMetaPath,
  projectSlarkDir,
  readProjectMeta,
  updateProjectMeta,
  writeProjectMeta,
} from './project-meta.js';
import { projectsStore } from './projects-store.js';

/** 把 (recent entry + project.json) 拼成完整 Project 对象 */
function compose(workspacePath: string): Project | null {
  const meta = readProjectMeta(workspacePath);
  if (!meta) return null;
  return {
    id: meta.id,
    name: meta.name,
    display_name: meta.display_name,
    workspace_path: workspacePath,
    goal: meta.goal,
    team_rules: meta.team_rules,
    color: meta.color,
    created_at: meta.created_at,
  };
}

export const projectsService = {
  list(): Project[] {
    return projectsStore
      .list()
      .map((entry) => compose(entry.path))
      .filter((p): p is Project => p !== null);
  },

  getById(id: string): Project | null {
    const entry = projectsStore.getById(id);
    if (!entry) return null;
    return compose(entry.path);
  },

  getByName(name: string): Project | null {
    return this.list().find((p) => p.name === name) ?? null;
  },

  getByPath(workspacePath: string): Project | null {
    return compose(workspacePath);
  },

  /**
   * 打开 / 创建 project：
   *   - 若 `<path>/.slark/project.json` 已存在 → 读出来 + 更新 recent
   *   - 否则用 input 初始化（创建 .slark/ 目录 + 写 project.json）+ 加入 recent
   */
  open(input: {
    workspace_path: string;
    name?: string;
    display_name?: string | null;
    goal?: string;
    team_rules?: string | null;
    color?: string | null;
  }): { project: Project; isNew: boolean } {
    const workspacePath = path.resolve(input.workspace_path);
    const existing = readProjectMeta(workspacePath);

    if (existing) {
      // 复用已有 project.json
      projectsStore.upsert({ id: existing.id, path: workspacePath });
      const project = compose(workspacePath);
      if (!project) throw new Error('failed to compose project after read');
      return { project, isNew: false };
    }

    // 新建
    if (!input.name) {
      throw new Error('name is required when creating a new project');
    }
    const id = nanoid();
    const meta = writeProjectMeta(workspacePath, {
      id,
      name: input.name,
      display_name: input.display_name ?? null,
      goal: input.goal ?? '',
      team_rules: input.team_rules ?? null,
      color: input.color ?? null,
      created_at: Date.now(),
    });
    projectsStore.upsert({ id: meta.id, path: workspacePath });

    const project: Project = {
      id: meta.id,
      name: meta.name,
      display_name: meta.display_name,
      workspace_path: workspacePath,
      goal: meta.goal,
      team_rules: meta.team_rules,
      color: meta.color,
      created_at: meta.created_at,
    };
    return { project, isNew: true };
  },

  /** 更新 project meta（写 project.json）*/
  update(
    id: string,
    patch: Partial<Omit<Project, 'id' | 'created_at' | 'workspace_path'>>,
  ): Project | null {
    const entry = projectsStore.getById(id);
    if (!entry) return null;
    const updated = updateProjectMeta(entry.path, {
      name: patch.name,
      display_name: patch.display_name ?? undefined,
      goal: patch.goal,
      team_rules: patch.team_rules ?? undefined,
      color: patch.color ?? undefined,
    });
    if (!updated) return null;
    return compose(entry.path);
  },

  /** Close：仅从 recent 移除 + close db handle；磁盘文件保留 */
  close(id: string): boolean {
    const entry = projectsStore.getById(id);
    if (!entry) return false;
    projectsStore.remove(id);
    return true;
  },

  /** Delete .slark/：彻底删除项目存储（rm -rf workspace/.slark/）*/
  deleteStorage(id: string): boolean {
    const entry = projectsStore.getById(id);
    if (!entry) return false;
    const slarkDir = projectSlarkDir(entry.path);
    if (existsSync(slarkDir)) {
      rmSync(slarkDir, { recursive: true, force: true });
    }
    projectsStore.remove(id);
    return true;
  },

  /** 写 .gitignore（默认排 slark.db / observations/）*/
  ensureGitignore(workspacePath: string): void {
    const dir = projectSlarkDir(workspacePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const file = path.join(dir, '.gitignore');
    if (existsSync(file)) return;
    const content = `# Slark per-project storage
# 个人对话历史 / 实时状态：不入 git
slark.db
slark.db-wal
slark.db-shm
observations/

# 团队共享：建议入 git
# project.json
# knowledge/
`;
    writeFileSync(file, content, 'utf-8');
  },

  /**
   * 写 README.md（介绍 .slark/ 目录结构 + 团队共享建议）
   * 已存在则不覆盖，便于用户自己加注释。
   */
  ensureReadme(workspacePath: string): void {
    const dir = projectSlarkDir(workspacePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'README.md');
    if (existsSync(file)) return;
    const content = `# .slark/ — Slark Project Metadata

This directory stores everything Slark knows about this project. It travels
with the code repository.

## Files

| File | Purpose | Git policy |
|------|---------|------------|
| \`project.json\` | Project metadata (id / name / display_name / goal / team_rules / color) | **commit** |
| \`slark.db\` | SQLite: channels / agents / messages / tasks / workflow_runs / agent_runs / agent_skills / agent_observations / agent_feedback / project_onboarding | **ignore** (per-user) |
| \`slark.db-wal\`, \`slark.db-shm\` | SQLite WAL/SHM | **ignore** |
| \`knowledge/decisions.jsonl\` | Reviewed team decisions (one JSON per line) | **commit** |
| \`knowledge/lessons.jsonl\` | Reviewed team lessons (one JSON per line) | **commit** |
| \`observations/\` | Raw evaluator notes (only for advanced workflows) | **ignore** |

## How to share with teammates

1. Commit \`.slark/project.json\` and \`.slark/knowledge/\` to git.
2. Teammates clone the repo, run Slark, click "Open project folder" and pick
   the same path — Slark will reuse the existing \`project.json\` and pull in
   shared knowledge automatically.
3. Each teammate has their own \`slark.db\` (chat history, agent states), so
   personal interactions never collide.

> Generated by Slark on first open. Free to edit / extend; Slark only writes
> when explicitly asked.
`;
    writeFileSync(file, content, 'utf-8');
  },
};

export { projectMetaPath };
