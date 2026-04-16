"""
광고 소재 이미지 생성 스크립트
Gemini 3 Pro Image Preview (Nano Banana Pro) 모델을 사용하여 이미지를 생성한다.

사용법:
  python scripts/generate_image.py --prompt "your prompt here" --output "_workspace/images/output.png"
  python scripts/generate_image.py --prompt "your prompt here" --output "_workspace/images/output.png" --aspect "9:16" --size "2K"

환경변수:
  GEMINI_API_KEY 또는 GOOGLE_API_KEY: Google AI Studio API 키
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
import io

# 프로젝트 루트의 .env 파일에서 환경변수 로드
load_dotenv(Path(__file__).parent.parent / ".env")

# 지원되는 aspect ratio 목록
SUPPORTED_RATIOS = [
    "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
    "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
]


def generate_image(
    prompt: str,
    output_path: str,
    aspect_ratio: str = "1:1",
    image_size: str = "2K",
) -> str:
    """Gemini 모델로 이미지를 생성하고 파일로 저장한다."""

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY 또는 GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.", file=sys.stderr)
        print("설정 방법: .env 파일에 GEMINI_API_KEY=your-key 추가", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    print(f"프롬프트: {prompt[:100]}...")
    print(f"비율: {aspect_ratio} | 해상도: {image_size}")
    print("이미지 생성 중...")

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    # Gemini 3 Pro Image Preview 모델로 이미지 생성
    # aspect_ratio와 image_size는 반드시 image_config에 지정해야 적용된다
    response = client.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=prompt,
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

    print("ERROR: 이미지 생성에 실패했습니다. 응답에 이미지가 포함되지 않았습니다.", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Gemini API로 광고 이미지 생성")
    parser.add_argument("--prompt", required=True, help="이미지 생성 프롬프트 (장면 서술식 권장)")
    parser.add_argument("--output", required=True, help="출력 파일 경로 (예: _workspace/images/ad_v1.png)")
    parser.add_argument("--aspect", default="1:1",
                       choices=SUPPORTED_RATIOS,
                       help="이미지 비율 (기본: 1:1)")
    parser.add_argument("--size", default="2K",
                       choices=["1K", "2K", "4K"],
                       help="이미지 해상도 (기본: 2K, 대문자 K 필수)")

    args = parser.parse_args()
    generate_image(args.prompt, args.output, args.aspect, args.size)


if __name__ == "__main__":
    main()
