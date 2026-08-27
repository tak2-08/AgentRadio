---
description: "Debate — when the Team Leader triggers it, the Proxy delivers the topic/goal to each member individually and moderates; members post a stance (accept/reject/positive/conditional-reject/attack/defend)"
agent: build
---

When the Team Leader triggers a debate, the Proxy (Proxy Session) acts as moderator for a
structured debate among members.

1. **leader → proxy**: write the debate topic + goal to `sessions/<task-id>/debate-<n>.md`
   (or radio).
2. **proxy → members (individual)**: the Proxy delivers the topic + goal to EACH member
   individually. Every member MUST post exactly one **stance**: `accept` · `reject` ·
   `positive` · `conditional-reject` · `attack` · `defend` — with reasoning/evidence.
3. **proxy moderator**: ensure all responded, allow 1–2 attack/defend rounds, surface
   conflicts, keep on-topic (no side-taking).
4. **proxy → leader**: write `sessions/<task-id>/proxy-debate-<n>.md` = synthesis (positions,
   consensus, unresolved conflicts, recommendation) and surface to the leader.
5. **leader decision**: read the synthesis and MAY assign new work; relay continues.

Stance tag: `STANCE:accept|reject|positive|conditional-reject|attack|defend`
(Korean canonical labels: 수용/부정/긍정/조건부부정/공격/방어). Same flow works for
single-session parallel sub-agents (orchestrator = leader/proxy, `task` workers = members).
