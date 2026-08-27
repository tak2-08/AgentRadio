---
description: "Write to memory: daily log (append) or curated MEMORY.md"
agent: build
---

Write to memory:

- For raw logs/observations: `memory_write` with path="daily" and content="$ARGUMENTS" (or ask for content).
- For durable facts/preferences/decisions: `memory_write` with path="MEMORY.md" and curated markdown.

Ask user which target if $ARGUMENTS is ambiguous, then call the tool and report the written path.
