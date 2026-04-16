---
name: ad-research
description: "브랜드 에셋과 BP(Best Practice) 레퍼런스를 분석하여 스타일 가이드와 디자인 인사이트를 도출하는 스킬. 브랜드 분석, 경쟁사 소재 분석, 레퍼런스 분석, 스타일 가이드 생성, 업계 트렌드 분석 요청 시 반드시 이 스킬을 사용할 것. '브랜드 분석해줘', '경쟁사 소재 분석', '레퍼런스 분석', '스타일 가이드 만들어줘' 등."
---

# Ad Research

브랜드 에셋과 BP 레퍼런스를 분석하여 광고 소재 제작의 방향을 설정한다.

## 폴더 구조

```
references/
├── brand_assets/        ← 브랜드 에셋 (로고, 기존 소재, 웹사이트 스크린샷)
└── best_practices/      ← BP 레퍼런스 (경쟁사/업계 우수 소재 스크린샷)
```

사용자가 이미지를 해당 폴더에 넣으면 분석이 시작된다.

## 워크플로우

### 1. 브랜드 에셋 분석

`references/brand_assets/`에 있는 이미지를 분석한다.

```bash
python scripts/analyze_reference.py \
  --dir references/brand_assets/ \
  --output _workspace/00_brand_style_guide.md \
  --mode brand
```

추가로 브랜드 웹사이트 URL이 제공되면 WebFetch로 분석하여 스타일 가이드에 반영한다.

**산출물:** `_workspace/00_brand_style_guide.md`
- 브랜드 컬러 팔레트 (HEX)
- 타이포그래피 스타일
- 비주얼 톤/무드
- DO/DON'T 가이드

### 2. BP 레퍼런스 분석

`references/best_practices/`에 있는 이미지를 분석한다.

```bash
python scripts/analyze_reference.py \
  --dir references/best_practices/ \
  --output _workspace/00_bp_analysis.md \
  --mode bp
```

**산출물:** `_workspace/00_bp_analysis.md`
- 개별 소재 분석
- 공통 패턴 요약
- 재활용 가능한 디자인 패턴

### 3. 레퍼런스 이미지 세트 큐레이션

분석 결과를 바탕으로 이미지 생성 시 함께 입력할 레퍼런스를 선별한다.
- 브랜드 톤 참조: 로고, 기존 소재 중 대표적인 것
- 구도/스타일 참조: BP 중 가장 적합한 것
- 최대 11장 (Gemini 3 Pro Image Preview 제한)

### 4. 이미지 생성 시 레퍼런스 활용

비주얼 디자이너가 이미지 생성 시:
```bash
python scripts/generate_image.py \
  --prompt "프롬프트" \
  --ref references/brand_assets/logo.png references/best_practices/bp_01.png \
  --output "_workspace/images/result.png" \
  --aspect "1:1" --size "2K"
```

`--ref` 파라미터로 레퍼런스 이미지를 전달하면 해당 스타일이 반영된 이미지가 생성된다.
폴더 경로를 지정하면 해당 폴더의 모든 이미지가 레퍼런스로 사용된다.

## 산출물
- `_workspace/00_brand_style_guide.md`
- `_workspace/00_bp_analysis.md`
