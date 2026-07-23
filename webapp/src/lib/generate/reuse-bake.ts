import { needsOverlayText } from "@/lib/text/bake-policy";
import type { DesignReference, LayerCopy } from "./types";

/**
 * 직접 교체 베이킹 — reuse의 기본 렌더 방식.
 *
 * "텍스트 제거 후 캔버스 합성"은 정확하지만 평평하다(외곽선·그림자·원근이 배경과 분리).
 * 대신 레퍼런스를 editImage에 넣어 "각 텍스트를 새 카피로 교체하되 그 요소의 타이포 스타일
 * (색·외곽선·그림자·배지)을 그대로 유지"시키면, 레퍼런스의 디자인 처리가 새 카피에 입혀진다
 * — ChatGPT에서 "이 이미지 문구만 바꿔줘"와 같은 품질을, 실측 좌표로 더 정밀하게.
 *
 * 정확 데이터(날짜·금액·연락처·긴 문장)는 굽지 않고 그 자리를 비워, 컴포지터가 정확히 후합성한다
 * (오타·날조 리스크 회피 — 기존 베이킹 정책과 동일).
 */

type Layer = NonNullable<DesignReference["textLayers"]>[number];

export interface Replacement {
  role: Layer["role"];
  text: string;
  position: string;
  /** true = 이미지 모델이 굽는다 / false = 정확 데이터라 자리만 비우고 컴포지터가 후합성 */
  bake: boolean;
}

/** 레이어 좌표·크기·컨테이너 → 모델이 알아볼 위치 문구(레퍼런스를 직접 보므로 역할+위치로 충분). */
function positionPhrase(layer: Layer): string {
  const v = layer.yRatio < 0.22 ? "top" : layer.yRatio < 0.58 ? "middle" : "bottom";
  const h = layer.xRatio < 0.35 ? "left" : layer.xRatio > 0.65 ? "right" : "center";
  const container = layer.backgroundColor ? " inside the solid pill/badge shape" : "";
  const kind =
    layer.role === "price"
      ? "large number"
      : layer.sizeRatio > 0.16
        ? "large headline"
        : "text";
  return `${kind} at the ${v}-${h}${container}`;
}

/** 실측 레이어 + 역할별 카피 → 교체 목록(카피가 있는 레이어만). */
export function buildReplacements(
  layers: NonNullable<DesignReference["textLayers"]>,
  layerCopy: LayerCopy,
): Replacement[] {
  const used = new Set<string>();
  const out: Replacement[] = [];
  for (const layer of layers) {
    if (used.has(layer.role)) continue;
    const text = layerCopy[layer.role]?.trim();
    if (!text) continue;
    used.add(layer.role);
    out.push({
      role: layer.role,
      text,
      position: positionPhrase(layer),
      // price는 숫자 강조라 짧으면 굽는 편이 디자인 통합에 유리(needsOverlayText가 3자리+만 막음).
      bake: !needsOverlayText(text),
    });
  }
  return out;
}

/**
 * editImage 교체 지시문. 레퍼런스를 baseImage로 첨부해 호출한다.
 * 굽는 레이어는 위치별 교체, 정확 데이터 레이어는 "글자 지우고 배경만" 지시(후합성 자리 확보).
 */
export function buildBakeInstruction(replacements: Replacement[]): string {
  const bake = replacements.filter((r) => r.bake);
  const blank = replacements.filter((r) => !r.bake);
  const bakeLines = bake.map((r) => `- The ${r.position}: replace its text with exactly "${r.text}".`);
  const blankLines = blank.map(
    (r) => `- The ${r.position}: erase its text and leave that area as clean flat background (different text is composited there afterwards).`,
  );
  return [
    "This is a Korean advertisement. Rebuild it with the new text below.",
    "Keep every text element's EXACT position, font family, size, weight, color, outline, drop shadow, and any badge/pill/sticker background IDENTICAL to the original — only the letters change.",
    "Do NOT alter the layout, illustrations, objects, colors, lighting, or any non-text element. Do NOT move or resize the text blocks.",
    "",
    "Text replacements:",
    ...bakeLines,
    ...(blankLines.length ? ["", "Erase these (no replacement):", ...blankLines] : []),
    "",
    "CRITICAL — remove ALL other text: every letter, word or number in the image that is NOT one of the replacements above must be erased completely, including small decorative lettering printed on illustrated objects (e.g. words on coupons, tickets or stickers) and any leftover characters from the original. Fill each erased spot with the surrounding surface color. The ONLY text remaining in the final image must be exactly the strings listed above.",
    "Render all Korean text in PERFECT, correct modern Hangul — do not distort, drop, invent, or add any character. If a string risks garbling, keep the exact characters but you may relax kerning.",
  ].join("\n");
}
