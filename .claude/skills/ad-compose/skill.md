---
name: ad-compose
description: "광고 소재 최종 합성 스킬. 카피 텍스트와 배경 이미지를 결합하여 바로 업로드 가능한 완성형 광고 소재를 생성한다. Gemini 텍스트 렌더링과 Python 컴포지터 두 방식을 지원. '소재 합성', '최종 소재', '완성형', '텍스트 오버레이', '소재 완성' 요청 시 반드시 이 스킬을 사용할 것."
---

# Ad Compose

카피와 배경 이미지를 합성하여 최종 완성형 광고 소재를 생성한다.

## 방식 A: Gemini 텍스트 렌더링

`scripts/generate_image.py`로 텍스트가 포함된 완성형 이미지를 한 번에 생성한다.

### 프롬프트 작성 가이드

광고 디자인 전체를 하나의 장면으로 서술한다:

```
A polished [채널] advertisement for [브랜드명]. 
The design features [배경 색상/스타일] with [이미지 내용 설명].
At the top, [브랜드명 위치와 스타일].
Large bold Korean text reads '[메인 카피]' in [폰트 스타일과 색상].
Below, smaller text reads '[서브 카피]' in [색상].
A [CTA 버튼 설명] with the text '[CTA 텍스트]'.
The overall design is [톤앤매너], resembling a professional social media ad.
```

### 실행
```bash
python scripts/generate_image.py \
  --prompt "위의 서술식 프롬프트" \
  --output "_workspace/images/final/{파일명}.png" \
  --aspect "1:1" --size "2K"
```

## 방식 B: Python 컴포지터

`scripts/compose_ad.py`로 배경 이미지 위에 텍스트를 정밀 오버레이한다.

### 설정 파일 작성
JSON 설정 파일을 `_workspace/` 에 작성한다:

```json
{
  "background_image": "배경 이미지 경로",
  "output": "출력 경로",
  "bold_font": "malgunbd.ttf",
  "regular_font": "malgun.ttf",
  "overlay": {
    "top": true, "top_opacity": 180,
    "bottom": true, "bottom_opacity": 220
  },
  "brand": { "text": "브랜드명", "color": "#FFFFFF", "size_ratio": 0.022 },
  "main_copy": {
    "text": "메인 카피\n(줄바꿈 가능)",
    "color": "#FFFFFF",
    "size_ratio": 0.048,
    "y_ratio": 0.06,
    "line_spacing_ratio": 0.065,
    "center": true
  },
  "sub_copy": {
    "text": "서브 카피",
    "color": "#D4AF37",
    "size_ratio": 0.026,
    "y_ratio": 0.80,
    "center": true
  },
  "cta": {
    "text": "CTA 텍스트",
    "bg_color": "#D4AF37",
    "text_color": "#1a1a2e",
    "size_ratio": 0.026,
    "y_ratio": 0.86
  },
  "slogan": {
    "text": "슬로건",
    "color": "#999999",
    "size_ratio": 0.018,
    "y_ratio": 0.94
  }
}
```

### 주요 파라미터
- `size_ratio`: 이미지 높이 대비 폰트 크기 비율 (0.05 = 5%)
- `y_ratio`: 이미지 높이 대비 Y 위치 (0.0 = 최상단, 1.0 = 최하단)
- `overlay.top_opacity`: 상단 그라데이션 불투명도 (0-255)
- `center`: true면 가로 중앙 정렬

### 실행
```bash
python scripts/compose_ad.py --config "_workspace/설정파일.json"
```

## 방식 선택 기준

| 상황 | 추천 방식 |
|------|----------|
| 콘셉트 시안, 다양한 레이아웃 탐색 | A (Gemini) |
| 카드형/그래픽형 디자인 | A (Gemini) |
| 브랜드 일관성 중요, 대량 생산 | B (Python) |
| 동일 배경 + 카피 변형 A/B 테스트 | B (Python) |
| 한 번에 최고 퀄리티 | A (Gemini) |

## 산출물
`_workspace/images/final/` 디렉토리에 완성형 소재 저장.
파일명: `final_{channel}_{variation}.png`
