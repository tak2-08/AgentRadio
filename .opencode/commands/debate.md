---
description: "AgentRadio /debate — Team Leader가 토론을 트리거; Proxy가 주제/목표를 팀원들에게 개별 전달하고 사회자 역할을 하며, 팀원들이 이견(수용/부정/긍정/조건부부정/공격/방어)으로 주장하는 토론 프로토콜"
agent: build
---

Trigger a structured debate among team members, moderated by the Proxy (사회자).

Context: $ARGUMENTS = the debate topic + goal (or reference a memory path like
`sessions/<id>/debate-<n>.md`).

Flow (Proxy is the moderator / 사회자):

1. **Leader → Proxy**: leader writes the debate topic + goal to
   `sessions/<id>/debate-<n>.md` (or sends via radio).
2. **Proxy → Members (individual)**: proxy delivers the SAME topic+goal to EACH member
   individually (on a `debate-<id>-<n>` thread, or per-member memory note). Each member
   must respond with a STANCE:
   - `수용` (accept)        — agrees, with reasoning
   - `부정` (reject)        — disagrees, with reasoning
   - `긍정` (positive)      — strongly affirms / builds on it
   - `조건부부정` (conditional-reject) — rejects unless condition C is met
   - `공격` (attack)        — challenges another member's position directly
   - `방어` (defend)        — defends own/another's position
   Each stance includes evidence/reasoning, not just a label.
3. **Proxy moderates**: ensures every member posted; may run 1–2 more rounds so members
   respond to each other (attack/defend). Proxy does NOT take a side — it surfaces
   conflicts, clarifies, keeps it on-topic.
4. **Proxy → Leader**: when the debate settles (or times out), proxy writes
   `sessions/<id>/proxy-debate-<n>.md` = synthesis: positions per member, points of
   consensus, unresolved conflicts, and a recommendation.
5. **Leader decides**: reads the synthesis and MAY, on its own, assign NEW work
   (additional tasks/subtasks) to members based on the debate outcome, then the relay
   continues.

Applies to single-session parallel sub-agents too: the orchestrator acts as Proxy/moderator
and runs the same stance-based debate among its `task` workers.

Stance tags to use in messages: `STANCE:수용|부정|긍정|조건부부정|공격|방어`.
