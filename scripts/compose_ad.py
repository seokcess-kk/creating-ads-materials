"""
광고 소재 컴포지터
생성된 배경 이미지 위에 카피, CTA, 브랜드명을 정확하게 합성하여
최종 완성형 광고 소재를 생성한다.

각 텍스트 요소(브랜드, 메인카피, 서브카피, CTA, 슬로건)마다
개별적으로 폰트, 크기, 색상을 지정할 수 있다.

사용법:
  python scripts/compose_ad.py --config config.json
"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# 프로젝트 폰트 디렉토리
FONTS_DIR = Path(__file__).parent.parent / "fonts"

# 기본 폰트 매핑 (굵기별)
DEFAULT_FONTS = {
    "thin": "Pretendard-Thin.otf",
    "extralight": "Pretendard-ExtraLight.otf",
    "light": "Pretendard-Light.otf",
    "regular": "Pretendard-Regular.otf",
    "medium": "Pretendard-Medium.otf",
    "semibold": "Pretendard-SemiBold.otf",
    "bold": "Pretendard-Bold.otf",
    "extrabold": "Pretendard-ExtraBold.otf",
    "black": "Pretendard-Black.otf",
    "gmarket-bold": "GmarketSans-Bold.ttf",
}


def resolve_font(font_spec: str, size: int) -> ImageFont.FreeTypeFont:
    """폰트 스펙을 해석하여 폰트를 로드한다.

    font_spec 형식:
      - 굵기 키워드: "extrabold", "medium", "bold" 등 → DEFAULT_FONTS에서 매핑
      - 파일명: "Pretendard-Bold.otf" → fonts/ 디렉토리에서 검색
      - 전체 경로: "C:/path/to/font.ttf" → 직접 로드
    """
    if not font_spec:
        font_spec = "bold"

    # 1) 굵기 키워드 매핑
    if font_spec.lower() in DEFAULT_FONTS:
        font_file = DEFAULT_FONTS[font_spec.lower()]
        font_path = FONTS_DIR / font_file
        if font_path.exists():
            return ImageFont.truetype(str(font_path), size)

    # 2) fonts/ 디렉토리에서 파일명 검색
    font_path = FONTS_DIR / font_spec
    if font_path.exists():
        return ImageFont.truetype(str(font_path), size)

    # 3) 전체 경로 또는 시스템 폰트
    search_paths = [
        font_spec,
        f"C:/Windows/Fonts/{font_spec}",
    ]
    for path in search_paths:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue

    print(f"WARNING: 폰트 '{font_spec}'을 찾을 수 없어 기본 Pretendard-Bold를 시도합니다.", file=sys.stderr)
    fallback = FONTS_DIR / "Pretendard-Bold.otf"
    if fallback.exists():
        return ImageFont.truetype(str(fallback), size)
    return ImageFont.load_default()


def add_gradient_overlay(image: Image.Image, direction: str = "top", opacity: int = 180) -> Image.Image:
    """이미지에 그라데이션 오버레이를 추가한다."""
    gradient = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(gradient)
    w, h = image.size

    if direction == "top":
        for y in range(h // 3):
            alpha = int(opacity * (1 - y / (h // 3)))
            draw.line([(0, y), (w, y)], fill=(0, 0, 0, alpha))
    elif direction == "bottom":
        start = h * 2 // 3
        for y in range(start, h):
            alpha = int(opacity * ((y - start) / (h - start)))
            draw.line([(0, y), (w, y)], fill=(0, 0, 0, alpha))
    elif direction == "full":
        for y in range(h):
            draw.line([(0, y), (w, y)], fill=(0, 0, 0, opacity))

    return Image.alpha_composite(image.convert("RGBA"), gradient)


def draw_text_with_shadow(
    draw: ImageDraw.Draw,
    position: tuple,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str = "#FFFFFF",
    shadow_color: str = "#000000",
    shadow_offset: int = 2,
    anchor: str = None,
):
    """그림자 효과가 있는 텍스트를 그린다."""
    x, y = position
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=shadow_color, anchor=anchor)
    draw.text((x, y), text, font=font, fill=fill, anchor=anchor)


def compose_ad(config: dict) -> str:
    """설정에 따라 광고 소재를 합성한다."""

    bg_image = Image.open(config["background_image"]).convert("RGBA")
    w, h = bg_image.size

    # 그라데이션 오버레이
    overlay_config = config.get("overlay", {})
    if overlay_config.get("top", True):
        bg_image = add_gradient_overlay(bg_image, "top", overlay_config.get("top_opacity", 160))
    if overlay_config.get("bottom", True):
        bg_image = add_gradient_overlay(bg_image, "bottom", overlay_config.get("bottom_opacity", 200))

    draw = ImageDraw.Draw(bg_image)

    # === 브랜드명 ===
    brand = config.get("brand", {})
    if brand.get("text"):
        font = resolve_font(brand.get("font", "semibold"), int(h * brand.get("size_ratio", 0.025)))
        x = int(w * brand.get("x_ratio", 0.05))
        y = int(h * brand.get("y_ratio", 0.04))
        draw_text_with_shadow(draw, (x, y), brand["text"], font,
                              fill=brand.get("color", "#FFFFFF"), shadow_offset=1)

    # === 메인 카피 ===
    main_copy = config.get("main_copy", {})
    if main_copy.get("text"):
        font = resolve_font(main_copy.get("font", "extrabold"), int(h * main_copy.get("size_ratio", 0.048)))
        lines = main_copy["text"].split("\n")
        y_start = int(h * main_copy.get("y_ratio", 0.08))
        line_spacing = int(h * main_copy.get("line_spacing_ratio", 0.065))

        for i, line in enumerate(lines):
            y_pos = y_start + i * line_spacing
            if main_copy.get("center", True):
                draw_text_with_shadow(draw, (w // 2, y_pos), line, font,
                                      fill=main_copy.get("color", "#FFFFFF"),
                                      shadow_offset=3, anchor="mt")
            else:
                draw_text_with_shadow(draw, (int(w * 0.05), y_pos), line, font,
                                      fill=main_copy.get("color", "#FFFFFF"),
                                      shadow_offset=3)

    # === 서브 카피 ===
    sub_copy = config.get("sub_copy", {})
    if sub_copy.get("text"):
        font = resolve_font(sub_copy.get("font", "medium"), int(h * sub_copy.get("size_ratio", 0.026)))
        y_pos = int(h * sub_copy.get("y_ratio", 0.80))
        if sub_copy.get("center", True):
            draw_text_with_shadow(draw, (w // 2, y_pos), sub_copy["text"], font,
                                  fill=sub_copy.get("color", "#D4AF37"),
                                  shadow_offset=2, anchor="mt")
        else:
            draw_text_with_shadow(draw, (int(w * 0.05), y_pos), sub_copy["text"], font,
                                  fill=sub_copy.get("color", "#D4AF37"),
                                  shadow_offset=2)

    # === CTA 버튼 ===
    cta = config.get("cta", {})
    if cta.get("text"):
        font = resolve_font(cta.get("font", "bold"), int(h * cta.get("size_ratio", 0.028)))
        bbox = font.getbbox(cta["text"])
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        padding_x = int(w * 0.04)
        padding_y = int(h * 0.015)

        btn_w = text_w + padding_x * 2
        btn_h = text_h + padding_y * 2
        btn_x = (w - btn_w) // 2
        btn_y = int(h * cta.get("y_ratio", 0.86))

        btn_color = cta.get("bg_color", "#D4AF37")
        draw.rounded_rectangle((btn_x, btn_y, btn_x + btn_w, btn_y + btn_h),
                               radius=int(btn_h * 0.4), fill=btn_color)

        text_x = btn_x + btn_w // 2
        text_y = btn_y + btn_h // 2
        draw.text((text_x, text_y), cta["text"], font=font,
                  fill=cta.get("text_color", "#1a1a2e"), anchor="mm")

    # === 슬로건 ===
    slogan = config.get("slogan", {})
    if slogan.get("text"):
        font = resolve_font(slogan.get("font", "regular"), int(h * slogan.get("size_ratio", 0.018)))
        y_pos = int(h * slogan.get("y_ratio", 0.94))
        draw.text((w // 2, y_pos), slogan["text"], font=font,
                  fill=slogan.get("color", "#AAAAAA"), anchor="mt")

    # 저장
    output_path = config["output"]
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    bg_image.save(output_path, "PNG")
    final_size = Image.open(output_path).size
    print(f"완성형 소재 저장: {output_path} ({final_size[0]}x{final_size[1]})")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="광고 소재 컴포지터")
    parser.add_argument("--config", required=True, help="JSON 설정 파일 경로")
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        config = json.load(f)

    compose_ad(config)


if __name__ == "__main__":
    main()
