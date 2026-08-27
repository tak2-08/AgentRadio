---
description: "Dreaming: consolidate daily notes into durable MEMORY.md, AND propose next tasks/goals/ideas from existing memory (imagination + storage) — GitHub-backed universal store"
agent: build
---

Run dreaming consolidation against the universal GitHub-backed store (`tak2-08/memory`):

1. **Store (consolidate + persist)**: Call `memory_dream` with days=7 (or $ARGUMENTS if a number). Review candidates, decide what is durable.
2. **Promote + persist**: For each promotion, call `memory_write` with path="MEMORY.md" and curated markdown. Also append a daily note via `memory_write` path="daily" for session outcomes not yet captured.
3. **Imagine (propose)**: From recent memory, synthesize concrete next tasks / goals / ideas as *proposed* next-actions (do NOT execute).
4. **Summarize**: Report (a) what was promoted to MEMORY.md, (b) what stayed as daily raw logs, (c) proposed next tasks/goals/ideas.

Non-opencode fallback: `memory dream 7` then `memory write --path MEMORY.md --content "..."` (CLI from https://github.com/tak2-08/memory).
