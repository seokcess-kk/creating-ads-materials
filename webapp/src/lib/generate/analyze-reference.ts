import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import { fetchAsBase64 } from "@/lib/utils/image-fetch";
import sharp from "sharp";
import type { UsageContext } from "@/lib/usage/record";
import type { DesignReference } from "./types";

const TOOL = "record_design_reference";

const bounded = (min: number, max: number) =>
  z.number().finite().transform((value) => Math.min(max, Math.max(min, value)));
const clipped = (max: number) => z.string().transform((value) => value.slice(0, max));

const fontCategoryProperty = {
  type: "string",
  enum: ["sans", "serif", "rounded", "display", "handwriting"],
  description:
    "가장 가까운 한글 폰트 카테고리: sans, serif, rounded, display, handwriting 중 하나.",
} as const;

const fontFamilyProperty = {
  type: "string",
  enum: [
    "pretendard", "suit", "spoqa-han-sans-neo", "scdream", "gmarket-sans",
    "jalnan-gothic", "jalnan2", "nanum-square-round", "nanum-myeongjo",
    "nanum-barunpen", "cafe24-danjunghae",
  ],
  description:
    "레퍼런스 글자 형태와 가장 가까운 설치 한글 폰트. 본문형 고딕=pretendard/suit/spoqa-han-sans-neo, 기하학·제목=gmarket-sans, 매우 굵고 개성적=jalnan-gothic/jalnan2, 둥근=nanum-square-round, 명조=nanum-myeongjo, 손글씨=nanum-barunpen/cafe24-danjunghae.",
} as const;

const typographyProperty = {
  type: "object",
  description: "레퍼런스 캔버스에서 관찰한 주 카피와 보조 카피의 정규화된 타이포 측정값.",
  properties: {
    alignment: { type: "string", enum: ["left", "center", "right"] },
    headlineSizeRatio: { type: "number", description: "헤드라인 글자 높이 / 이미지 높이 (0~1)" },
    headlineYRatio: { type: "number", description: "첫 헤드라인 baseline Y / 이미지 높이 (0~1)" },
    headlineMaxWidthRatio: { type: "number", description: "헤드라인 텍스트 블록 너비 / 이미지 너비 (0~1)" },
    headlineLineHeight: { type: "number", description: "행간 / 글자 크기 (보통 0.9~1.8)" },
    headlineColor: { type: "string", description: "헤드라인 색상 hex" },
    headlineWeight: { type: "string", enum: ["regular", "medium", "bold", "black"] },
    subSizeRatio: { type: "number", description: "보조문구 글자 높이 / 이미지 높이" },
    subYRatio: { type: "number", description: "보조문구 첫 baseline Y / 이미지 높이" },
    subMaxWidthRatio: { type: "number", description: "보조문구 블록 너비 / 이미지 너비" },
    subColor: { type: "string", description: "보조문구 색상 hex" },
    hasStrokeOrShadow: { type: "boolean" },
  },
  required: [
    "alignment", "headlineSizeRatio", "headlineYRatio", "headlineMaxWidthRatio",
    "headlineLineHeight", "headlineColor", "headlineWeight", "hasStrokeOrShadow",
  ],
} as const;

const textLayersProperty = {
  type: "array",
  maxItems: 8,
  description:
    "광고의 텍스트 블록을 의미 역할별로 분해한 레이아웃. 원문 문구는 기록하지 말고 eyebrow/headline/price/sub/badge/legal/footer 역할과 시각 속성만 기록.",
  items: {
    type: "object",
    properties: {
      role: { type: "string", enum: ["eyebrow", "headline", "price", "sub", "badge", "legal", "footer"] },
      xRatio: { type: "number", description: "블록 기준점 X / 이미지 너비" },
      yRatio: { type: "number", description: "첫 baseline Y / 이미지 높이" },
      widthRatio: { type: "number", description: "텍스트 블록 최대 너비 / 이미지 너비" },
      sizeRatio: { type: "number", description: "글자 크기 / 이미지 높이" },
      lineHeight: { type: "number", description: "행간 / 글자 크기" },
      align: { type: "string", enum: ["left", "center", "right"] },
      color: { type: "string", description: "주 색상 hex" },
      gradientEndColor: { type: "string", description: "그라디언트 글자인 경우 끝 색상 hex" },
      weight: { type: "string", enum: ["regular", "medium", "bold", "black"] },
      maxLines: { type: "integer", minimum: 1, maximum: 4 },
      strokeColor: { type: "string", description: "실제로 외곽선이 보일 때만 hex/rgba" },
      backgroundColor: { type: "string", description: "배지·하단 띠 등 블록 배경색 hex/rgba" },
      cornerRadiusRatio: { type: "number", description: "배경 모서리 반경 / 이미지 높이" },
    },
    required: ["role", "xRatio", "yRatio", "widthRatio", "sizeRatio", "lineHeight", "align", "color", "weight", "maxLines"],
  },
} as const;

// 상한은 넉넉히 — 모델 서술이 길어도 파싱 실패하지 않도록(디스크립터는 프롬프트로 주입).
export const DesignReferenceSchema = z.object({
  analysisVersion: z.literal(2).optional(),
  palette: z.array(clipped(40)).transform((values) => values.slice(0, 8)),
  mood: clipped(200),
  composition: clipped(300),
  layout: clipped(300),
  typographyVibe: clipped(200),
  fontCategory: z
    .enum(["sans", "serif", "rounded", "display", "handwriting"])
    .optional(),
  fontFamily: z.enum([
    "pretendard", "suit", "spoqa-han-sans-neo", "scdream", "gmarket-sans",
    "jalnan-gothic", "jalnan2", "nanum-square-round", "nanum-myeongjo",
    "nanum-barunpen", "cafe24-danjunghae",
  ]).optional(),
  typography: z.object({
    alignment: z.enum(["left", "center", "right"]),
    headlineSizeRatio: bounded(0.015, 0.3),
    headlineYRatio: bounded(0, 1),
    headlineMaxWidthRatio: bounded(0.2, 1),
    headlineLineHeight: bounded(0.8, 2),
    headlineColor: clipped(40),
    headlineWeight: z.enum(["regular", "medium", "bold", "black"]),
    subSizeRatio: bounded(0.01, 0.2).optional(),
    subYRatio: bounded(0, 1).optional(),
    subMaxWidthRatio: bounded(0.2, 1).optional(),
    subColor: clipped(40).optional(),
    hasStrokeOrShadow: z.boolean().optional(),
  }).optional(),
  textLayers: z.array(z.object({
    role: z.enum(["eyebrow", "headline", "price", "sub", "badge", "legal", "footer"]),
    xRatio: bounded(0, 1),
    yRatio: bounded(0, 1),
    widthRatio: bounded(0.1, 1),
    sizeRatio: bounded(0.01, 0.35),
    lineHeight: bounded(0.8, 2),
    align: z.enum(["left", "center", "right"]),
    color: clipped(40),
    gradientEndColor: clipped(40).optional(),
    weight: z.enum(["regular", "medium", "bold", "black"]),
    maxLines: bounded(1, 4).transform(Math.round),
    strokeColor: clipped(60).optional(),
    backgroundColor: clipped(60).optional(),
    cornerRadiusRatio: bounded(0, 0.2).optional(),
  })).transform((values) => values.slice(0, 8)).optional(),
  // 클라이언트를 오간 분석 결과가 route 파싱에서 출처 플래그를 잃지 않도록 스키마에 포함.
  textLayersMeasured: z.boolean().optional(),
  notes: clipped(400).optional(),
});

/** 정밀 분석 + (선택) 컨셉 초안. 하나의 도구로 업로드 초안·서버 재분석을 모두 처리한다. */
const ReferenceDraftSchema = DesignReferenceSchema.extend({
  conceptDraft: clipped(400).optional(),
});

/**
 * 정밀 분석 도구 — 컨셉 초안을 요청하는 호출(업로드 직후)에서는 conceptDraft를 필수로
 * 강제한다(선택 필드로 두면 모델이 자주 생략 → 초안이 사용자 메시지로 대체되는 버그).
 */
function analysisTool(wantConcept: boolean): Tool {
  return {
    name: TOOL,
    description:
      "레퍼런스 이미지에서 재현 가능한 '디자인 요소'만 추출. 콘텐츠/문구가 아니라 색·무드·구도·레이아웃·타이포 느낌. 요청 시 새 광고의 컨셉 초안도 함께.",
    input_schema: {
      type: "object",
      properties: {
        conceptDraft: {
          type: "string",
          description:
            "이 레퍼런스의 디자인을 차용해 새로 만들 광고의 '비주얼 장면' 묘사(한국어 1~2문장: 장면·소재·분위기·피사체). 사용자 메시지/카피 문구를 그대로 반복하지 말 것 — 장면을 그려라.",
        },
        palette: {
          type: "array",
          items: { type: "string" },
          description: "주요 색 3~6개. 반드시 hex 코드로(예: #1A2B3C). 색 추출·스킴 판정에 직접 쓰이므로 색 이름 금지.",
        },
        mood: { type: "string", description: "전체 무드/톤 한 줄" },
        composition: { type: "string", description: "구도/시선 흐름/여백 특징" },
        layout: { type: "string", description: "요소 배치/정렬/그리드 특징" },
        typographyVibe: { type: "string", description: "타이포 느낌(있다면)" },
        fontCategory: fontCategoryProperty,
        fontFamily: fontFamilyProperty,
        typography: typographyProperty,
        textLayers: textLayersProperty,
        notes: { type: "string", description: "재현에 도움되는 기타 메모(선택)" },
      },
      required: [
        ...(wantConcept ? ["conceptDraft"] : []),
        "palette", "mood", "composition", "layout", "typographyVibe",
      ],
    },
  };
}

const CORE_TOOL = "record_reference_core";
const ReferenceCoreSchema = z.object({
  conceptDraft: clipped(400).optional(),
  mood: clipped(200),
  composition: clipped(300),
  layout: clipped(300),
  typographyVibe: clipped(200),
  fontCategory: z.enum(["sans", "serif", "rounded", "display", "handwriting"]).optional(),
  fontFamily: DesignReferenceSchema.shape.fontFamily,
  density: z.enum(["compact", "balanced", "airy"]),
  alignment: z.enum(["left", "center", "right"]),
  roles: z.array(z.enum(["eyebrow", "headline", "price", "sub", "badge", "legal", "footer"]))
    .transform((values) => [...new Set(values)].slice(0, 8)),
});

function coreTool(wantConcept: boolean): Tool {
  return {
    name: CORE_TOOL,
    description: "정밀 좌표 분석 실패 시 사용하는 광고 레퍼런스 핵심 구조 기록.",
    input_schema: {
      type: "object",
      properties: {
        conceptDraft: {
          type: "string",
          description:
            "새 광고의 '비주얼 장면' 묘사(한국어 1~2문장: 장면·소재·분위기). 사용자 메시지 문구를 그대로 반복하지 말 것.",
        },
        mood: { type: "string" },
        composition: { type: "string" },
        layout: { type: "string" },
        typographyVibe: { type: "string" },
        fontCategory: fontCategoryProperty,
        fontFamily: fontFamilyProperty,
        density: { type: "string", enum: ["compact", "balanced", "airy"] },
        alignment: { type: "string", enum: ["left", "center", "right"] },
        roles: {
          type: "array",
          items: { type: "string", enum: ["eyebrow", "headline", "price", "sub", "badge", "legal", "footer"] },
        },
      },
      required: [
        ...(wantConcept ? ["conceptDraft"] : []),
        "mood", "composition", "layout", "typographyVibe", "density", "alignment", "roles",
      ],
    },
  };
}

function fallbackLayers(
  roles: z.infer<typeof ReferenceCoreSchema>["roles"],
  density: z.infer<typeof ReferenceCoreSchema>["density"],
  align: "left" | "center" | "right",
  palette: string[],
): NonNullable<DesignReference["textLayers"]> {
  const x = align === "left" ? 0.06 : align === "right" ? 0.94 : 0.5;
  const foreground = palette.find((color) => color === "#FFFFFF") ?? "#FFFFFF";
  const accent = palette.find((color) => color !== foreground) ?? "#FFD600";
  const compact = density === "compact";
  const presets = {
    legal: [0.04, 0.018, 0.72, 1],
    eyebrow: [0.12, 0.045, 0.68, 1],
    headline: [compact ? 0.28 : 0.34, compact ? 0.13 : 0.1, 0.78, 2],
    sub: [compact ? 0.48 : 0.55, 0.045, 0.72, 2],
    price: [compact ? 0.68 : 0.72, compact ? 0.16 : 0.13, 0.78, 1],
    badge: [0.78, 0.04, 0.36, 1],
    footer: [0.92, 0.055, 0.9, 1],
  } satisfies Record<string, [number, number, number, number]>;
  return roles.map((role) => {
    const [yRatio, sizeRatio, widthRatio, maxLines] = presets[role];
    const isAccent = role === "headline" || role === "price";
    return {
      role,
      xRatio: role === "footer" ? 0.5 : x,
      yRatio,
      widthRatio,
      sizeRatio,
      lineHeight: 1.08,
      align: role === "footer" ? "center" as const : align,
      color: isAccent ? accent : foreground,
      weight: role === "legal" ? "regular" as const : role === "sub" ? "medium" as const : "black" as const,
      maxLines,
    };
  });
}

type Media = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
function mediaType(m: string): Media {
  return m === "image/jpeg" || m === "image/png" || m === "image/gif" || m === "image/webp"
    ? m
    : "image/png";
}

function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** 모델의 색상 서술과 무관하게 레퍼런스 픽셀에서 주요·강조색을 결정적으로 추출한다. */
export async function extractPixelPalette(image: Buffer, count = 6): Promise<string[]> {
  const { data, info } = await sharp(image)
    .resize(72, 72, { fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buckets = new Map<number, { count: number; r: number; g: number; b: number; saturation: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max ? (max - min) / max : 0;
    const item = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, saturation: 0 };
    item.count++;
    item.r += r;
    item.g += g;
    item.b += b;
    item.saturation += saturation;
    buckets.set(key, item);
  }
  const candidates = [...buckets.values()]
    .map((item) => ({
      rgb: [item.r / item.count, item.g / item.count, item.b / item.count] as [number, number, number],
      score: item.count * (1 + (item.saturation / item.count) * 0.85),
    }))
    .sort((a, b) => b.score - a.score);
  const selected: Array<[number, number, number]> = [];
  for (const candidate of candidates) {
    if (selected.every((color) => rgbDistance(color, candidate.rgb) >= 46)) selected.push(candidate.rgb);
    if (selected.length >= count) break;
  }
  return selected.map(([r, g, b]) =>
    `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`,
  );
}

interface AnalyzeOptions {
  /** 컨셉 초안도 요청(업로드 직후 흐름). 핵심 메시지·브랜드가 있으면 초안에 반영. */
  concept?: {
    keyMessage?: string | null;
    brandName?: string | null;
    brandCategory?: string | null;
  } | null;
}

interface AnalyzeResult {
  design: DesignReference;
  conceptDraft: string | null;
}

/** 컨셉 초안 요청 문구 — 장면 묘사를 요구하고, 메시지 문구 에코를 명시적으로 금지한다. */
function buildConceptAsk(concept: NonNullable<AnalyzeOptions["concept"]>): string {
  const key = concept.keyMessage?.trim()
    ? `\n사용자 핵심 메시지(맥락 참고용 — 이 문구를 conceptDraft에 그대로 옮기지 말 것): ${concept.keyMessage.trim()}`
    : "";
  const brand = concept.brandName?.trim()
    ? `\n브랜드: ${concept.brandName.trim()}${concept.brandCategory?.trim() ? ` (${concept.brandCategory.trim()})` : ""}`
    : "";
  return ` conceptDraft도 기록하세요 — 이 레퍼런스의 디자인을 차용해 새로 만들 광고의 '비주얼 장면'(장면·소재·분위기·피사체)을 한국어 1~2문장으로 묘사합니다.${key}${brand}`;
}

/** 모델이 지시를 무시하고 메시지를 그대로(또는 거의 그대로) 에코했으면 초안으로 취급하지 않는다. */
function rejectMessageEcho(
  conceptDraft: string | null | undefined,
  keyMessage: string | null | undefined,
): string | null {
  const draft = conceptDraft?.trim();
  if (!draft) return null;
  const message = keyMessage?.trim();
  if (message) {
    const normalize = (v: string) => v.replace(/\s+/g, "");
    const nd = normalize(draft);
    const nm = normalize(message);
    // 완전 동일하거나, 메시지로 시작하며 덧붙은 게 8자 미만이면 에코로 판정.
    if (nd === nm || (nm.length >= 8 && nd.startsWith(nm) && nd.length - nm.length < 8)) {
      return null;
    }
  }
  return draft;
}

/**
 * 레퍼런스 분석 공통 경로 — 정밀(좌표 실측, textLayersMeasured=true) 시도 후
 * 실패하면 단순 구조 분석 + 프리셋 레이어(textLayersMeasured=false)로 강등. 둘 다 실패 시 null.
 * 팔레트는 모델 서술 대신 픽셀에서 결정적으로 추출해 덮어쓴다.
 */
async function analyzeReference(
  imageUrl: string,
  opts: AnalyzeOptions = {},
  usageContext?: UsageContext,
): Promise<AnalyzeResult | null> {
  let img: Awaited<ReturnType<typeof fetchAsBase64>> | null = null;
  let pixelPalette: string[] = [];
  try {
    img = await fetchAsBase64(imageUrl);
    pixelPalette = await extractPixelPalette(Buffer.from(img.base64, "base64"));

    const wantConcept = Boolean(opts.concept);
    const conceptAsk = wantConcept ? buildConceptAsk(opts.concept!) : "";

    const resp = await callClaude({
      model: "sonnet",
      // 초안(필수) + 실측 레이어 최대 8개 + 타이포 측정 + 서술 필드가 모두 들어가는 출력 —
      // 1800에선 레이어 많은 레퍼런스에서 잘려 파싱 실패(전량 실패의 실제 원인)했다.
      maxTokens: 3000,
      system:
        "당신은 광고 디자인 분석가입니다. 레퍼런스를 실제 재제작할 수 있도록 텍스트를 의미 레이어로 분해하고 정규화 좌표·크기·색·장식을 측정합니다. 원문 문구나 로고는 복사하지 말고 역할과 스타일만 기록하세요. 도구로만 기록.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType(img.mimeType), data: img.base64 },
            },
            {
              type: "text",
              text: `이 이미지의 디자인 요소를 추출해 ${TOOL} 로 기록하세요.${conceptAsk}`,
            },
          ],
        },
      ],
      tools: [analysisTool(wantConcept)],
      toolChoice: { type: "tool", name: TOOL },
      usageContext,
    });
    if (resp.stop_reason === "max_tokens") {
      // 출력이 잘리면 도구 입력 JSON이 불완전해 파싱이 실패한다 — 명시적으로 폴백 유도.
      throw new Error("정밀 분석 출력이 max_tokens에서 잘림");
    }
    const raw = extractToolUse(resp, TOOL);
    if (!raw) throw new Error("정밀 분석 도구 응답 없음");
    const { conceptDraft, ...design } = ReferenceDraftSchema.parse(raw);
    const normalized = normalizeDesignReference(design);
    return {
      design: {
        ...normalized,
        palette: pixelPalette.length ? pixelPalette : normalized.palette,
        textLayersMeasured: true,
      },
      conceptDraft: rejectMessageEcho(conceptDraft, opts.concept?.keyMessage),
    };
  } catch (e) {
    console.warn("레퍼런스 정밀 분석 실패, 단순 분석 재시도:", (e as Error).message);
    if (!img) return null;
    try {
      return await analyzeReferenceFallback(img, pixelPalette, opts, usageContext);
    } catch (fallbackError) {
      console.warn("레퍼런스 단순 분석도 실패:", (fallbackError as Error).message);
      return null;
    }
  }
}

async function analyzeReferenceFallback(
  img: Awaited<ReturnType<typeof fetchAsBase64>>,
  palette: string[],
  opts: AnalyzeOptions,
  usageContext?: UsageContext,
): Promise<AnalyzeResult | null> {
  const wantConcept = Boolean(opts.concept);
  const conceptAsk = wantConcept ? buildConceptAsk(opts.concept!) : "";
  const resp = await callClaude({
    model: "sonnet",
    // 초안(한국어 최대 400자)이 필수로 포함될 수 있어 1000은 잘림 위험 — 여유 있게.
    maxTokens: 1800,
    system:
      "광고 레퍼런스의 핵심 구조만 안정적으로 분류하세요. 좌표를 추정하지 말고 밀도·정렬·텍스트 역할을 선택하며 원문과 로고는 복사하지 않습니다. 도구로만 기록.",
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType(img.mimeType), data: img.base64 } },
        { type: "text", text: `이 광고의 핵심 구조를 ${CORE_TOOL} 로 기록하세요.${conceptAsk}` },
      ],
    }],
    tools: [coreTool(wantConcept)],
    toolChoice: { type: "tool", name: CORE_TOOL },
    usageContext: usageContext ? { ...usageContext, operation: `${usageContext.operation}_fallback` } : undefined,
  });
  if (resp.stop_reason === "max_tokens") {
    console.warn("레퍼런스 단순 분석 출력이 max_tokens에서 잘림");
    return null;
  }
  const raw = extractToolUse(resp, CORE_TOOL);
  const parsed = raw ? ReferenceCoreSchema.safeParse(raw) : null;
  if (!parsed?.success) return null;
  const core = parsed.data;
  const roles: z.infer<typeof ReferenceCoreSchema>["roles"] = core.roles.length
    ? core.roles
    : ["headline", "sub", "price"];
  const design = normalizeDesignReference({
    palette,
    mood: core.mood,
    composition: core.composition,
    layout: core.layout,
    typographyVibe: core.typographyVibe,
    fontCategory: core.fontCategory,
    fontFamily: core.fontFamily,
    textLayers: fallbackLayers(roles, core.density, core.alignment, palette),
    // 프리셋 좌표 — 실측 아님. 게이트·프롬프트 기하 주입에서 제외된다.
    textLayersMeasured: false,
  });
  return { design, conceptDraft: rejectMessageEcho(core.conceptDraft, opts.concept?.keyMessage) };
}

/** 레퍼런스 이미지 → 디자인 요소 추출(서버 재분석 등 컨셉 초안 불필요 시). 실패 시 null. */
export async function analyzeReferenceDesign(
  imageUrl: string,
  usageContext?: UsageContext,
): Promise<DesignReference | null> {
  return (await analyzeReference(imageUrl, {}, usageContext))?.design ?? null;
}

export interface ReferenceDraft {
  /** 비주얼 장면 초안. 모델이 장면 묘사를 못 만들면 null — 사용자 메시지로 대체하지 않는다(UI 미채움). */
  conceptDraft: string | null;
  design: DesignReference;
}

/** 레퍼런스 → 컨셉 초안 + 디자인 요소(업로드 직후 1콜). 실패 시 null. */
export async function analyzeReferenceForDraft(
  imageUrl: string,
  opts: {
    keyMessage?: string | null;
    brandName?: string | null;
    brandCategory?: string | null;
  } = {},
  usageContext?: UsageContext,
): Promise<ReferenceDraft | null> {
  const result = await analyzeReference(imageUrl, { concept: opts }, usageContext);
  if (!result) return null;
  return { conceptDraft: result.conceptDraft, design: result.design };
}

/** DesignReference → 프롬프트 주입용 영어 디스크립터. 기하 수치는 실측일 때만 주입한다. */
export function formatDesignReference(ref: DesignReference): string {
  const parts: string[] = [];
  if (ref.palette.length) parts.push(`color palette: ${ref.palette.join(", ")}`);
  if (ref.mood) parts.push(`mood: ${ref.mood}`);
  if (ref.composition) parts.push(`composition: ${ref.composition}`);
  if (ref.layout) parts.push(`layout: ${ref.layout}`);
  if (ref.typographyVibe) parts.push(`typography vibe: ${ref.typographyVibe}`);
  if (ref.fontCategory) parts.push(`font class: ${ref.fontCategory}`);
  if (ref.fontFamily) parts.push(`closest installed font: ${ref.fontFamily}`);
  const measured = ref.textLayersMeasured === true;
  if (ref.typography && measured) {
    const t = ref.typography;
    parts.push(
      `typography geometry: ${t.alignment} aligned, headline size ${t.headlineSizeRatio}H, baseline ${t.headlineYRatio}H, block width ${t.headlineMaxWidthRatio}W, line-height ${t.headlineLineHeight}, weight ${t.headlineWeight}, color ${t.headlineColor}`,
    );
  }
  if (ref.textLayers?.length && measured) {
    parts.push(
      `text layer geometry: ${ref.textLayers.map((l) => `${l.role}@(${l.xRatio},${l.yRatio}) ${l.widthRatio}W ${l.sizeRatio}H ${l.align} ${l.color}${l.backgroundColor ? ` on ${l.backgroundColor}` : ""}`).join(" | ")}`,
    );
  }
  return parts.join("; ");
}

/** 선택 필드 누락 때문에 분석 전체가 폐기되지 않도록 안전한 카테고리만 보정한다. */
export function normalizeDesignReference(ref: DesignReference): DesignReference {
  if (ref.fontCategory && ref.fontFamily) return { ...ref, analysisVersion: 2 };
  const vibe = ref.typographyVibe.toLowerCase();
  const fontCategory = /serif|명조|세리프/.test(vibe)
    ? "serif"
    : /round|rounded|둥근/.test(vibe)
      ? "rounded"
      : /hand|script|brush|손글씨|캘리/.test(vibe)
        ? "handwriting"
        : /display|condensed|poster|굵은|타이틀/.test(vibe)
          ? "display"
          : "sans";
  const familyByCategory = {
    sans: "pretendard",
    serif: "nanum-myeongjo",
    rounded: "nanum-square-round",
    display: "gmarket-sans",
    handwriting: "nanum-barunpen",
  } as const;
  return {
    ...ref,
    analysisVersion: 2,
    fontCategory: ref.fontCategory ?? fontCategory,
    fontFamily: ref.fontFamily ?? familyByCategory[ref.fontCategory ?? fontCategory],
  };
}
