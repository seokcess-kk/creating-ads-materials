"""
레퍼런스 이미지 분석 스크립트
광고 소재 이미지를 Gemini로 분석하여 스타일 가이드를 자동 생성한다.

사용법:
  # 단일 이미지 분석
  python scripts/analyze_reference.py --image references/best_practices/competitor_01.png

  # 폴더 전체 분석 (BP 폴더)
  python scripts/analyze_reference.py --dir references/best_practices/ --output _workspace/bp_analysis.md

  # 브랜드 에셋 분석
  python scripts/analyze_reference.py --dir references/brand_assets/ --output _workspace/brand_style_guide.md --mode brand
"""

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / ".env")

SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

ANALYSIS_PROMPT_BP = """이 광고 소재 이미지를 전문 광고 디자이너 관점에서 상세히 분석해줘.
다음 항목을 JSON 형식으로 출력해줘:

{
  "color_palette": ["사용된 주요 색상 HEX 코드 목록"],
  "typography": {
    "headline_style": "헤드라인 폰트 스타일 (굵기, 세리프/산세리프)",
    "body_style": "본문 폰트 스타일",
    "cta_style": "CTA 폰트 스타일"
  },
  "layout": {
    "structure": "레이아웃 구조 설명",
    "text_position": "텍스트 배치 위치",
    "image_position": "이미지/비주얼 배치",
    "cta_position": "CTA 위치"
  },
  "mood": ["분위기/톤 키워드들"],
  "composition": "구도 분석",
  "text_content": {
    "headline": "헤드라인 텍스트",
    "sub_copy": "서브 카피",
    "cta": "CTA 텍스트"
  },
  "visual_elements": ["사용된 시각적 요소들 (사진, 일러스트, 아이콘 등)"],
  "strengths": ["강점 목록"],
  "weaknesses": ["약점 목록"],
  "target_audience": ["추정 타겟"],
  "ad_style": "광고 스타일 분류",
  "reusable_patterns": ["다른 소재에 재활용 가능한 디자인 패턴"]
}"""

ANALYSIS_PROMPT_BRAND = """이 브랜드 에셋(로고, 기존 소재, 웹사이트 스크린샷 등)을 분석하여
브랜드 스타일 가이드를 JSON으로 출력해줘:

{
  "brand_colors": {
    "primary": "메인 컬러 HEX",
    "secondary": "서브 컬러 HEX",
    "accent": "액센트 컬러 HEX",
    "background": "배경 컬러 HEX",
    "text": "텍스트 컬러 HEX"
  },
  "typography_style": {
    "headline": "헤드라인 폰트 스타일 추정",
    "body": "본문 폰트 스타일 추정",
    "overall_feel": "타이포그래피 전체 느낌"
  },
  "visual_style": {
    "photography_style": "사진 스타일 (밝기, 톤, 필터)",
    "illustration_style": "일러스트 스타일 (있을 경우)",
    "icon_style": "아이콘 스타일 (있을 경우)"
  },
  "brand_personality": ["브랜드 성격 키워드들"],
  "tone_of_voice": "커뮤니케이션 톤",
  "do": ["이 브랜드에 어울리는 디자인 요소"],
  "dont": ["이 브랜드에 어울리지 않는 디자인 요소"],
  "recommended_ad_style": "광고 제작 시 추천 스타일"
}"""


def get_image_files(path: Path) -> list[Path]:
    """지원되는 이미지 파일 목록을 반환한다."""
    if path.is_file():
        return [path] if path.suffix.lower() in SUPPORTED_EXTS else []
    return sorted(f for f in path.iterdir() if f.suffix.lower() in SUPPORTED_EXTS)


def analyze_image(client: genai.Client, image_path: Path, mode: str) -> dict:
    """단일 이미지를 분석한다."""
    with open(image_path, "rb") as f:
        img_data = f.read()

    mime = f"image/{image_path.suffix.lower().strip('.')}"
    if mime == "image/jpg":
        mime = "image/jpeg"

    prompt = ANALYSIS_PROMPT_BRAND if mode == "brand" else ANALYSIS_PROMPT_BP

    response = client.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=[
            types.Part.from_bytes(data=img_data, mime_type=mime),
            prompt,
        ],
        config=types.GenerateContentConfig(response_modalities=["TEXT"]),
    )

    for part in response.candidates[0].content.parts:
        if part.text:
            text = part.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0]
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {"raw_analysis": text}
    return {}


def generate_bp_report(analyses: list[dict], image_names: list[str]) -> str:
    """BP 분석 결과를 마크다운 리포트로 생성한다."""
    lines = ["# Best Practice 분석 리포트\n"]

    # 개별 소재 분석
    for name, analysis in zip(image_names, analyses):
        lines.append(f"## {name}\n")
        if "raw_analysis" in analysis:
            lines.append(analysis["raw_analysis"])
        else:
            lines.append(f"- **컬러:** {', '.join(analysis.get('color_palette', []))}")
            lines.append(f"- **분위기:** {', '.join(analysis.get('mood', []))}")
            lines.append(f"- **스타일:** {analysis.get('ad_style', 'N/A')}")
            lines.append(f"- **구도:** {analysis.get('composition', 'N/A')}")

            text = analysis.get("text_content", {})
            if text:
                lines.append(f"- **헤드라인:** {text.get('headline', 'N/A')}")

            strengths = analysis.get("strengths", [])
            if strengths:
                lines.append("- **강점:**")
                for s in strengths:
                    lines.append(f"  - {s}")

            patterns = analysis.get("reusable_patterns", [])
            if patterns:
                lines.append("- **재활용 패턴:**")
                for p in patterns:
                    lines.append(f"  - {p}")
        lines.append("")

    # 공통 패턴 요약
    if len(analyses) > 1:
        all_colors = []
        all_moods = []
        all_patterns = []
        for a in analyses:
            all_colors.extend(a.get("color_palette", []))
            all_moods.extend(a.get("mood", []))
            all_patterns.extend(a.get("reusable_patterns", []))

        lines.append("---\n## 공통 패턴 요약\n")
        if all_colors:
            from collections import Counter
            top_colors = Counter(all_colors).most_common(6)
            lines.append("### 자주 사용되는 컬러")
            for color, count in top_colors:
                lines.append(f"- `{color}` ({count}회)")

        if all_moods:
            from collections import Counter
            top_moods = Counter(all_moods).most_common(5)
            lines.append("\n### 공통 분위기")
            for mood, count in top_moods:
                lines.append(f"- {mood} ({count}회)")

        if all_patterns:
            lines.append("\n### 재활용 가능한 디자인 패턴")
            for p in set(all_patterns):
                lines.append(f"- {p}")

    return "\n".join(lines)


def generate_brand_report(analyses: list[dict], image_names: list[str]) -> str:
    """브랜드 스타일 가이드를 마크다운으로 생성한다."""
    lines = ["# 브랜드 스타일 가이드 (자동 생성)\n"]

    for name, analysis in zip(image_names, analyses):
        lines.append(f"## 분석 소스: {name}\n")
        if "raw_analysis" in analysis:
            lines.append(analysis["raw_analysis"])
        else:
            colors = analysis.get("brand_colors", {})
            if colors:
                lines.append("### 브랜드 컬러")
                for role, hex_val in colors.items():
                    lines.append(f"- **{role}:** `{hex_val}`")

            personality = analysis.get("brand_personality", [])
            if personality:
                lines.append(f"\n### 브랜드 성격: {', '.join(personality)}")

            tone = analysis.get("tone_of_voice", "")
            if tone:
                lines.append(f"### 톤앤매너: {tone}")

            do_list = analysis.get("do", [])
            if do_list:
                lines.append("\n### DO (어울리는 요소)")
                for d in do_list:
                    lines.append(f"- {d}")

            dont_list = analysis.get("dont", [])
            if dont_list:
                lines.append("\n### DON'T (어울리지 않는 요소)")
                for d in dont_list:
                    lines.append(f"- {d}")

            rec = analysis.get("recommended_ad_style", "")
            if rec:
                lines.append(f"\n### 추천 광고 스타일: {rec}")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="레퍼런스 이미지 분석")
    parser.add_argument("--image", help="단일 이미지 파일 경로")
    parser.add_argument("--dir", help="이미지 폴더 경로")
    parser.add_argument("--output", help="분석 결과 출력 파일 경로")
    parser.add_argument("--mode", default="bp", choices=["bp", "brand"],
                       help="분석 모드: bp(Best Practice) 또는 brand(브랜드 에셋)")
    args = parser.parse_args()

    if not args.image and not args.dir:
        print("ERROR: --image 또는 --dir 중 하나를 지정하세요.", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: API 키가 설정되지 않았습니다.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    path = Path(args.image or args.dir)
    image_files = get_image_files(path)

    if not image_files:
        print(f"ERROR: {path}에서 이미지 파일을 찾을 수 없습니다.", file=sys.stderr)
        sys.exit(1)

    print(f"분석 모드: {args.mode}")
    print(f"분석 대상: {len(image_files)}개 이미지\n")

    analyses = []
    names = []
    for img in image_files:
        print(f"  분석 중: {img.name}...", end=" ", flush=True)
        try:
            result = analyze_image(client, img, args.mode)
            analyses.append(result)
            names.append(img.name)
            print("완료")
        except Exception as e:
            print(f"실패 ({e})")
            continue

    if not analyses:
        print("ERROR: 분석된 이미지가 없습니다.", file=sys.stderr)
        sys.exit(1)

    if args.mode == "brand":
        report = generate_brand_report(analyses, names)
    else:
        report = generate_bp_report(analyses, names)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report, encoding="utf-8")
        print(f"\n리포트 저장: {args.output}")
    else:
        print("\n" + report)


if __name__ == "__main__":
    main()
