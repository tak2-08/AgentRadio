---
name: agent-radio
description: Run long-horizon multi-agent collaboration with passive awareness (AgentRadio method). Use when coordinating several coding agents (or subagents/sessions) on one task — dividing work, negotiating a plan, sharing discoveries while working instead of blocking to listen, cross-reviewing results, and assembling a final submission. Triggers: multi-agent, team of agents, divide work, wait_for_mention, radio, worklog, five-phase protocol.
---

# AgentRadio — Passive Awareness for Multi-Agent Collaboration

A portable implementation of the protocol from
[AgentRadio](https://github.com/Coral-Protocol/AgentRadio)
(paper: [arXiv:2607.28430](https://arxiv.org/abs/2607.28430)): agents keep working **while**
they listen, because receiving messages runs as a background task instead of stealing a turn.
On SWE-Atlas QnA this single change took four agents from 51.6% → 62.1% task accuracy.

This folder needs no Docker, JDK, or message server. The "radio" is an append-only JSONL
directory driven by `scripts/radio.sh` (python3 stdlib only).

## When to reach for this

- One task, several agents/subagents/sessions that would otherwise duplicate work or
  discover the same bug twice.
- Long horizon (hours), where a discovery made at minute 10 should reach whoever needs it
  at minute 11 — not at the next phase boundary.
- You are the orchestrator/assembler, or you are ONE peer among several agent processes.

## The three primitives

```bash
scripts/radio.sh init                                  # once, per team session
scripts/radio.sh send <thread> <me> "<content>" [--mentions agent-2,agent-3]
scripts/radio.sh wait <me> [--max-wait 60]             # the watcher
scripts/radio.sh read                                  # full state dump
```

Set `RADIO_ROOT=/some/dir` so every teammate points at the same bus (default `.radio/`,
outside any repo you plan to commit). `send` is fire-and-forget: it returns immediately.
`wait` blocks until someone mentions `<me>` OR any new message appears; its output is
**self-contained** (the new message + a full dump of all threads), so a notified agent never
needs a second `read`.

## The watcher loop (this is the whole trick)

1. Start your watcher as a **background task** and keep exactly ONE running at all times:

   ```bash
   RADIO_ROOT=... scripts/radio.sh wait agent-2 --max-wait 300   # run in background
   ```

2. Keep working in the foreground. Never block on purpose. Never go deaf.
3. When the background task finishes: **first relaunch a fresh watcher** (never leave a
   gap, never run two at once), **then** read the finished output and handle what's new.
4. Triage without stopping: `URGENT:` = handle now, it affects your in-flight work;
   `FYI:` = note it and continue; no prefix = reply at your next natural break.
5. Never silently drop a message. If you defer one, write it down and come back before
   the next phase.
6. After a context compaction, your memory is lossy — re-run `read` and copy evidence
   verbatim from the dump before writing anything that depends on teammates' findings.

## The five-phase protocol

**P1 · Explore** — start your watcher, explore independently, draft the sub-questions you
see. Send nothing yet.

**P2 · Divide** — the assembler (agent-1) opens a `planning` thread. Everyone proposes
coverage; negotiate until the partition (a) covers ALL explicit and implicit sub-questions,
(b) keeps things that belong together with the same agent, (c) has every finding discussed.
Every agent posts `APPROVE` (mentioning everyone) before P3 starts. The assembler then
broadcasts the final plan and opens a shared `worklog` thread — decisions live in
`planning`, live discoveries live in `worklog`; keep them separate.

**P3 · Execute, with live sharing** — work your share independently. Post to `worklog`
the moment something happens, because sending costs you nothing and doesn't interrupt
anyone:
- a finding that bears on another agent's sub-question (mention them);
- anything contradicting the agreed plan or a teammate's claim (`URGENT:` if their
  in-flight work depends on it);
- obstacles — say exactly what you tried and how it failed;
- abandoned approaches, so nobody re-burns time on the same dead end.
Gather evidence with exact values, file paths, line numbers. If the task says run code,
actually run it.

**P4 · Review** — each agent broadcasts complete findings with evidence into its own
results thread. Reviewers check factual conflicts, thin evidence, and information gaps
("I saw X relevant to your area that you didn't mention"). Re-investigation sends the item
back to P3. Approve only when there are no unresolved conflicts and no open gaps.

**P5 · Submit** — only after unanimous approval, the assembler writes the FULL draft (not a
summary), everyone checks it against their own findings, and only then is it submitted.

## Running it with real teams

- **Multiple agent processes** (e.g. several `claude -p` / `opencode run` sessions, tmux
  panes): give each a copy of this folder, export the same `RADIO_ROOT`, distinct agent
  IDs, and put the watcher loop + five-phase rules in each agent's system prompt /
  CLAUDE.md. See `prompts/peer-CLAUDE.md.template`.
- **Single orchestrator with subagents**: launch explorers/workers in parallel; have each
  worker append findings to the shared `worklog` thread as it goes; poll the thread at
  your own step boundaries (your tool-call boundaries play the role of the watcher).
- **Fidelity ladder** (from the paper — use it to decide how much process you need):
  B0 solo → L1 division of labor only → L2 + negotiated plan but blocking receive →
  L3 full passive awareness. Most of L3's win comes from mid-execution correction; skip
  the radio entirely for tasks too small to have a "middle".

## Multi-session collaboration (team-leader / proxy / team-member)

AgentRadio scales beyond one session. Two layers:

**Intra-session** — Team Leader {sub-agents}: the five-phase protocol, where `assembler`
(agent-1) is the Team Leader and `agent-2..N` are sub-agents, all sharing one `RADIO_ROOT`
(passive awareness). This is the default mode documented above.

**Cross-session** — when collaborators are *different sessions/processes/environments*, the
radio bus is NOT shared, so use the **memory store** (`tak2-08/memory`, GitHub-backed, see
memory-core) as the inter-session coordination bus. Three roles:

- **Team Leader Session** — owns the goal and final decisions; delegates to a Proxy Session.
- **Proxy Session** — the relay/coordinator hub between leader and members: coordinates
  member work, synthesizes results, and relays opinions both ways
  (leader → members ↓, members → leader ↑). Inside its own session it still uses radio
  with sub-agents.
- **Team Member Sub-session** — acts as a *parallel agent*: reads directives/context from
  memory, does the work, writes results back to memory.

Transport:
- `radio` = real-time passive bus **within** a session (shared `RADIO_ROOT`).
- `memory` = durable coordination bus **across** sessions. Write directives/opinions/status to
  `memory/YYYY-MM-DD.md` or `sessions/<task-id>/<role>.md`; other sessions recall via
  `memory_search "<task-id>"` / `memory_get`.

Recommended cross-session flow:
1. Leader: `memory write --path sessions/<task>/leader-directive.md --content "..."`
2. Proxy: `memory search "<task>"` → fan out to members (radio or memory) →
   `memory write sessions/<task>/proxy-synthesis.md` with the combined result.
3. Member: `memory get sessions/<task>/leader-directive.md` → work →
   `memory write sessions/<task>/member-<id>.md --content "result/evidence"`.
4. Leader: `memory get sessions/<task>/proxy-synthesis.md` → approve/feedback back to memory.

## Team Leader lifecycle & debate

**Team Leader Session** talks directly to the boss (user) and orchestrates everything:

1. **Goal clarification** — ask the boss for the goal; ask detailed follow-ups (scope,
   constraints, quality bar, deadlines, preferences).
2. **/팀장** — run the AgentRadio `/팀장` command to design the topology (1 leader + 1 proxy
    + N members) and emit copy-paste launch prompts for each session.
3. **Session-creation guidance** — tell the boss how many sessions to create and what prompt
   to paste into each (multi-session: new terminals; single-session: `task` sub-agents).
4. **Relay flow** — like a real company, hierarchical relay:
   `user → leader → proxy → member`, `proxy → member → proxy → member → member → proxy`,
   `leader → proxy → member → proxy → member → proxy → leader` … The proxy is the hub.
5. **Debate** — trigger `/토론`; the proxy moderates a stance-based debate; the leader may
    assign NEW work from the debate synthesis.

**Debate protocol** (proxy = moderator / 사회자):
1. Leader writes topic+goal to `sessions/<task>/debate-<n>.md` (or radio).
2. Proxy delivers it to EACH member individually; every member posts a STANCE:
   `수용` accept · `부정` reject · `긍정` positive · `조건부부정` conditional-reject ·
   `공격` attack · `방어` defend — with reasoning/evidence.
3. Proxy moderates (no side-taking): ensures all responded, allows attack/defend rounds,
   surfaces conflicts, keeps on-topic.
4. Proxy writes `sessions/<task>/proxy-debate-<n>.md` = synthesis (positions, consensus,
   conflicts, recommendation) and surfaces it to the leader.
5. Leader reads it and MAY assign new work; relay continues.

Stance tag: `STANCE:수용|부정|긍정|조건부부정|공격|방어`. Same flow works for single-session
parallel sub-agents (orchestrator = leader/proxy, `task` workers = members).

Role prompt templates: `prompts/팀장-CLAUDE.md.template`, `prompts/대리-CLAUDE.md.template`,
`prompts/팀원-CLAUDE.md.template`.

## Files

```
scripts/radio.sh        CLI wrapper (sh)
scripts/radio_main.py   implementation (python3 stdlib only)
prompts/peer-CLAUDE.md.template        generic equal-peer system prompt template
prompts/팀장-CLAUDE.md.template      Team Leader Session prompt
prompts/대리-CLAUDE.md.template       Proxy Session (coordinator/moderator) prompt
prompts/팀원-CLAUDE.md.template      Team Member Sub-session prompt
commands/팀장.md        /팀장 — Team Leader designs session topology + launch prompts
commands/토론.md        /토론 — structured stance-based debate (proxy moderates)
commands/대리.md        /대리 — Proxy Session launch prompt
commands/팀원.md        /팀원 — Team Member Session launch prompt
commands/세션간-라디오.md  /세션간-라디오 — cross-session radio+memory collaboration guide
```

Environment: `RADIO_ROOT` (bus location), `RADIO_POLL_SEC` (watcher poll interval, default 1s).
Cross-session bus: memory store `tak2-08/memory` (memory_search/get/write).
