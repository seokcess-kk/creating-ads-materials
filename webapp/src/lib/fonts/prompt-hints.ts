// Gemini 이미지 생성 프롬프트에 폰트 스타일을 서술하기 위한 힌트 매핑.
// Gemini는 폰트 파일을 직접 읽지 못하지만, 학습 데이터에서 본 적 있는
// 폰트 family 이름·특성 키워드를 통해 유사 스타일을 재현할 수 있다.
// 정확한 픽셀 재현은 아니며 브랜드 타이포그래피 방향성을 유도하는 용도.

export const FONT_STYLE_HINTS: Record<string, string> = {
  Pretendard:
    "modern geometric sans-serif, optimized for Korean hangul with consistent stroke widths",
  GmarketSans:
    "bold display sans-serif with strong commercial presence, clean geometric",
  Jalnan2:
    "playful bold display, warm and friendly Korean hangul, chunky strokes",
  JalnanGothic:
    "bold slab-like display, strong impact, heavy Korean hangul",
  NanumMyeongjo:
    "classic Korean serif with elegant strokes, traditional refined feel",
  NanumBarunpen:
    "hand-brush style Korean display, soft and warm, slightly casual",
  SCDream:
    "clean geometric sans-serif, readable and versatile, neutral weight distribution",
  CAFE24DANJUNGHAE:
    "decorative Korean display with handwritten feel, casual personal touch",
  "Noto Sans KR":
    "neutral geometric sans-serif, widely readable, standard Korean hangul",
};

// Gemini 이미지 생성은 Bold vs ExtraBold 같은 미세 weight를 잘 구분하지 못한다.
// heavy / medium / light 3단계로 거칠게 묶어 명확하게 전달한다.
function categorizeWeight(weight: string | null | undefined): string {
  if (!weight) return "";
  const lower = weight.toLowerCase();
  if (/extrabold|black|heavy/.test(lower)) return ", heavy impactful weight";
  if (/bold/.test(lower)) return ", heavy weight";
  if (/semibold|medium/.test(lower)) return ", medium weight";
  if (/light|thin/.test(lower)) return ", light weight";
  return ", regular weight";
}

export function describeFontForPrompt(
  family: string,
  weight?: string | null,
): string {
  const base =
    FONT_STYLE_HINTS[family] ?? `${family}-style Korean typeface`;
  return `${base}${categorizeWeight(weight)}`;
}

export interface TypographyHintSource {
  headline?: { family: string; weight?: string | null } | null;
  sub?: { family: string; weight?: string | null } | null;
  cta?: { family: string; weight?: string | null } | null;
}

/**
 * Visual 프롬프트의 Typography 섹션 본문을 생성.
 * headline/sub/cta 역할에 대해 각각 family·weight 기반 서술을 나열한다.
 * 모두 비어있으면 null을 반환 → 호출자가 기본 문구로 fallback.
 */
export function buildTypographyHint(
  src: TypographyHintSource,
): string | null {
  const lines: string[] = [];
  if (src.headline) {
    lines.push(
      `- Headline: ${describeFontForPrompt(src.headline.family, src.headline.weight)}`,
    );
  }
  if (src.sub) {
    lines.push(
      `- Sub copy: ${describeFontForPrompt(src.sub.family, src.sub.weight)}`,
    );
  }
  if (src.cta) {
    lines.push(
      `- CTA button: ${describeFontForPrompt(src.cta.family, src.cta.weight)}`,
    );
  }
  if (lines.length === 0) return null;
  return lines.join("\n");
}
