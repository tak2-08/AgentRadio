---
name: memory-core
description: Stable, systematic long-term memory for opencode (openclaw-style). Use when you need to remember durable facts, preferences, decisions across sessions, search prior notes, or promote daily logs to MEMORY.md. Triggers: memory_search, memory_get, MEMORY.md, daily notes, dreaming, long-term, remember this.
---

# Memory Core — 장기 기억 (openclaw 체계의 opencode 이식)

OpenClaw의 `MEMORY.md` + `memory/YYYY-MM-DD.md` + `memory_search`/`memory_get` 체계를 opencode에 그대로 이식. 에이전트는 매 세션 깨끗이 깨어나지만, 파일로 남긴 것만이 기억된다.

## 파일 위치 (worktree-scoped, radio와 동일)

- `OPENCODE_MEMORY_ROOT=~/.cache/opencode/memory/<sanitized-worktree>-<hash>/`
- `MEMORY.md` — curated long-term (durable facts, preferences, decisions). 세션 시작 시 60줄 미리보기 자동 주입.
- `memory/YYYY-MM-DD.md` — daily notes (원시 로그, 관찰, 세션 요약). `memory_search`로 인덱싱, 매 턴 주입은 오늘/어제 30줄 미리보기만.
- `~/.config/opencode/MEMORY.md` (글로벌 크로스 프로젝트, 있으면 함께 검색)
- `<worktree>/MEMORY.md` (프로젝트 포터블, 있으면 함께 검색)

## 네이티브 툴 (플러그인이 제공, 코어처럼 항상 있음)

```bash
memory_search(query, maxResults=5, minScore=0.05, corpus="memory")  # 필수 recall — prior work 답하기 전 반드시 실행
memory_get(path, from=1, lines=80)                               # 정확한 발췌 읽기
memory_write(path, content, mode="append")                        # daily는 append-only, MEMORY.md는 curated
memory_status()                                                   # 인덱스 상태
memory_dream(days=7)                                              # 최근 daily를 훑어 MEMORY.md 승격 후보 제안
```

`memory_search`는 키워드+temporal decay(30일 half-life), `MEMORY.md` 가중치, MMR-like 다양성 없이 현재 builtin FTS. 벡터 임베딩은 향후 provider로 확장.

## 필수 recall 규칙

> 이전 작업, 결정, 날짜, 인물, 선호, todos에 답하기 전에 반드시 `memory_search`를 먼저 실행하고, 필요한 줄은 `memory_get`으로 당겨라. 확신이 낮으면 “확인했고 없었다”고 말하라.

## 쓰기 정책

- Daily: 상세 로그 → `memory/YYYY-MM-DD.md`에 append-only. `memory_write path="daily" content="..."`
- Curated: durable facts → `MEMORY.md`. 주기적으로 daily에서 승격.
- Action-sensitive: 승인/권한, 임시 제약, 핸드오프, 만료 조건, safe-to-act timing, source/owner를 명시.
- 비밀은 넣지 마라.

## 자동 flush

컴팩션 직전에 플러그인이 `memory/YYYY-MM-DD.md`에 최근 20개 메시지를 자동 flush. 다음 턴에서 `memory_search`로 검증.

## Dreaming

`memory_dream`은 최근 daily를 스캔해 `REMEMBER|DECISION|prefer|항상|절대` 등 휴리스틱으로 후보를 뽑는다. 자동 쓰기 안 함 — 네가 `memory_write path="MEMORY.md"`로 승격 결정. 주기적으로 heartbeat나 세션 종료 시 실행.

## Radio와 연동

`radio_send`로 `worklog`/`planning`에 보낸 발견은 자동으로 `memory/YYYY-MM-DD.md`에도 append — radio의 휘발성 bus가 daily로 durable해짐. 중요한 발견은 `memory_dream`에서 `MEMORY.md`로 승격 고려.
