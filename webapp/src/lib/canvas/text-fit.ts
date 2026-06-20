// 가변 길이 텍스트 자동 줄바꿈/축소 — Python compose_ad.py(auto_wrap_text/auto_fit_font_size)의 포팅.
// canvas 의존을 끊기 위해 폭 측정은 `measure` 콜백으로 주입(순수 함수 → 단위 테스트 가능).

/**
 * 텍스트를 max_width 이내로 자동 줄바꿈.
 * 이미 \n으로 분리된 줄은 유지하되, 너무 길면 (1) 어절 단위 → (2) 글자 단위로 분리.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (t: string) => number,
): string[] {
  const result: string[] = [];
  for (const paragraphRaw of text.split("\n")) {
    const paragraph = paragraphRaw.trim();
    if (!paragraph) {
      result.push("");
      continue;
    }
    if (measure(paragraph) <= maxWidth) {
      result.push(paragraph);
      continue;
    }
    // 1차: 어절(띄어쓰기) 단위
    const byWords = wrapByWords(paragraph.split(" "), maxWidth, measure);
    if (byWords) {
      result.push(...byWords);
      continue;
    }
    // 2차 폴백: 글자 단위
    let current = "";
    for (const ch of paragraph) {
      const test = current + ch;
      if (measure(test) > maxWidth && current) {
        result.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

/** 어절 단위 줄바꿈. 단일 어절이 max_width를 초과하면 null(→ 글자 단위 폴백). */
function wrapByWords(
  words: string[],
  maxWidth: number,
  measure: (t: string) => number,
): string[] | null {
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (measure(word) > maxWidth) return null;
    const test = current ? `${current} ${word}` : word;
    if (measure(test) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface FitResult {
  fontSize: number;
  lines: string[];
}

/**
 * 텍스트가 max_lines 이내로 들어갈 때까지 폰트 크기를 축소(최대 base_size, 최소 base_size*minScale).
 * @param measureAt (size, text) → 해당 폰트 크기에서의 텍스트 폭(px)
 */
export function fitText(
  text: string,
  opts: { baseSize: number; maxWidth: number; maxLines: number; minScale?: number },
  measureAt: (size: number, t: string) => number,
): FitResult {
  const minScale = opts.minScale ?? 0.6;
  const scales = [1, 0.9, 0.8, 0.7, 0.6];
  let last: FitResult | null = null;
  for (const scale of scales) {
    if (scale < minScale) break;
    const size = Math.max(12, Math.round(opts.baseSize * scale));
    const lines = wrapText(text, opts.maxWidth, (t) => measureAt(size, t));
    last = { fontSize: size, lines };
    if (lines.length <= opts.maxLines) return last;
  }
  if (last) return last;
  const size = Math.max(12, Math.round(opts.baseSize * minScale));
  return { fontSize: size, lines: wrapText(text, opts.maxWidth, (t) => measureAt(size, t)) };
}
