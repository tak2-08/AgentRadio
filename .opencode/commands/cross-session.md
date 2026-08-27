---
description: "Cross-session (세션 간 협력): 별도 세션/프로세스 간 조율 버스로 tak2-08/memory 를 사용. 지시/의견/상태를 sessions/<task-id>/ 경로에 기록·회상. 사용법: /cross-session"
agent: build
---

# 🌐 Cross-session (세션 간 협력) — AgentRadio

서로 다른 세션/프로세스/환경이 협력할 때는 radio 버스가 공유되지 않는다.
이 명령은 **`tak2-08/memory` 저장소를 세션 간 조율 버스**로 쓰는 패턴을 정의한다.

## 전송 계층 (Transport)
- **radio** = 한 세션 내 실시간 패시브 버스 (`RADIO_ROOT` 동일 시 자동 공유)
- **memory** = 여러 세션 간 내구성 있는 조율 버스 (`tak2-08/memory`)

## 권장 패턴 (Recommended pattern)
1. **팀장 세션**: `memory_write path="sessions/<task-id>/leader-directive.md" content="<목표·파티션·승인 기준>"`
2. **대리 세션**: `memory_search "<task-id>"` 로 지시 수신 → 팀원에게 radio(worklog) 또는 memory로 하위 지시 배분 → 팀원 결과를 `memory_write path="sessions/<task-id>/proxy-synthesis.md"` 에 종합
3. **팀원 세션**: `memory_get sessions/<task-id>/leader-directive.md` (또는 대리 지시) 읽고 작업 → `memory_write path="sessions/<task-id>/member-<id>.md" content="<결과/증거>"`
4. **팀장 세션**: `memory_get sessions/<task-id>/proxy-synthesis.md` 로 종합 수신 → 승인/피드백을 다시 memory에 기록

## 규칙
- 모든 지시/의견/상태는 `sessions/<task-id>/` 아래에 기록 (라벨: leader-directive / proxy-synthesis / member-<id> / leader-feedback).
- `memory_search` 로 회상 전에는 이전 결정을 지어내지 마라.
- radio 에 보낸 `worklog`/`planning` 발견은 memory 에도 자동 append 되므로, 중요한 건 `memory_dream` 으로 `MEMORY.md` 승격 고려.
