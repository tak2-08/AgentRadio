---
description: "Proxy session invocation — output the Proxy Session launch prompt (relay/synthesis/moderator hub between Team Leader and Members)"
agent: build
---

When the Team Leader (or boss) wants to spin up a Proxy session, output the following launch
prompt for that session.

**Proxy Session prompt**:
- Role: relay/synthesis/opinion hub between Team Leader and Members (↓↑).
- Read `sessions/<task-id>/leader-directive.md` from the memory store `tak2-08/memory` and
  coordinate member work.
- Consolidate member results into `sessions/<task-id>/proxy-synthesis.md`.
- During debate: deliver topic to each member individually, gather stances
  (accept/reject/positive/conditional-reject/attack/defend), write
  `sessions/<task-id>/proxy-debate-<n>.md` synthesis to the leader.
- Template: `skills/agent-radio/prompts/proxy-CLAUDE.md.template`

Multi-session: new terminal `opencode`, paste prompt. Single-session: spawn via `task` tool.
