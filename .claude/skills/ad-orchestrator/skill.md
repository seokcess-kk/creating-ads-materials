---
name: ad-orchestrator
description: "광고 소재 제작 에이전트 팀을 조율하는 오케스트레이터. 사용자의 광고 소재 제작 요청을 받아 리서치/크리에이티브 디렉터/카피라이터/비주얼 디자이너/소재 컴포지터/퍼포먼스 분석가 6인 팀을 구성하고 협업을 조율한다. '광고 만들어줘', '소재 제작해줘', '캠페인 소재', '배너 만들어줘', 'SNS 광고', '검색 광고 카피' 등 광고 소재 제작 관련 요청 시 반드시 이 스킬을 사용할 것."
---

# Ad Creative Orchestrator

광고 소재 제작 에이전트 팀을 조율하여 디지털 광고 소재(카피 + 비주얼 + 완성형 합성)를 생성하는 통합 스킬.

## 실행 모드: Agent 도구 기반 서브에이전트 팀

팀은 Claude Code의 `Agent(subagent_type=...)` 도구로 서브에이전트를 스폰하여 구성한다. 독립적인 작업은 **하나의 메시지에 여러 Agent 호출을 넣어 병렬 실행**한다. 서브에이전트 간 직접 통신은 없으며, 모든 조율은 오케스트레이터(이 스킬을 호출한 메인 컨텍스트)가 파일(`_workspace/`)을 매개로 수행한다.

## 에이전트 구성 (6인)

| 팀원 | subagent_type | 권장 모델 | 역할 | 스킬 | 출력 |
|------|-------------|----------|------|------|------|
| research-analyst | research-analyst | sonnet | 브랜드/BP 분석, 스타일 가이드 | ad-research | `_workspace/00_brand_style_guide.md`, `_workspace/00_bp_analysis.md` |
| creative-director | creative-director | opus | 콘셉트 기획, 브리프 작성, 최종 검수 | ad-creative-brief | `_workspace/01_creative_brief.md`, `_workspace/05_final_review.md` |
| copywriter | copywriter | opus | 채널별 광고 카피 작성 | ad-copywriting | `_workspace/02_copywriter_copies.md` |
| visual-designer | visual-designer | sonnet | 비주얼 설계 및 이미지 생성 | ad-visual-design | `_workspace/03_visual_designer_guide.md`, `_workspace/images/` |
| compositor | compositor | haiku | 카피+이미지 합성, 완성형 소재 생성 | ad-compose | `_workspace/images/final/` |
| performance-analyst | performance-analyst | opus | 2단계 소재 평가 및 개선 피드백 | ad-performance-review | `_workspace/04_review_round1.md`, `_workspace/04_review_round2.md` |

**모델 선택 원칙:**
- **opus** — 1M context로 다중 문서를 통합 판단해야 하는 창의/전략 작업 (CD, 카피, 퍼포먼스)
- **sonnet** — 구조화된 분석·프롬프트 작성 (리서치, 비주얼)
- **haiku** — JSON 설정 생성 등 기계적 변환 (컴포지터)

사용자가 명시적으로 모델을 지정하면 그 지시를 우선한다.

## 워크플로우

### Phase 1: 준비
1. 사용자 입력 분석 — 제품/서비스 정보, 캠페인 목표, 타겟, 채널 요구사항 파악
2. 작업 디렉토리에 `_workspace/` 생성
3. 사용자 요청 원문을 `_workspace/00_input/request.md`에 저장
4. `references/brand_assets/`, `references/best_practices/` 존재 여부 확인

### Phase 2: 작업 등록

```
TaskCreate (각 작업별 개별 호출):
  - "브랜드/BP 리서치" (research-analyst)
  - "크리에이티브 브리프 작성" (creative-director) — 리서치 의존
  - "광고 카피 작성" (copywriter) — 브리프 의존
  - "비주얼 설계 및 이미지 생성" (visual-designer) — 브리프 의존
  - "[1차 리뷰] 카피/이미지 개별 평가" (performance-analyst) — 카피·비주얼 의존
  - "1차 피드백 반영 및 합성 준비" (creative-director) — 1차 리뷰 의존
  - "소재 합성" (compositor) — 1차 피드백 반영 의존
  - "[2차 리뷰] 최종 합성 소재 평가" (performance-analyst) — 합성 의존
  - "최종 검수 및 전달" (creative-director) — 2차 리뷰 의존
```

### Phase 3: 브랜드/BP 리서치

**실행 방식:** research-analyst 단독 (레퍼런스 존재 시에만)

```
Agent(
  subagent_type="research-analyst",
  model="sonnet",
  description="브랜드/BP 분석",
  prompt="references/brand_assets/와 references/best_practices/의 이미지를 분석하여 _workspace/00_brand_style_guide.md와 _workspace/00_bp_analysis.md를 작성하라. .claude/skills/ad-research/skill.md의 워크플로우를 따르고, CD가 브리프 작성 시 참조할 수 있도록 레퍼런스 이미지 세트(최대 11장) 큐레이션 결과를 포함하라."
)
```

레퍼런스 폴더가 비어 있으면 이 단계를 건너뛰고 CD에게 그 사실을 전달한다.

### Phase 4: 크리에이티브 브리프 작성

**실행 방식:** creative-director 단독

```
Agent(
  subagent_type="creative-director",
  model="opus",
  description="크리에이티브 브리프 작성",
  prompt="_workspace/00_input/request.md와 (존재 시) _workspace/00_brand_style_guide.md, _workspace/00_bp_analysis.md를 통합하여 _workspace/01_creative_brief.md를 작성하라. .claude/skills/ad-creative-brief/skill.md의 워크플로우를 따르라. 브리프에는 타겟 페르소나, 3개 콘셉트 후보와 추천 1안, 채널별 전략, 카피라이터·비주얼 디자이너 각각에 대한 구체적 작업 지시, 폰트 키워드(fonts/catalog.md 참조), 레퍼런스 이미지 경로를 포함하라."
)
```

**산출물:** `_workspace/01_creative_brief.md`

### Phase 5: 카피 + 비주얼 제작 (병렬)

**실행 방식:** 단일 메시지에 Agent 호출 2개를 병렬 실행

```
Agent #1:
  subagent_type="copywriter", model="opus",
  description="광고 카피 작성",
  prompt="_workspace/01_creative_brief.md에 기반하여 채널별 5-10개 카피 변형을 _workspace/02_copywriter_copies.md에 작성하라. .claude/skills/ad-copywriting/skill.md의 워크플로우를 따르라."

Agent #2:
  subagent_type="visual-designer", model="sonnet",
  description="비주얼 설계 및 이미지 생성",
  prompt="_workspace/01_creative_brief.md에 기반하여 비주얼 가이드를 _workspace/03_visual_designer_guide.md에 작성하고, Gemini 모델로 이미지를 _workspace/images/에 생성하라. 레퍼런스가 있으면 --ref로 전달하라. 콘셉트 시안은 Pro, 대량 변형은 Nano Banana 2(--model flash)를 선택하라. .claude/skills/ad-visual-design/skill.md를 따르라."
```

두 에이전트는 독립적으로 동작하며 공통 입력은 브리프. 교차 조정이 필요하면 오케스트레이터가 두 산출물을 확인 후 CD에게 조율 요청.

### Phase 6: 1차 리뷰

```
Agent(
  subagent_type="performance-analyst", model="opus",
  description="1차 리뷰 (카피/이미지 개별)",
  prompt="_workspace/02_copywriter_copies.md와 _workspace/images/를 평가하라. 경쟁사 분석 포함. 합성 전 수정할 사항을 _workspace/04_review_round1.md에 저장. .claude/skills/ad-performance-review/skill.md의 1차 리뷰 워크플로우를 따르라."
)
```

### Phase 7: 피드백 반영 → 합성

1차 피드백이 수정을 요구하면 CD가 copywriter/visual-designer를 재호출.

```
Agent(
  subagent_type="creative-director", model="opus",
  description="1차 피드백 반영 지시",
  prompt="_workspace/04_review_round1.md를 검토하고 수정이 필요하면 반영 지시를 작성하라. 합성할 카피-이미지 조합을 확정하여 compositor용 지시서를 _workspace/01b_compose_brief.md에 작성하라."
)

Agent(
  subagent_type="compositor", model="haiku",
  description="소재 합성",
  prompt="_workspace/01b_compose_brief.md에 지정된 조합대로 합성 설정 JSON을 작성하고 scripts/compose_ad.py를 실행하여 _workspace/images/final/에 완성형 소재를 저장하라. .claude/skills/ad-compose/skill.md를 따르라."
)
```

### Phase 8: 2차 리뷰

```
Agent(
  subagent_type="performance-analyst", model="opus",
  description="2차 리뷰 (합성 소재)",
  prompt="_workspace/images/final/의 합성 소재를 평가하여 _workspace/04_review_round2.md에 저장. 업로드 가능/수정 필요/재제작 판정 포함. .claude/skills/ad-performance-review/skill.md의 2차 리뷰 워크플로우를 따르라."
)
```

### Phase 9: 최종 검수 및 전달

```
Agent(
  subagent_type="creative-director", model="opus",
  description="최종 검수",
  prompt="_workspace/04_review_round2.md를 검토하고 _workspace/05_final_review.md에 최종 보고서를 작성하라. '수정 필요' 판정이면 compositor에게 재합성 지시서를 먼저 작성하라."
)
```

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
| 브랜드 스타일 가이드 | _workspace/00_brand_style_guide.md | 레퍼런스 기반 스타일 |
| BP 분석 | _workspace/00_bp_analysis.md | 업계 패턴 |
| 크리에이티브 브리프 | _workspace/01_creative_brief.md | 콘셉트, 타겟, 채널 전략 |
| 광고 카피 세트 | _workspace/02_copywriter_copies.md | 채널별 N개 변형 |
| 비주얼 가이드 | _workspace/03_visual_designer_guide.md | 컬러, 타이포, 레이아웃 |
| 생성 이미지 | _workspace/images/ | 배경 이미지 |
| 완성형 소재 | _workspace/images/final/ | 업로드 가능 소재 |
| 1·2차 리뷰 | _workspace/04_review_round1.md, round2.md | 평가, 개선 권고 |

## 핵심 카피 (채널별 대표)
### [채널명]
- 헤드라인:
- CTA:

## 비주얼 요약
- 스타일:
- 핵심 이미지:

## 퍼포먼스 분석 요약
- 2차 종합 점수: /5
- 업로드 판정:
- 주요 강점:
- 개선 권고:

## A/B 테스트 제안
1. [테스트명]: [설명]
```

### Phase 10: 정리
- `_workspace/` 디렉토리 보존 (사후 검증용)
- 최종 결과 요약을 사용자에게 전달

## 데이터 흐름

```
[사용자 요청] → _workspace/00_input/request.md
     ↓
[Phase 3] research-analyst ─┐
                             ├→ _workspace/00_brand_style_guide.md
                             └→ _workspace/00_bp_analysis.md
     ↓
[Phase 4] creative-director → _workspace/01_creative_brief.md
     ↓
[Phase 5] copywriter ∥ visual-designer  (병렬)
            ↓                    ↓
     02_copywriter_copies.md   03_visual_designer_guide.md + images/
     ↓
[Phase 6] performance-analyst → _workspace/04_review_round1.md
     ↓
[Phase 7] creative-director → 01b_compose_brief.md
             ↓
          compositor → _workspace/images/final/
     ↓
[Phase 8] performance-analyst → _workspace/04_review_round2.md
     ↓
[Phase 9] creative-director → _workspace/05_final_review.md
     ↓
[사용자에게 전달]
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| 레퍼런스 폴더 비어있음 | Phase 3 생략, CD에게 그 사실 전달 |
| 서브에이전트 1명 실패 | 오케스트레이터가 같은 subagent_type으로 1회 재호출, 재실패 시 오케스트레이터가 직접 산출물 작성 |
| 이미지 생성 실패 | visual-designer가 프롬프트 수정 후 1회 재시도. 재실패 시 프롬프트만 제공 |
| 경쟁사 검색 실패 | performance-analyst가 가용 정보만으로 평가, 미수집 영역 명시 |
| 카피-비주얼 불일치 | CD가 한쪽 수정 지시 (해당 에이전트 재호출) |
| 2차 리뷰 '재제작' 판정 | Phase 5부터 재실행 (카피/이미지 원인 파악 후 해당 에이전트만) |
| 타임아웃 | 현재까지 수집된 부분 결과 사용, 미완료 영역 명시 |

## 병렬화 규칙

**한 메시지에 여러 Agent 호출을 넣는 경우:**
- Phase 5: copywriter + visual-designer (상호 독립)

**순차 실행이 필수인 경우:**
- Phase 3 → 4 → 5 (브리프가 전제)
- Phase 6 → 7 → 8 (리뷰 결과가 전제)

## 테스트 시나리오

### 정상 흐름
1. 사용자가 "헬스케어 앱 인스타그램 광고 만들어줘"를 요청
2. Phase 1 입력 저장, Phase 2 작업 등록
3. Phase 3에서 research-analyst가 references/ 분석 (있을 경우)
4. Phase 4에서 CD가 브리프 작성 (타겟: 20-30대, 콘셉트: 건강한 라이프스타일)
5. Phase 5에서 copywriter·visual-designer 병렬 실행
6. Phase 6에서 1차 리뷰, Phase 7에서 피드백 반영 후 합성
7. Phase 8에서 2차 리뷰 (종합 4.2/5, 업로드 가능)
8. Phase 9에서 최종 보고서 전달

### 에러 흐름
1. Phase 5에서 visual-designer의 이미지 생성이 실패
2. 오케스트레이터가 프롬프트 수정 후 재호출 → 재실패
3. visual-designer가 프롬프트·비주얼 가이드만 제공
4. 사용자에게 "이미지 직접 생성 실패, 프롬프트 제공" 명시된 보고서 전달
5. 카피·비주얼 가이드·평가 등 나머지 산출물은 정상 전달
