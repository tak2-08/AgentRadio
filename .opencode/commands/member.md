---
description: "Team Member session invocation — output the Team Member (parallel agent) launch prompt"
agent: build
---

When the Team Leader/Proxy (or boss) wants to spin up a Member session, output the following
launch prompt for that session.

**Team Member Session prompt**:
- Role: parallel agent. Read `sessions/<task-id>/leader-directive.md` (and proxy instructions)
  from `tak2-08/memory`, perform the assigned subtask, write results to
  `sessions/<task-id>/member-<id>.md`.
- During debate: post a stance — `STANCE:accept|reject|positive|conditional-reject|attack|defend`
  (with evidence).
- Template: `skills/agent-radio/prompts/member-CLAUDE.md.template`

Multi-session: new terminal `opencode`, paste prompt. Single-session: spawn via `task` tool.
