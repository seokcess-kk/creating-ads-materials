---
name: ad-orchestrator
description: "광고 소재 제작 에이전트 팀을 조율하는 오케스트레이터. 사용자의 광고 소재 제작 요청을 받아 크리에이티브 디렉터, 카피라이터, 비주얼 디자이너, 소재 컴포지터, 퍼포먼스 분석가 5인 팀을 구성하고 협업을 조율한다. '광고 만들어줘', '소재 제작해줘', '캠페인 소재', '배너 만들어줘', 'SNS 광고', '검색 광고 카피' 등 광고 소재 제작 관련 요청 시 반드시 이 스킬을 사용할 것."
---

# Ad Creative Orchestrator

광고 소재 제작 에이전트 팀을 조율하여 디지털 광고 소재(카피 + 비주얼)를 생성하는 통합 스킬.

## 실행 모드: 에이전트 팀

## 에이전트 구성

| 팀원 | 에이전트 타입 | 역할 | 스킬 | 출력 |
|------|-------------|------|------|------|
| creative-director | creative-director (커스텀) | 콘셉트 기획, 워크플로우 조율, 최종 검수 | ad-creative-brief | `_workspace/01_creative_brief.md`, `_workspace/05_final_review.md` |
| copywriter | copywriter (커스텀) | 채널별 광고 카피 작성 | ad-copywriting | `_workspace/02_copywriter_copies.md` |
| visual-designer | visual-designer (커스텀) | 비주얼 설계 및 이미지 생성 | ad-visual-design | `_workspace/03_visual_designer_guide.md`, `_workspace/images/` |
| compositor | compositor (커스텀) | 카피+이미지 합성, 완성형 소재 생성 | ad-compose | `_workspace/images/final/` |
| performance-analyst | performance-analyst (커스텀) | 소재 평가 및 개선 피드백 | ad-performance-review | `_workspace/04_performance_review.md` |

## 워크플로우

### Phase 1: 준비
1. 사용자 입력 분석 — 제품/서비스 정보, 캠페인 목표, 타겟, 채널 요구사항 파악
2. 작업 디렉토리에 `_workspace/` 생성
3. 사용자 요청 원문을 `_workspace/00_input/request.md`에 저장
4. 경쟁사 레퍼런스가 있으면 `_workspace/00_input/references/`에 저장

### Phase 2: 팀 구성

1. 팀 생성:
   ```
   TeamCreate(
     team_name: "ad-creative-team",
     members: [
       {
         name: "creative-director",
         agent_type: "creative-director",
         model: "opus",
         prompt: "당신은 광고 소재 제작 팀의 크리에이티브 디렉터입니다. _workspace/00_input/request.md를 읽고 크리에이티브 브리프를 작성하세요. .claude/skills/ad-creative-brief/skill.md의 워크플로우를 따르세요. 브리프 완성 후 copywriter와 visual-designer에게 작업을 지시하세요."
       },
       {
         name: "copywriter",
         agent_type: "copywriter",
         model: "opus",
         prompt: "당신은 광고 카피라이터입니다. creative-director의 브리프를 받으면 .claude/skills/ad-copywriting/skill.md의 워크플로우를 따라 채널별 카피를 작성하세요. 완성 후 creative-director에게 알리세요."
       },
       {
         name: "visual-designer",
         agent_type: "visual-designer",
         model: "opus",
         prompt: "당신은 광고 비주얼 디자이너입니다. creative-director의 브리프를 받으면 .claude/skills/ad-visual-design/skill.md의 워크플로우를 따라 비주얼 가이드를 작성하고 이미지를 생성하세요. Gemini 3 Pro Image Preview 모델을 사용하세요. 완성 후 creative-director에게 알리세요."
       },
       {
         name: "performance-analyst",
         agent_type: "performance-analyst",
         model: "opus",
         prompt: "당신은 광고 소재 퍼포먼스 분석가입니다. creative-director로부터 평가 요청을 받으면 .claude/skills/ad-performance-review/skill.md의 워크플로우를 따라 소재를 평가하세요. 완성 후 creative-director에게 결과를 보고하세요."
       }
     ]
   )
   ```

2. 작업 등록:
   ```
   TaskCreate(tasks: [
     {
       title: "크리에이티브 브리프 작성",
       description: "_workspace/00_input/request.md를 분석하여 크리에이티브 브리프를 _workspace/01_creative_brief.md에 작성. 타겟 페르소나, 콘셉트 방향, 채널별 전략, 카피/비주얼 작업 지시 포함.",
       assignee: "creative-director"
     },
     {
       title: "광고 카피 작성",
       description: "크리에이티브 브리프에 기반하여 채널별 5-10개 카피 변형 생성. _workspace/02_copywriter_copies.md에 저장.",
       assignee: "copywriter",
       depends_on: ["크리에이티브 브리프 작성"]
     },
     {
       title: "비주얼 설계 및 이미지 생성",
       description: "크리에이티브 브리프에 기반하여 비주얼 가이드 작성 + Gemini 모델로 이미지 생성. _workspace/03_visual_designer_guide.md와 _workspace/images/에 저장.",
       assignee: "visual-designer",
       depends_on: ["크리에이티브 브리프 작성"]
     },
     {
       title: "[1차 리뷰] 카피/이미지 개별 평가",
       description: "카피와 배경 이미지를 개별 평가. 경쟁사 분석 포함. 합성 전 수정이 필요한 피드백 제공. _workspace/04_review_round1.md에 저장.",
       assignee: "performance-analyst",
       depends_on: ["광고 카피 작성", "비주얼 설계 및 이미지 생성"]
     },
     {
       title: "1차 피드백 반영 및 소재 합성",
       description: "1차 리뷰 피드백을 반영하여 카피/이미지 수정 지시. 이후 compositor에게 최종 합성 지시. _workspace/images/final/에 저장.",
       assignee: "creative-director",
       depends_on: ["[1차 리뷰] 카피/이미지 개별 평가"]
     },
     {
       title: "소재 합성",
       description: "카피 + 배경 이미지 + 브랜드 요소를 합성하여 최종 완성형 소재 생성. _workspace/images/final/에 저장.",
       assignee: "compositor",
       depends_on: ["1차 피드백 반영 및 소재 합성"]
     },
     {
       title: "[2차 리뷰] 최종 합성 소재 평가",
       description: "합성된 최종 소재를 평가. 가독성, 레이아웃, 텍스트-이미지 조화, CTA 명확성 점검. 업로드 가능 여부 판정. _workspace/04_review_round2.md에 저장.",
       assignee: "performance-analyst",
       depends_on: ["소재 합성"]
     },
     {
       title: "최종 검수 및 전달",
       description: "2차 리뷰 결과를 검토. 수정 필요 시 compositor에게 재합성 지시. 최종 산출물을 정리하여 사용자에게 전달.",
       assignee: "creative-director",
       depends_on: ["[2차 리뷰] 최종 합성 소재 평가"]
     }
   ])
   ```

### Phase 3: 크리에이티브 브리프 작성

**실행 방식:** creative-director 단독 작업

creative-director가 사용자 요청을 분석하고 크리에이티브 브리프를 작성한다.
브리프에는 카피라이터와 비주얼 디자이너의 작업 순서/협업 방식도 포함된다.

**산출물:** `_workspace/01_creative_brief.md`

브리프 완성 후 creative-director가 copywriter와 visual-designer에게 SendMessage로 작업 시작을 알린다.

### Phase 4: 카피 + 비주얼 제작

**실행 방식:** creative-director가 판단한 순서에 따라 진행

**옵션 A — 카피 우선 (메시지 중심 콘셉트):**
1. copywriter가 카피 작성 완료
2. copywriter가 visual-designer에게 핵심 카피 SendMessage
3. visual-designer가 카피에 맞춰 비주얼 제작

**옵션 B — 비주얼 우선 (비주얼 중심 콘셉트):**
1. visual-designer가 비주얼 콘셉트/시안 완성
2. visual-designer가 copywriter에게 비주얼 방향 SendMessage
3. copywriter가 비주얼에 맞춰 카피 작성

**옵션 C — 동시 진행 + 피드백:**
1. copywriter와 visual-designer가 동시에 작업
2. 중간 산출물을 SendMessage로 상호 공유
3. 1회 피드백 교환 후 최종 확정

**팀원 간 통신 규칙:**
- copywriter는 카피 완성 시 creative-director에게 알림
- visual-designer는 비주얼 완성 시 creative-director에게 알림
- creative-director가 양쪽 산출물을 확인하고 조화가 필요하면 수정 지시

**산출물:**
| 팀원 | 출력 경로 |
|------|----------|
| copywriter | `_workspace/02_copywriter_copies.md` |
| visual-designer | `_workspace/03_visual_designer_guide.md`, `_workspace/03_visual_designer_prompts.md`, `_workspace/images/` |

### Phase 5: 소재 평가

**실행 방식:** performance-analyst 작업 → creative-director 검토

1. creative-director가 performance-analyst에게 평가 요청 SendMessage
2. performance-analyst가 카피 + 비주얼 + 경쟁사 분석 수행
3. 평가 리포트를 creative-director에게 전달

**산출물:** `_workspace/04_performance_review.md`

### Phase 6: 최종 검수 및 전달

1. creative-director가 performance-analyst의 피드백을 검토
2. 핵심 개선 사항이 있으면 copywriter/visual-designer에게 수정 지시 (SendMessage)
3. 수정 완료 또는 현재 상태 확정 판단
4. 최종 산출물을 정리하여 `_workspace/05_final_review.md` 작성
5. 사용자에게 결과 요약 보고

**최종 보고 형식:**
```markdown
# 광고 소재 제작 결과

## 캠페인 요약
- 제품/서비스:
- 콘셉트:
- 타겟:

## 산출물 목록
| 산출물 | 경로 | 설명 |
|--------|------|------|
| 크리에이티브 브리프 | _workspace/01_creative_brief.md | 콘셉트, 타겟, 채널 전략 |
| 광고 카피 세트 | _workspace/02_copywriter_copies.md | 채널별 N개 변형 |
| 비주얼 가이드 | _workspace/03_visual_designer_guide.md | 컬러, 타이포, 레이아웃 |
| 생성 이미지 | _workspace/images/ | N개 이미지 |
| 소재 평가 | _workspace/04_performance_review.md | 평가 점수, 개선 권고 |

## 핵심 카피 (채널별 대표)
### [채널명]
- 헤드라인:
- CTA:

## 비주얼 요약
- 스타일:
- 핵심 이미지:

## 퍼포먼스 분석 요약
- 종합 점수: /5
- 주요 강점:
- 개선 권고:

## A/B 테스트 제안
1. [테스트명]: [설명]
```

### Phase 7: 정리
1. 팀원들에게 종료 요청 (SendMessage)
2. 팀 정리 (TeamDelete)
3. `_workspace/` 디렉토리 보존 (사후 검증용)
4. 사용자에게 최종 결과 전달

## 데이터 흐름

```
[사용자 요청]
     ↓
[리더] → TeamCreate → [creative-director]
                           ↓ 브리프 작성
                           ↓ SendMessage (작업 지시)
                    ┌──────┴──────┐
              [copywriter]   [visual-designer]
                    │              │
                    ↓ SendMessage  ↓
                    └──←→──┘ (상호 피드백, CD 판단)
                           ↓
                    [performance-analyst]
                           ↓ 평가 리포트
                    [creative-director]
                           ↓ 최종 검수
                    [사용자에게 전달]
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| 팀원 1명 실패/중지 | 리더가 감지 → SendMessage로 상태 확인 → 재시작 또는 해당 영역 리더가 직접 수행 |
| 이미지 생성 실패 | visual-designer가 프롬프트 수정 후 1회 재시도. 재실패 시 프롬프트만 제공 |
| 경쟁사 검색 실패 | performance-analyst가 가용 정보만으로 평가, 미수집 영역 명시 |
| 카피-비주얼 불일치 | creative-director가 조율, 한쪽 수정 지시 |
| 타임아웃 | 현재까지 수집된 부분 결과 사용, 미완료 영역 명시 |
| 팀원 간 데이터 충돌 | 출처 명시 후 병기, 삭제하지 않음 |

## 테스트 시나리오

### 정상 흐름
1. 사용자가 "헬스케어 앱 인스타그램 광고 만들어줘"를 요청
2. Phase 1에서 입력 저장
3. Phase 2에서 팀 구성 (4명 팀원 + 5개 작업)
4. Phase 3에서 creative-director가 브리프 작성 (타겟: 20-30대, 콘셉트: 건강한 라이프스타일)
5. Phase 4에서 copywriter가 인스타그램 카피 8개 변형 작성, visual-designer가 피드/스토리 이미지 생성
6. Phase 5에서 performance-analyst가 종합 점수 4.2/5 평가, A/B 테스트 2개 설계
7. Phase 6에서 creative-director가 최종 검수, 사소한 카피 수정 1건 지시
8. Phase 7에서 팀 정리, 최종 보고서 전달
9. 예상 결과: `_workspace/05_final_review.md` + 채널별 카피 + 이미지

### 에러 흐름
1. Phase 4에서 visual-designer의 이미지 생성이 실패
2. visual-designer가 프롬프트 수정 후 재시도 → 재실패
3. visual-designer가 프롬프트와 비주얼 가이드만 제공
4. creative-director가 리더에게 상황 보고
5. 리더가 사용자에게 이미지 생성 실패 알림, 프롬프트로 수동 생성 안내
6. 나머지 산출물(카피, 비주얼 가이드, 평가)은 정상 전달
7. 최종 보고서에 "이미지 직접 생성 실패, 프롬프트 제공" 명시
