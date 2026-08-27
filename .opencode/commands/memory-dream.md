---
description: "Dreaming: consolidate daily notes into durable MEMORY.md, AND propose next tasks/goals/ideas from existing memory (imagination + storage)"
agent: build
---

Run dreaming consolidation — memory_dream does three jobs at once:

1. **Store (consolidate + persist)**: Call `memory_dream` with days=7 (or $ARGUMENTS if a number).
   Review candidates, decide what is durable (facts, preferences, decisions, standing rules worth keeping long-term).
2. **Promote + persist**: For each promotion, call `memory_write` with path="MEMORY.md" and curated markdown.
   If the current session produced outcomes not yet captured, also append a daily note via `memory_write` path="daily"
   so nothing durable is lost — dreaming also serves the memory-storage role, not just review.
3. **Imagine (propose)**: From the recent memory, synthesize concrete next tasks / goals / ideas —
   what should be done next, what hypotheses or improvements surface. List them as *proposed* next-actions
   (do NOT execute them; just propose). This is the imagination/idea role of dreaming, grounded in existing memory.
4. **Summarize**: Report (a) what was promoted to MEMORY.md, (b) what was left as daily raw logs,
   and (c) the proposed next tasks / goals / ideas.
