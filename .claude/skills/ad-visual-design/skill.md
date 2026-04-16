---
name: ad-visual-design
description: "광고 비주얼을 설계하고 이미지를 생성하는 스킬. Gemini 3 Pro Image Preview (Nano Banana Pro) 모델로 이미지를 직접 생성한다. 레이아웃 설계, 컬러 팔레트, 타이포그래피 가이드, 채널별 사이즈 적용을 수행한다. 광고 이미지, 비주얼 소재, 배너 디자인, 광고 시안 요청 시 사용."
---

# Ad Visual Design

크리에이티브 브리프를 기반으로 광고 비주얼을 설계하고 이미지를 생성한다.

## 워크플로우

### 1. 브리프 분석
`_workspace/01_creative_brief.md`를 읽고 다음을 파악한다:
- 콘셉트 방향과 비주얼 무드
- 타겟 페르소나의 시각적 선호
- 채널별 규격과 레이아웃 요구사항
- 카피가 있으면 텍스트 배치 고려

### 2. 비주얼 콘셉트 수립
- 전체 무드/분위기 결정
- 컬러 팔레트 선정 (메인 60%, 서브 30%, 액센트 10%)
- 타이포그래피 제안 (헤드라인/본문/CTA용 폰트)
- 비주얼 스타일 결정 (사진, 일러스트, 3D, 미니멀, 맥시멀 등)

### 3. 채널별 레이아웃 설계
각 채널/사이즈별로:
- 구도 설계 (Rule of Thirds, 중앙 집중, 비대칭 등)
- 텍스트 배치 영역 지정
- CTA 버튼 위치
- 시각적 계층 구조

채널별 규격은 `references/channel-specs.md`를 참조한다.

### 4. 이미지 프롬프트 작성

Gemini 3 Pro Image Preview 모델용 프롬프트를 영어로 작성한다.

**프롬프트 구조:**
```
[Style/Medium]: photorealistic / flat illustration / 3D render / minimalist
[Subject]: main visual element, composition
[Background]: environment, setting
[Lighting]: natural / studio / dramatic / soft
[Color]: dominant colors, color mood
[Technical]: aspect ratio, quality keywords
[Negative]: elements to avoid
```

**프롬프트 작성 핵심 원칙 (Gemini 공식 가이드 기반):**
- **장면을 서술하라** — 키워드 나열이 아닌 연결된 문장으로 장면을 묘사한다. 깊이 있는 언어 이해가 모델의 강점이다.
- **실사형**: 카메라 각도, 렌즈 유형(85mm portrait lens 등), 조명 설정을 사진 용어로 기술
- **제품 사진**: 스튜디오 조명, 카메라 각도, 소재 특성을 상세 기술
- **미니멀 디자인**: 피사체 위치, 음의 공간(negative space), 조명 방향 명시
- 텍스트 오버레이 공간이 필요하면 구도 설명에 자연스럽게 녹여 서술한다
- 투명 배경은 미지원 — 필요 시 흰색 배경을 명시적으로 요청

**효과적 프롬프트 구성:**
```
[피사체 상세 설명] + [환경/배경] + [조명 설정] + [카메라 기술] + [분위기/스타일]
```

### 5. 이미지 생성

`scripts/generate_image.py` 스크립트를 사용하여 이미지를 생성한다.
aspect ratio와 해상도는 `imageConfig`를 통해 API에 전달된다.

**실행 방법:**
```bash
python scripts/generate_image.py \
  --prompt "장면 서술식 프롬프트" \
  --output "_workspace/images/{channel}_{variation}.png" \
  --aspect "1:1" \
  --size "2K"
```

**비율 옵션 (전체):**
`1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9`

| 채널 | 추천 aspect |
|------|------------|
| Instagram Feed (정사각) | `1:1` |
| Instagram Feed (세로) | `4:5` |
| Instagram Story/Reels, TikTok | `9:16` |
| Facebook Feed (가로) | `16:9` |
| 디스플레이 배너 (가로형) | `16:9` 또는 `21:9` |

**해상도 옵션:** `1K`, `2K`, `4K` (대문자 K 필수)

- 환경변수 `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY`가 설정되어 있어야 한다
- 파일명 컨벤션: `{channel}_{variation}.png` (예: `instagram_feed_v1.png`)
- 생성 실패 시 프롬프트를 수정하여 1회 재시도한다

### 6. 비주얼 가이드 문서 작성
컬러, 타이포, 레이아웃, 프롬프트를 종합한 비주얼 가이드를 작성한다.

## 산출물
- `_workspace/03_visual_designer_guide.md` — 비주얼 가이드 (컬러, 타이포, 레이아웃)
- `_workspace/03_visual_designer_prompts.md` — 이미지 생성 프롬프트 목록
- `_workspace/images/` — 생성된 이미지 파일들
