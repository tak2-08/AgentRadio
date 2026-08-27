---
description: "Cross-session radio agent collaboration — how different sessions/environments cooperate (radio bus + memory store)"
agent: build
---

Guide for collaborating across different sessions (processes/terminals/environments).

**Two transport layers**
- **radio** = real-time passive bus within one session. Auto-shared when `RADIO_ROOT` is the same.
- **memory** = durable coordination bus across sessions. Uses the GitHub repo `tak2-08/memory`.
  Write directives/opinions/state to `sessions/<task-id>/<role>.md`; other sessions recall via
  `memory_search` / `memory_get`.

**Roles**: Team Leader session / Proxy session (relay/synthesis/opinion) / Team Member
sub-session (parallel agent).
**Relay flow**: `user → leader → proxy → member`, `proxy → member → proxy → ...`,
`leader → proxy → member → proxy → leader`.
**Debate**: `/debate` — Proxy moderates, members post stances, Proxy synthesizes to leader →
leader may assign new work.

Multi-session = new terminals/processes; single-session = `task` sub-agents. Same model.
See `skills/agent-radio/SKILL.md` "Collaboration Architecture" for details.
