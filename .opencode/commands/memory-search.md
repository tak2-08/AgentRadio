---
description: "Search long-term memory (MEMORY.md + daily notes) before answering about prior work"
agent: build
---

Before answering about prior work, decisions, dates, people, preferences, or todos: run memory_search.

Steps:
1. Call `memory_search` with query="$ARGUMENTS" (if $ARGUMENTS empty, ask user for query).
2. If hits found, call `memory_get` for top 1-2 hits to pull exact lines with citations.
3. Answer from the snippets, include Source: path#line citations.
4. If no hits or low confidence, say you checked and found nothing.
