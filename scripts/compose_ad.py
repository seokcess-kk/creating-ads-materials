"""
광고 소재 컴포지터 v2
생성된 배경 이미지 위에 카피, CTA, 브랜드명을 정확하게 합성하여
최종 완성형 광고 소재를 생성한다.

v2 개선사항:
  - 텍스트 자동 줄바꿈 및 길이 기반 폰트 크기 자동 조절
  - 배경 명도 분석 기반 적응형 텍스트 스타일링
  - 채널별 세이프존 자동 적용
  - 적응형 그래디언트 오버레이
  - CTA 버튼 그림자 + 블러 기반 텍스트 그림자

사용법:
  python scripts/compose_ad.py --config config.json
"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat

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

# ── 채널별 세이프존 프리셋 ──
# 각 값은 이미지 크기 대비 비율 (top, right, bottom, left)
CHANNEL_SAFE_ZONES = {
    "ig_feed_square": {"top": 0.05, "right": 0.05, "bottom": 0.06, "left": 0.05},      # 1:1
    "ig_feed_portrait": {"top": 0.05, "right": 0.05, "bottom": 0.06, "left": 0.05},     # 4:5
    "ig_story": {"top": 0.10, "right": 0.06, "bottom": 0.12, "left": 0.06},             # 9:16 상단 프로필/하단 CTA
    "ig_reels": {"top": 0.10, "right": 0.06, "bottom": 0.15, "left": 0.06},             # 9:16 하단 UI 더 넓음
    "fb_feed_square": {"top": 0.04, "right": 0.04, "bottom": 0.05, "left": 0.04},       # 1:1
    "fb_feed_landscape": {"top": 0.04, "right": 0.04, "bottom": 0.05, "left": 0.04},    # 16:9
    "tiktok": {"top": 0.12, "right": 0.06, "bottom": 0.18, "left": 0.06},               # 9:16 하단 UI 가장 넓음
    "gdn_300x250": {"top": 0.04, "right": 0.04, "bottom": 0.04, "left": 0.04},
    "gdn_728x90": {"top": 0.06, "right": 0.03, "bottom": 0.06, "left": 0.03},
}

DEFAULT_SAFE_ZONE = {"top": 0.05, "right": 0.05, "bottom": 0.06, "left": 0.05}


# ════════════════════════════════════════
# 유틸리티
# ════════════════════════════════════════

def resolve_font(font_spec: str, size: int) -> ImageFont.FreeTypeFont:
    """폰트 스펙을 해석하여 폰트를 로드한다."""
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


def analyze_region_brightness(image: Image.Image, region: tuple) -> float:
    """이미지의 특정 영역(x1, y1, x2, y2) 평균 밝기를 0~255로 반환한다."""
    x1, y1, x2, y2 = region
    # 경계 보정
    x1 = max(0, min(x1, image.width - 1))
    y1 = max(0, min(y1, image.height - 1))
    x2 = max(x1 + 1, min(x2, image.width))
    y2 = max(y1 + 1, min(y2, image.height))

    cropped = image.crop((x1, y1, x2, y2)).convert("L")
    stat = ImageStat.Stat(cropped)
    return stat.mean[0]


def get_safe_zone(config: dict, w: int, h: int) -> dict:
    """채널 설정 또는 config에서 세이프존 픽셀값을 계산한다."""
    channel = config.get("channel", "")

    # config에 직접 safe_zone이 있으면 우선 사용
    if "safe_zone" in config:
        sz = config["safe_zone"]
        return {
            "top": int(h * sz.get("top", 0.05)),
            "right": int(w * sz.get("right", 0.05)),
            "bottom": int(h * sz.get("bottom", 0.06)),
            "left": int(w * sz.get("left", 0.05)),
        }

    # 채널 프리셋
    sz = CHANNEL_SAFE_ZONES.get(channel, DEFAULT_SAFE_ZONE)
    return {
        "top": int(h * sz["top"]),
        "right": int(w * sz["right"]),
        "bottom": int(h * sz["bottom"]),
        "left": int(w * sz["left"]),
    }


def auto_wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """텍스트를 max_width에 맞게 자동 줄바꿈한다.
    이미 \\n으로 분리된 줄은 유지하면서, 각 줄이 너무 길면 분리한다.

    분리 우선순위:
      1. 띄어쓰기(어절) 단위로 분리 시도
      2. 띄어쓰기로 불가능하면 글자 단위 폴백
    """
    result_lines = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            result_lines.append("")
            continue

        # 현재 줄이 max_width 이내면 그대로
        bbox = font.getbbox(paragraph)
        if (bbox[2] - bbox[0]) <= max_width:
            result_lines.append(paragraph)
            continue

        # 1차: 띄어쓰기(어절) 단위 분리
        words = paragraph.split(" ")
        word_wrapped = _wrap_by_words(words, font, max_width)
        if word_wrapped is not None:
            result_lines.extend(word_wrapped)
            continue

        # 2차 폴백: 글자 단위 분리
        current_line = ""
        for char in paragraph:
            test_line = current_line + char
            bbox = font.getbbox(test_line)
            if (bbox[2] - bbox[0]) > max_width and current_line:
                result_lines.append(current_line)
                current_line = char
            else:
                current_line = test_line
        if current_line:
            result_lines.append(current_line)

    return result_lines


def _wrap_by_words(words: list[str], font: ImageFont.FreeTypeFont, max_width: int) -> list[str] | None:
    """어절 단위로 줄바꿈을 시도한다. 단일 어절이 max_width를 초과하면 None 반환."""
    lines = []
    current_line = ""

    for word in words:
        # 단일 어절이 너무 길면 어절 분리 불가 → None
        bbox = font.getbbox(word)
        if (bbox[2] - bbox[0]) > max_width:
            return None

        test_line = f"{current_line} {word}".strip() if current_line else word
        bbox = font.getbbox(test_line)
        if (bbox[2] - bbox[0]) > max_width:
            lines.append(current_line)
            current_line = word
        else:
            current_line = test_line

    if current_line:
        lines.append(current_line)
    return lines


def auto_fit_font_size(
    text: str,
    font_spec: str,
    base_size: int,
    max_width: int,
    max_lines: int = 3,
    min_scale: float = 0.6,
) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    """텍스트와 영역에 맞게 폰트 크기를 자동 조절한다.

    기본 크기에서 시작해 max_lines 이내로 줄바꿈 가능할 때까지 축소.
    min_scale 이하로는 줄이지 않는다.
    """
    for scale in [1.0, 0.9, 0.8, 0.7, 0.6]:
        if scale < min_scale:
            break
        size = max(12, int(base_size * scale))
        font = resolve_font(font_spec, size)
        lines = auto_wrap_text(text, font, max_width)
        if len(lines) <= max_lines:
            return font, lines

    # 최소 크기에서도 안 되면 그냥 반환
    size = max(12, int(base_size * min_scale))
    font = resolve_font(font_spec, size)
    lines = auto_wrap_text(text, font, max_width)
    return font, lines


# ════════════════════════════════════════
# 그래디언트 & 이펙트
# ════════════════════════════════════════

def add_adaptive_gradient(
    image: Image.Image,
    direction: str = "top",
    base_opacity: int = 180,
    adaptive: bool = True,
) -> Image.Image:
    """이미지에 적응형 그래디언트 오버레이를 추가한다.

    adaptive=True이면 해당 영역의 밝기를 분석하여:
    - 밝은 영역 → 그래디언트 강하게 (텍스트 가독성 확보)
    - 어두운 영역 → 그래디언트 약하게 (과도한 어둡힘 방지)
    """
    w, h = image.size

    if adaptive:
        if direction == "top":
            region = (0, 0, w, h // 3)
        elif direction == "bottom":
            region = (0, h * 2 // 3, w, h)
        else:
            region = (0, 0, w, h)

        brightness = analyze_region_brightness(image, region)
        # 밝을수록 강한 그래디언트 (0~255 → 0.6~1.4 배율)
        brightness_factor = 0.6 + (brightness / 255) * 0.8
        adjusted_opacity = min(255, int(base_opacity * brightness_factor))
    else:
        adjusted_opacity = base_opacity

    gradient = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(gradient)

    if direction == "top":
        span = h // 3
        for y in range(span):
            alpha = int(adjusted_opacity * (1 - y / span))
            draw.line([(0, y), (w, y)], fill=(0, 0, 0, alpha))
    elif direction == "bottom":
        start = h * 2 // 3
        span = h - start
        for y in range(start, h):
            alpha = int(adjusted_opacity * ((y - start) / span))
            draw.line([(0, y), (w, y)], fill=(0, 0, 0, alpha))
    elif direction == "full":
        for y in range(h):
            draw.line([(0, y), (w, y)], fill=(0, 0, 0, adjusted_opacity))

    return Image.alpha_composite(image.convert("RGBA"), gradient)


def draw_text_blurred_shadow(
    base_image: Image.Image,
    position: tuple,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str = "#FFFFFF",
    shadow_color: str = "#000000",
    shadow_offset: int = 2,
    shadow_blur: int = 4,
    anchor: str = None,
):
    """블러 기반 소프트 그림자가 있는 텍스트를 그린다.

    기존 하드 그림자 대신 가우시안 블러를 적용하여 자연스러운 그림자 효과.
    """
    w, h = base_image.size

    # 그림자 레이어
    shadow_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    sx, sy = position[0] + shadow_offset, position[1] + shadow_offset
    shadow_draw.text((sx, sy), text, font=font, fill=shadow_color, anchor=anchor)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=shadow_blur))

    # 그림자 합성
    base_image.paste(Image.alpha_composite(
        Image.new("RGBA", (w, h), (0, 0, 0, 0)),
        shadow_layer,
    ), (0, 0), shadow_layer)

    # 텍스트 본체
    draw = ImageDraw.Draw(base_image)
    draw.text(position, text, font=font, fill=fill, anchor=anchor)


def choose_text_style(
    image: Image.Image,
    text_region: tuple,
    config_color: str = None,
    config_shadow: str = None,
) -> dict:
    """텍스트가 놓일 영역의 밝기를 분석하여 최적 스타일을 결정한다.

    반환: {"fill": str, "shadow_color": str, "shadow_offset": int, "shadow_blur": int}
    """
    brightness = analyze_region_brightness(image, text_region)

    if brightness > 170:
        # 매우 밝은 배경 → 어두운 텍스트 + 밝은 글로우
        fill = config_color or "#1a1a2e"
        shadow_color = config_shadow or "#FFFFFF"
        shadow_offset = 0
        shadow_blur = 6
    elif brightness > 120:
        # 중간 밝기 → 흰 텍스트 + 강한 어두운 그림자
        fill = config_color or "#FFFFFF"
        shadow_color = config_shadow or "#000000"
        shadow_offset = 3
        shadow_blur = 6
    else:
        # 어두운 배경 → 흰 텍스트 + 약한 그림자
        fill = config_color or "#FFFFFF"
        shadow_color = config_shadow or "#000000"
        shadow_offset = 2
        shadow_blur = 3

    return {
        "fill": fill,
        "shadow_color": shadow_color,
        "shadow_offset": shadow_offset,
        "shadow_blur": shadow_blur,
    }


# ════════════════════════════════════════
# 메인 합성
# ════════════════════════════════════════

def compose_ad(config: dict) -> str:
    """설정에 따라 광고 소재를 합성한다.

    v1과 완전히 하위호환되며, 새로운 옵션이 없으면 기존과 동일하게 동작.
    새 옵션:
      - "channel": 채널명 → 세이프존 자동 적용
      - "safe_zone": {top, right, bottom, left} → 커스텀 세이프존
      - "auto_fit": true → 텍스트 자동 줄바꿈 & 크기 조절
      - "adaptive_style": true → 배경 명도 기반 텍스트 스타일링
      - "adaptive_gradient": true → 배경 명도 기반 그래디언트 강도 조절
      - overlay 내 "adaptive": true → 적응형 그래디언트
      - cta 내 "shadow": true → CTA 버튼 그림자
      - cta 내 "outline": true → CTA 버튼 아웃라인
    """
    bg_image = Image.open(config["background_image"]).convert("RGBA")
    w, h = bg_image.size

    # 세이프존 계산
    sz = get_safe_zone(config, w, h)
    content_left = sz["left"]
    content_right = w - sz["right"]
    content_top = sz["top"]
    content_bottom = h - sz["bottom"]
    content_width = content_right - content_left

    auto_fit = config.get("auto_fit", False)
    adaptive_style = config.get("adaptive_style", False)

    # ── 그래디언트 오버레이 ──
    overlay_config = config.get("overlay", {})
    use_adaptive_gradient = overlay_config.get("adaptive", config.get("adaptive_gradient", False))

    if overlay_config.get("top", True):
        bg_image = add_adaptive_gradient(
            bg_image, "top",
            overlay_config.get("top_opacity", 160),
            adaptive=use_adaptive_gradient,
        )
    if overlay_config.get("bottom", True):
        bg_image = add_adaptive_gradient(
            bg_image, "bottom",
            overlay_config.get("bottom_opacity", 200),
            adaptive=use_adaptive_gradient,
        )

    # ── 브랜드명 ──
    brand = config.get("brand", {})
    brand_bottom_y = content_top  # 브랜드 텍스트 하단 y좌표 (메인카피 시작점 계산용)
    if brand.get("text"):
        font_size = int(h * brand.get("size_ratio", 0.025))
        font = resolve_font(brand.get("font", "semibold"), font_size)
        x = int(w * brand.get("x_ratio", 0.05))
        y = int(h * brand.get("y_ratio", 0.04))

        # 세이프존 내로 보정
        x = max(x, content_left)
        y = max(y, content_top)

        bbox = font.getbbox(brand["text"])
        text_h = bbox[3] - bbox[1]
        brand_bottom_y = y + text_h + int(h * 0.015)  # 브랜드 아래 여백

        if adaptive_style:
            text_w = bbox[2] - bbox[0]
            style = choose_text_style(bg_image, (x, y, x + text_w, y + text_h),
                                      config_color=brand.get("color"))
            draw_text_blurred_shadow(bg_image, (x, y), brand["text"], font, **style)
        else:
            draw_text_blurred_shadow(
                bg_image, (x, y), brand["text"], font,
                fill=brand.get("color", "#FFFFFF"),
                shadow_color="#000000", shadow_offset=1, shadow_blur=3,
            )

    # ── 메인 카피 ──
    main_copy = config.get("main_copy", {})
    if main_copy.get("text"):
        base_size = int(h * main_copy.get("size_ratio", 0.048))
        font_spec = main_copy.get("font", "extrabold")
        y_start = int(h * main_copy.get("y_ratio", 0.08))
        # 브랜드 텍스트 아래로 밀림 보정
        y_start = max(y_start, content_top, brand_bottom_y)
        line_spacing_ratio = main_copy.get("line_spacing_ratio", 0.065)
        is_center = main_copy.get("center", True)

        if auto_fit:
            max_text_width = int(content_width * 0.9)
            font, lines = auto_fit_font_size(
                main_copy["text"], font_spec, base_size,
                max_width=max_text_width,
                max_lines=main_copy.get("max_lines", 3),
            )
        else:
            font = resolve_font(font_spec, base_size)
            lines = main_copy["text"].split("\n")

        line_spacing = int(h * line_spacing_ratio)

        for i, line in enumerate(lines):
            y_pos = y_start + i * line_spacing

            if is_center:
                text_x = w // 2
                anchor = "mt"
            else:
                text_x = content_left
                anchor = None

            if adaptive_style:
                bbox = font.getbbox(line)
                text_w = bbox[2] - bbox[0]
                text_h = bbox[3] - bbox[1]
                if is_center:
                    region = (w // 2 - text_w // 2, y_pos, w // 2 + text_w // 2, y_pos + text_h)
                else:
                    region = (text_x, y_pos, text_x + text_w, y_pos + text_h)
                style = choose_text_style(bg_image, region,
                                          config_color=main_copy.get("color"))
                draw_text_blurred_shadow(bg_image, (text_x, y_pos), line, font,
                                         anchor=anchor, **style)
            else:
                draw_text_blurred_shadow(
                    bg_image, (text_x, y_pos), line, font,
                    fill=main_copy.get("color", "#FFFFFF"),
                    shadow_color="#000000", shadow_offset=3, shadow_blur=5,
                    anchor=anchor,
                )

    # ── 서브 카피 ──
    sub_copy = config.get("sub_copy", {})
    if sub_copy.get("text"):
        base_size = int(h * sub_copy.get("size_ratio", 0.026))
        font_spec = sub_copy.get("font", "medium")
        is_center = sub_copy.get("center", True)
        y_pos = int(h * sub_copy.get("y_ratio", 0.80))

        if auto_fit:
            max_text_width = int(content_width * 0.9)
            font, lines = auto_fit_font_size(
                sub_copy["text"], font_spec, base_size,
                max_width=max_text_width,
                max_lines=sub_copy.get("max_lines", 2),
            )
        else:
            font = resolve_font(font_spec, base_size)
            lines = sub_copy["text"].split("\n")

        sub_line_spacing = int(base_size * 1.5)

        for i, line in enumerate(lines):
            ly = y_pos + i * sub_line_spacing
            if is_center:
                text_x, anchor = w // 2, "mt"
            else:
                text_x, anchor = content_left, None

            if adaptive_style:
                bbox = font.getbbox(line)
                text_w = bbox[2] - bbox[0]
                text_h = bbox[3] - bbox[1]
                if is_center:
                    region = (w // 2 - text_w // 2, ly, w // 2 + text_w // 2, ly + text_h)
                else:
                    region = (text_x, ly, text_x + text_w, ly + text_h)
                style = choose_text_style(bg_image, region,
                                          config_color=sub_copy.get("color"))
                draw_text_blurred_shadow(bg_image, (text_x, ly), line, font,
                                         anchor=anchor, **style)
            else:
                draw_text_blurred_shadow(
                    bg_image, (text_x, ly), line, font,
                    fill=sub_copy.get("color", "#D4AF37"),
                    shadow_color="#000000", shadow_offset=2, shadow_blur=4,
                    anchor=anchor,
                )

    # ── CTA 버튼 ──
    cta = config.get("cta", {})
    if cta.get("text"):
        font_size = int(h * cta.get("size_ratio", 0.028))
        font = resolve_font(cta.get("font", "bold"), font_size)
        bbox = font.getbbox(cta["text"])
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        padding_x = int(w * 0.04)
        padding_y = int(h * 0.015)

        btn_w = text_w + padding_x * 2
        btn_h = text_h + padding_y * 2
        btn_x = (w - btn_w) // 2
        btn_y = int(h * cta.get("y_ratio", 0.86))

        # 세이프존 내로 보정
        btn_y = min(btn_y, content_bottom - btn_h)

        btn_color = cta.get("bg_color", "#D4AF37")
        use_shadow = cta.get("shadow", True)
        use_outline = cta.get("outline", False)

        # CTA 버튼 그림자
        if use_shadow:
            shadow_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            shadow_draw = ImageDraw.Draw(shadow_layer)
            shadow_draw.rounded_rectangle(
                (btn_x + 2, btn_y + 3, btn_x + btn_w + 2, btn_y + btn_h + 3),
                radius=int(btn_h * 0.4),
                fill=(0, 0, 0, 80),
            )
            shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=4))
            bg_image = Image.alpha_composite(bg_image, shadow_layer)

        draw = ImageDraw.Draw(bg_image)

        # 버튼 본체
        draw.rounded_rectangle(
            (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h),
            radius=int(btn_h * 0.4),
            fill=btn_color,
        )

        # 아웃라인
        if use_outline:
            outline_color = cta.get("outline_color", "#FFFFFF")
            draw.rounded_rectangle(
                (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h),
                radius=int(btn_h * 0.4),
                outline=outline_color,
                width=2,
            )

        # CTA 텍스트
        text_x = btn_x + btn_w // 2
        text_y = btn_y + btn_h // 2
        draw.text(
            (text_x, text_y), cta["text"], font=font,
            fill=cta.get("text_color", "#1a1a2e"), anchor="mm",
        )

    # ── 슬로건 ──
    slogan = config.get("slogan", {})
    if slogan.get("text"):
        font_size = int(h * slogan.get("size_ratio", 0.018))
        font = resolve_font(slogan.get("font", "regular"), font_size)
        y_pos = int(h * slogan.get("y_ratio", 0.94))
        # 세이프존 내로 보정
        y_pos = min(y_pos, content_bottom - font_size)

        draw = ImageDraw.Draw(bg_image)
        draw.text(
            (w // 2, y_pos), slogan["text"], font=font,
            fill=slogan.get("color", "#AAAAAA"), anchor="mt",
        )

    # ── 저장 ──
    output_path = config["output"]
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    bg_image.save(output_path, "PNG")
    final_size = Image.open(output_path).size
    print(f"완성형 소재 저장: {output_path} ({final_size[0]}x{final_size[1]})")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="광고 소재 컴포지터 v2")
    parser.add_argument("--config", required=True, help="JSON 설정 파일 경로")
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        config = json.load(f)

    compose_ad(config)


if __name__ == "__main__":
    main()
