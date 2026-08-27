# 🧠 Memory Core — 장기 기억 (opencode 코어, openclaw 체계)

이 파일은 **모든 세션, 모든 에이전트**에 자동 주입된다. 플러그인(`plugins/memory-core.ts`)이 동일 내용을 시스템 프롬프트에 매 턴 주입하므로, 이 문서는 정본이다. 체계는 OpenClaw `MEMORY.md` + `memory/YYYY-MM-DD.md`를 그대로 따른다.

## 파일 위치 (worktree-scoped, radio와 동일 해시)

- `OPENCODE_MEMORY_ROOT=~/.cache/opencode/memory/<sanitized-worktree>-<hash>/` — 프로젝트별 장기 기억 캐시 (git 추적 안 함)
- `MEMORY.md` — curated long-term (durable facts, preferences, decisions, standing rules). 세션 시작 시 미리보기 주입됨.
- `memory/YYYY-MM-DD.md` — daily notes (원시 로그, 관찰, 세션 요약). `memory_search`로 인덱싱되지만 매 턴 주입은 오늘/어제 미리보기만.
- 글로벌 크로스 프로젝트: `~/.config/opencode/MEMORY.md` (있으면 함께 검색)
- 프로젝트 포터블: `<worktree>/MEMORY.md` (있으면 함께 검색)

도구로 쓰는 것 외에 직접 `read`/`write`/`edit`로 파일을 편집해도 된다 — 플러그인은 파일을 소스로 본다.

## 네이티브 툴 (플러그인이 제공, 코어처럼 항상 있음)

| 툴 | 용도 |
|---|---|
| `memory_search` | **필수 recall**: prior work/결정/날짜/인물/선호/todos에 답하기 전에 반드시 실행. `MEMORY.md`+`memory/*.md`를 키워드+temporal decay로 검색. `Source: path#line` 인용 제공. |
| `memory_get` | `path`+`from`+`lines`로 정확한 발췌 읽기. 검색 후 필요한 줄만 당기기. |
| `memory_write` | `path`에 쓰기. `path="daily"` 또는 `memory/YYYY-MM-DD.md`는 append-only daily, `path="MEMORY.md"`는 curated. `mode="append"` 기본. |
| `memory_status` | 인덱스 상태: 파일 수, 크기, provider(현재 builtin FTS). |
| `memory_dream` | 최근 N일 daily를 훑어 `MEMORY.md` 승격 후보를 제안. 자동 쓰기 안 함 — 네가 `memory_write`로 승격 결정. |

셀 폴백: `~/.cache/opencode/memory/.../MEMORY.md`를 직접 `cat` 해도 되지만 툴이 인용과 decay를 제공한다.

## 필수 recall 규칙 (openclaw와 동일)

> **이전 작업, 결정, 날짜, 인물, 선호, todos에 관한 질문에 답하기 전에는 반드시 `memory_search`를 먼저 실행하고, 필요한 줄은 `memory_get`으로 당겨라. 확신이 낮으면 “확인했고 없었다”고 말하라.**

`memory_search` 없이 기억을 지어내지 마라. `memory_get` 없이 추측하지 마라.

## 쓰기 정책

- **Daily**: 상세 로그, 관찰, 세션 요약 — `memory/YYYY-MM-DD.md`에 append-only. 예: `memory_write path="daily" content="오늘 API 라우팅을 ...로 결정"` → `- [2026-08-26T...] ...` 로 기록됨.
- **Curated**: durable facts, preferences, standing decisions — `MEMORY.md`에 간결히. 주기적(heartbeat/세션 종료 시)으로 daily에서 가치가 있는 것을 승격.
- **액션 민감 메모**: 승인/권한, 임시 제약, 핸드오프, 만료 조건, safe-to-act timing, source/owner를 명시. 예:
  ```
  API migration은 다른 세션에서 설계 중. 이 스레드에서는 구현을 편집하지 말고 설계 입력으로만 사용 — plan이 랜딩할 때까지.
  ```
- 비밀은 `MEMORY.md`에 넣지 마라 (필요하면 플레이스홀더).

## 자동 flush (compaction 전)

컴팩션 직전에 플러그인이 `memory/YYYY-MM-DD.md`에 현재 세션의 최근 20개 메시지를 자동 flush한다. 너는 그 다음 턴에서 `memory_search`로 검증하면 된다. 이로써 긴 세션의 맥락 손실을 방지한다 (openclaw의 silent memory flush와 동일).

## Dreaming (옵션, thresholded)

`memory_dream`은 최근 daily를 스캔해 `REMEMBER|DECISION|선호|항상|절대` 등 휴리스틱으로 후보를 뽑는다. deep dreaming처럼 score/recall-frequency를 보지 않고 단순 surface하지만, “무엇이 long-term이 될 자격이 있는가”를 사람이 검토하는 창을 제공한다. 승격은 네가 `memory_write path="MEMORY.md"`로 직접 한다.

```bash
# CLI에서도 가능 (향후)
# opencode memory search "query"
# opencode memory status
```

## Radio와 연동

`radio_send`로 `worklog`/`planning`에 보낸 발견은 자동으로 `memory/YYYY-MM-DD.md`에도 append된다 — radio의 휘발성 bus가 daily로 durable해지는 것. 중요한 발견은 `memory_dream`에서 다시 `MEMORY.md`로 승격 고려.
