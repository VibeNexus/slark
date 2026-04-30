/**
 * 内置 Workflow 模板（Sprint 2 CP2）
 *
 * 3 个模板，对应 PLAN.md Sprint 2 §2.2：
 *   - feature-development: design → await_approval → implement → review → done
 *   - bug-fix:             reproduce → fix → verify → done
 *   - research:            gather → summarize → done
 *
 * 模板的 owner 使用约定俗成的 Agent 名（@Architect / @Dev / @Reviewer），
 * 与 Team Architect 兜底三件套（D-19）一致。当 Project 内不存在同名 Agent 时，
 * Runner 会发出 system error，提示用户调整模板或团队。
 *
 * 模板首次创建时通过 importBuiltinsForProject() 自动 seed 到 Project；
 * 后续用户可通过 PATCH /api/workflows/:id 修改 YAML，不会被重新覆盖。
 */

export interface BuiltinTemplate {
  /** trigger_command（同 project 内唯一）*/
  command: string;
  name: string;
  description: string;
  yaml: string;
}

const FEATURE_DEVELOPMENT_YAML = `version: "1"
name: feature-development
description: Three-stage feature delivery — Architect designs, you approve, Dev implements, Reviewer reviews.

trigger:
  command: "/new-feature"

steps:
  - id: design
    owner: "@Architect"
    description: "Produce a design proposal for the requested feature."
    on_complete: await_approval

  - id: await_approval
    owner: "local-user"
    action: approve_or_reject
    description: "Approve the design or reject with feedback to redo."
    on_approve: implement
    on_reject: design

  - id: implement
    owner: "@Dev"
    input: design
    description: "Implement the approved design."
    on_complete: review

  - id: review
    owner: "@Reviewer"
    action: approve_or_reject
    input: implement
    description: "Review the implementation; reject sends it back to implement."
    on_approve: done
    on_reject: implement

  - id: done
    action: close_thread
    description: "Workflow complete."
`;

const BUG_FIX_YAML = `version: "1"
name: bug-fix
description: Three-stage bug fix — reproduce, fix, verify.

trigger:
  command: "/bug-fix"

steps:
  - id: reproduce
    owner: "@Dev"
    description: "Reproduce the bug and document the root cause."
    on_complete: fix

  - id: fix
    owner: "@Dev"
    input: reproduce
    description: "Apply a fix and document the change."
    on_complete: verify

  - id: verify
    owner: "@Reviewer"
    action: approve_or_reject
    input: fix
    description: "Verify the fix; reject sends it back to fix."
    on_approve: done
    on_reject: fix

  - id: done
    action: close_thread
    description: "Workflow complete."
`;

const RESEARCH_YAML = `version: "1"
name: research
description: Lightweight research — gather information then summarize.

trigger:
  command: "/research"

steps:
  - id: gather
    owner: "@Architect"
    description: "Gather relevant information about the topic."
    on_complete: summarize

  - id: summarize
    owner: "@Architect"
    input: gather
    description: "Summarize findings into actionable notes."
    on_complete: done

  - id: done
    action: close_thread
    description: "Workflow complete."
`;

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    command: '/new-feature',
    name: 'feature-development',
    description:
      'Three-stage feature delivery — Architect designs, you approve, Dev implements, Reviewer reviews.',
    yaml: FEATURE_DEVELOPMENT_YAML,
  },
  {
    command: '/bug-fix',
    name: 'bug-fix',
    description: 'Three-stage bug fix — reproduce, fix, verify.',
    yaml: BUG_FIX_YAML,
  },
  {
    command: '/research',
    name: 'research',
    description: 'Lightweight research — gather information then summarize.',
    yaml: RESEARCH_YAML,
  },
];
