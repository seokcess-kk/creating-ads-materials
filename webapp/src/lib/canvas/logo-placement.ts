import sharp from "sharp";
import type { LogoPosition } from "./compositor";

/** 분석이 끝난 로고 후보(버퍼 + 알파 가중 평균 휘도 0~1). */
export interface LogoCandidate {
  url: string;
  buf: Buffer;
  luminance: number;
}

/** 로고의 알파 가중 평균 휘도(0~1). 투명 영역은 무시 → 밝은/어두운 로고 분류용. */
export async function logoLuminance(buf: Buffer): Promise<number> {
  try {
    // 축소본으로 충분(휘도 평균이 목적) — 대형 로고에서 픽셀 순회 비용 절감.
    const { data, info } = await sharp(buf, { failOn: "none" })
      .resize(64, 64, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ch = info.channels; // 4 (RGBA)
    let sum = 0;
    let wsum = 0;
    for (let i = 0; i + 3 < data.length; i += ch) {
      const a = data[i + 3] / 255;
      if (a <= 0.01) continue;
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      sum += lum * a;
      wsum += a;
    }
    return wsum > 0 ? sum / wsum : 0.5;
  } catch {
    return 0.5;
  }
}

/** 로고 URL들을 버퍼+휘도로 분석(생성당 1회). 실패한 로고는 제외. */
export async function analyzeLogos(
  urls: string[],
  fetchBuf: (url: string) => Promise<Buffer>,
): Promise<LogoCandidate[]> {
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const buf = await fetchBuf(url);
        return { url, buf, luminance: await logoLuminance(buf) };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is LogoCandidate => r != null);
}

const CORNERS: { position: LogoPosition; right: boolean; bottom: boolean }[] = [
  { position: "top-left", right: false, bottom: false },
  { position: "top-right", right: true, bottom: false },
  { position: "bottom-left", right: false, bottom: true },
  { position: "bottom-right", right: true, bottom: true },
];

export interface LogoPlacement {
  url: string;
  position: LogoPosition;
  /** 가독성 부족 시 로고 뒤에 깔 반투명 패널 색(없으면 패널 미사용) */
  backingColor: string | null;
}

/**
 * 생성 배경의 네 모서리 밝기·번잡도를 분석해 로고 배치를 결정한다.
 *  - 가장 한산한(디테일 낮은) 모서리 선택
 *  - 그 모서리 밝기와 대비가 큰 로고 에셋 선택(밝은 곳엔 어두운 로고)
 *  - 대비가 부족하거나 번잡하면 로고와 대비되는 반투명 패널 추가
 * LLM 호출 없이 sharp 로컬 분석만 사용.
 */
export async function planLogoPlacement(
  bgBuf: Buffer,
  logos: LogoCandidate[],
  opts: { darken?: number } = {},
): Promise<LogoPlacement | null> {
  if (logos.length === 0) return null;
  // overlay 합성은 그라데이션+스크림으로 배경이 어두워지므로 측정 휘도에 darken(<1)을 곱해 보정.
  const darken = opts.darken ?? 1;
  let W = 0;
  let H = 0;
  try {
    const meta = await sharp(bgBuf, { failOn: "none" }).metadata();
    W = meta.width ?? 0;
    H = meta.height ?? 0;
  } catch {
    /* ignore */
  }
  if (!W || !H) {
    return { url: logos[0].url, position: "top-left", backingColor: null };
  }

  const cw = Math.max(1, Math.round(W * 0.3));
  const chh = Math.max(1, Math.round(H * 0.2));
  const corners = await Promise.all(
    CORNERS.map(async (c) => {
      const left = c.right ? W - cw : 0;
      const top = c.bottom ? H - chh : 0;
      try {
        const s = await sharp(bgBuf, { failOn: "none" })
          .extract({ left, top, width: cw, height: chh })
          .stats();
        const m = s.channels;
        const lum =
          ((0.299 * m[0].mean + 0.587 * m[1].mean + 0.114 * m[2].mean) / 255) * darken;
        const detail = (m[0].stdev + m[1].stdev + m[2].stdev) / 3 / 255;
        return { c, lum, detail };
      } catch {
        return { c, lum: 0.5, detail: 1 };
      }
    }),
  );

  // 가장 한산한 모서리(디테일 낮음)
  corners.sort((a, b) => a.detail - b.detail);
  const best = corners[0];

  // 모서리 밝기와 대비가 가장 큰 로고
  const logo = logos
    .slice()
    .sort(
      (a, b) =>
        Math.abs(b.luminance - best.lum) - Math.abs(a.luminance - best.lum),
    )[0];

  const contrast = Math.abs(logo.luminance - best.lum);
  const needsBacking = contrast < 0.35 || best.detail > 0.16;
  const backingColor = needsBacking
    ? logo.luminance > 0.5
      ? "rgba(0,0,0,0.32)"
      : "rgba(255,255,255,0.55)"
    : null;

  return { url: logo.url, position: best.c.position, backingColor };
}
