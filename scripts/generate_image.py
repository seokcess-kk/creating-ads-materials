"""
광고 소재 이미지 생성 스크립트
Gemini 3 Pro Image Preview (Nano Banana Pro) 모델을 사용하여 이미지를 생성한다.
레퍼런스 이미지를 함께 입력하여 스타일 전이가 가능하다. (최대 11장)

사용법:
  # 기본 생성
  python scripts/generate_image.py --prompt "프롬프트" --output "출력경로.png"

  # 레퍼런스 이미지 기반 생성
  python scripts/generate_image.py --prompt "이 레퍼런스들의 스타일로 새 광고 이미지를 생성해줘. 장면: ..." \
    --ref references/best_practices/bp_01.png references/brand_assets/logo.png \
    --output "출력경로.png" --aspect "1:1" --size "2K"

환경변수:
  GEMINI_API_KEY 또는 GOOGLE_API_KEY: Google AI Studio API 키
"""

import argparse
import glob
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
import io

load_dotenv(Path(__file__).parent.parent / ".env")

SUPPORTED_RATIOS = [
    "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
    "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
]

MAX_REFERENCES = 11  # Gemini 3 Pro Image Preview 최대 레퍼런스 수


def generate_image(
    prompt: str,
    output_path: str,
    aspect_ratio: str = "1:1",
    image_size: str = "2K",
    reference_images: list[str] | None = None,
) -> str:
    """Gemini 모델로 이미지를 생성하고 파일로 저장한다."""

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY 또는 GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    # 콘텐츠 구성: 레퍼런스 이미지 + 프롬프트
    contents = []

    if reference_images:
        ref_count = min(len(reference_images), MAX_REFERENCES)
        print(f"레퍼런스 이미지: {ref_count}장")
        for ref_path in reference_images[:ref_count]:
            ref = Path(ref_path)
            if not ref.exists():
                print(f"  WARNING: {ref_path} 파일을 찾을 수 없어 건너뜁니다.", file=sys.stderr)
                continue
            with open(ref, "rb") as f:
                ref_data = f.read()
            mime = f"image/{ref.suffix.lower().strip('.')}"
            if mime == "image/jpg":
                mime = "image/jpeg"
            contents.append(types.Part.from_bytes(data=ref_data, mime_type=mime))
            print(f"  로드: {ref.name}")

    contents.append(prompt)

    print(f"프롬프트: {prompt[:100]}...")
    print(f"비율: {aspect_ratio} | 해상도: {image_size}")
    print("이미지 생성 중...")

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    response = client.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio=aspect_ratio,
                image_size=image_size,
            ),
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data and part.inline_data.mime_type.startswith("image/"):
            image_data = part.inline_data.data
            image = Image.open(io.BytesIO(image_data))
            image.save(str(output))
            print(f"이미지 저장 완료: {output_path} ({image.size[0]}x{image.size[1]})")
            return str(output)

    print("ERROR: 이미지 생성에 실패했습니다.", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Gemini API로 광고 이미지 생성")
    parser.add_argument("--prompt", required=True, help="이미지 생성 프롬프트")
    parser.add_argument("--output", required=True, help="출력 파일 경로")
    parser.add_argument("--aspect", default="1:1", choices=SUPPORTED_RATIOS,
                       help="이미지 비율 (기본: 1:1)")
    parser.add_argument("--size", default="2K", choices=["1K", "2K", "4K"],
                       help="이미지 해상도 (기본: 2K)")
    parser.add_argument("--ref", nargs="*", default=[],
                       help="레퍼런스 이미지 경로 (최대 11장). 폴더 경로도 가능")

    args = parser.parse_args()

    # 레퍼런스 경로 확장 (폴더면 내부 이미지 전체)
    ref_files = []
    for ref in args.ref:
        p = Path(ref)
        if p.is_dir():
            for ext in ("*.png", "*.jpg", "*.jpeg", "*.webp"):
                ref_files.extend(str(f) for f in sorted(p.glob(ext)))
        elif p.exists():
            ref_files.append(str(p))

    generate_image(args.prompt, args.output, args.aspect, args.size, ref_files or None)


if __name__ == "__main__":
    main()
