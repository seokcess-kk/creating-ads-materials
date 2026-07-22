import { createCanvas, GlobalFonts, type CanvasRenderingContext2D } from "@napi-rs/canvas";
import { decodeImage } from "./decode-image";
import { fitText } from "./text-fit";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const fontCache = new Set<string>();

export type LogoPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface CanvasFontEntry {
  family: string;
  fsPath: string;
  cssWeight?: string;
}

export interface ComposeFontSet {
  headline?: CanvasFontEntry;
  sub?: CanvasFontEntry;
  cta?: CanvasFontEntry;
  brand?: CanvasFontEntry;
  slogan?: CanvasFontEntry;
}

export interface ComposeTextLayer {
  text: string;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  sizeRatio: number;
  lineHeight: number;
  align: "left" | "center" | "right";
  color: string;
  gradientEndColor?: string;
  fontWeight: "normal" | "500" | "bold" | "900";
  fontRole: keyof ComposeFontSet;
  maxLines: number;
  minScale?: number;
  strokeColor?: string;
  backgroundColor?: string;
  cornerRadiusRatio?: number;
}

export interface ComposeConfig {
  overlay?: {
    top?: boolean;
    topOpacity?: number;
    bottom?: boolean;
    bottomOpacity?: number;
    // 전체 캔버스에 깔리는 은은한 어둠(0~255). AI 생성 배경의 밝은 영역에서도
    // 오버레이 텍스트 가독성을 보장하기 위한 단일 이미지용 옵션.
    scrim?: number;
    // 그라데이션/스크림 색조. "dark"(기본, 검정) = 밝은 텍스트용,
    // "light"(흰색) = 어두운 텍스트용(밝은 레퍼런스 배경에서 가독성 확보).
    tint?: "dark" | "light";
  };
  brand?: {
    text: string;
    color?: string;
    sizeRatio?: number;
    xRatio?: number;
    yRatio?: number;
  };
  logo?: {
    /** 로고 바이트(우선). 있으면 fetch 없이 직접 디코드 → data: URL fetch 불확실성·CPU 회피. */
    buffer?: Buffer | Uint8Array;
    /** 로고 원격 URL(buffer 없을 때만 fetch). */
    url?: string;
    position?: LogoPosition;
    widthRatio?: number;
    marginRatio?: number;
    xRatio?: number;
    yRatio?: number;
    /** 가독성 부족 시 로고 뒤에 깔 반투명 패널 색(예: "rgba(0,0,0,0.32)"). 없으면 미사용. */
    backingColor?: string | null;
  };
  mainCopy?: {
    text: string;
    color?: string;
    sizeRatio?: number;
    yRatio?: number;
    lineSpacingRatio?: number;
    center?: boolean;
    align?: "left" | "center" | "right";
    xRatio?: number;
    fontWeight?: "normal" | "500" | "bold" | "900";
    // autoFit: 폭에 맞춰 자동 줄바꿈 + maxLines 이내로 폰트 축소(가변 길이 대응).
    autoFit?: boolean;
    maxLines?: number;
    maxWidthRatio?: number;
    minScale?: number;
    // 외곽선으로 임의 배경 위 가독성 강화. strokeColor 미지정 시 어두운 외곽선(밝은 글자용).
    stroke?: boolean;
    strokeColor?: string;
  };
  subCopy?: {
    text: string;
    color?: string;
    sizeRatio?: number;
    yRatio?: number;
    center?: boolean;
    align?: "left" | "center" | "right";
    xRatio?: number;
    fontWeight?: "normal" | "500" | "bold" | "900";
    lineSpacingRatio?: number;
    autoFit?: boolean;
    maxLines?: number;
    maxWidthRatio?: number;
    minScale?: number;
    stroke?: boolean;
    strokeColor?: string;
  };
  cta?: {
    text: string;
    bgColor?: string;
    textColor?: string;
    sizeRatio?: number;
    yRatio?: number;
    autoFit?: boolean;
    maxWidthRatio?: number;
  };
  slogan?: {
    text: string;
    color?: string;
    sizeRatio?: number;
    yRatio?: number;
  };
  /** 레퍼런스 광고를 의미 블록 단위로 재현하는 범용 텍스트 레이어. */
  textLayers?: ComposeTextLayer[];
  fontSet?: ComposeFontSet;
}

async function ensureFontRegistered(entry: CanvasFontEntry): Promise<boolean> {
  if (fontCache.has(entry.family)) return true;

  let fsPath = entry.fsPath;
  if (fsPath.startsWith("http://") || fsPath.startsWith("https://")) {
    try {
      const tmpDir = path.join(os.tmpdir(), "ad-studio-fonts");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const parsed = new URL(fsPath);
      const ext = path.extname(parsed.pathname) || ".ttf";
      const tmp = path.join(tmpDir, `${entry.family.replace(/[^\w-]/g, "_")}${ext}`);
      if (!fs.existsSync(tmp)) {
        const res = await fetch(fsPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(tmp, buf);
      }
      fsPath = tmp;
    } catch (err) {
      console.warn(`폰트 다운로드 실패 ${entry.family}: ${(err as Error).message}`);
      return false;
    }
  }

  if (!fs.existsSync(fsPath)) {
    console.warn(`폰트 파일 없음: ${fsPath} (${entry.family})`);
    return false;
  }

  try {
    GlobalFonts.registerFromPath(fsPath, entry.family);
    fontCache.add(entry.family);
    return true;
  } catch (err) {
    console.warn(`폰트 등록 실패 ${entry.family}: ${(err as Error).message}`);
    return false;
  }
}

function pickFamily(set: ComposeFontSet | undefined, role: keyof ComposeFontSet): string {
  const entry = set?.[role];
  if (entry && fontCache.has(entry.family)) return entry.family;
  return "sans-serif";
}

function addGradientOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  direction: "top" | "bottom",
  opacity: number,
  tint: "dark" | "light" = "dark",
) {
  const alpha = opacity / 255;
  const rgb = tint === "light" ? "255, 255, 255" : "0, 0, 0";
  if (direction === "top") {
    const g = ctx.createLinearGradient(0, 0, 0, h / 3);
    g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h / 3);
  } else {
    const startY = (h * 2) / 3;
    const g = ctx.createLinearGradient(0, startY, 0, h);
    g.addColorStop(0, `rgba(${rgb}, 0)`);
    g.addColorStop(1, `rgba(${rgb}, ${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, startY, w, h - startY);
  }
}

function drawTextWithShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  shadowOffset: number = 2,
  align: CanvasTextAlign = "left",
  stroke?: { color: string; width: number },
) {
  ctx.textAlign = align;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillText(text, x + shadowOffset, y + shadowOffset);
  if (stroke && stroke.width > 0) {
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.width;
    ctx.strokeStyle = stroke.color;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// 배경 버퍼 위에 오버레이를 합성해 PNG 버퍼를 반환(업로드 없음 — 업로드는 호출자 책임).
export async function renderComposite(
  background: Buffer | Uint8Array,
  config: ComposeConfig,
): Promise<Buffer> {
  const bgImage = await decodeImage(background);

  const w = bgImage.width;
  const h = bgImage.height;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bgImage, 0, 0);

  const overlay = config.overlay ?? { top: true, bottom: true };
  const tint = overlay.tint ?? "dark";
  if (overlay.top) addGradientOverlay(ctx, w, h, "top", overlay.topOpacity ?? 180, tint);
  if (overlay.bottom) addGradientOverlay(ctx, w, h, "bottom", overlay.bottomOpacity ?? 220, tint);
  if (overlay.scrim) {
    const rgb = tint === "light" ? "255, 255, 255" : "0, 0, 0";
    ctx.fillStyle = `rgba(${rgb}, ${Math.min(255, overlay.scrim) / 255})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (config.fontSet) {
    const entries = (Object.values(config.fontSet) as Array<CanvasFontEntry | undefined>)
      .filter((e): e is CanvasFontEntry => Boolean(e));
    await Promise.all(entries.map(ensureFontRegistered));
  }

  if (config.logo?.buffer || config.logo?.url) {
    try {
      let logoBuffer: Buffer | null = null;
      if (config.logo.buffer) {
        logoBuffer = Buffer.from(config.logo.buffer);
      } else if (config.logo.url) {
        const logoRes = await fetch(config.logo.url);
        if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer());
      }
      if (logoBuffer) {
        const logoImg = await decodeImage(logoBuffer);

        const logoW = w * (config.logo.widthRatio ?? 0.14);
        const logoH = (logoImg.height / logoImg.width) * logoW;

        let logoX: number;
        let logoY: number;
        if (config.logo.xRatio != null && config.logo.yRatio != null) {
          logoX = Math.max(0, Math.min(w - logoW, w * config.logo.xRatio));
          logoY = Math.max(0, Math.min(h - logoH, h * config.logo.yRatio));
        } else {
          const margin = (config.logo.marginRatio ?? 0.04) * Math.min(w, h);
          const position = config.logo.position ?? "top-left";
          const isBottom = position.startsWith("bottom");
          logoY = isBottom ? h - logoH - margin : margin;
          if (position.endsWith("center")) {
            logoX = (w - logoW) / 2;
          } else if (position.endsWith("right")) {
            logoX = w - logoW - margin;
          } else {
            logoX = margin;
          }
        }
        // 가독성 패널: 로고 뒤에 반투명 라운드 사각형(대비 부족 배경에서 로고가 읽히도록).
        if (config.logo.backingColor) {
          const padX = logoW * 0.12;
          const padY = logoH * 0.18;
          ctx.fillStyle = config.logo.backingColor;
          drawRoundedRect(
            ctx,
            logoX - padX,
            logoY - padY,
            logoW + padX * 2,
            logoH + padY * 2,
            Math.min(logoW, logoH) * 0.22,
          );
          ctx.fill();
        }
        ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
      }
    } catch (err) {
      console.warn("로고 로드 실패:", (err as Error).message);
    }
  }

  if (config.brand?.text && !config.logo?.url) {
    const fontSize = Math.round(h * (config.brand.sizeRatio ?? 0.024));
    ctx.font = `bold ${fontSize}px ${pickFamily(config.fontSet, "brand")}`;
    const x = w * (config.brand.xRatio ?? 0.05);
    const y = h * (config.brand.yRatio ?? 0.05);
    drawTextWithShadow(ctx, x, y, config.brand.text, config.brand.color ?? "#FFFFFF", 1);
  }

  for (const layer of config.textLayers ?? []) {
    if (!layer.text.trim()) continue;
    const family = pickFamily(config.fontSet, layer.fontRole);
    const baseSize = Math.round(h * layer.sizeRatio);
    const maxWidth = w * layer.widthRatio;
    const fit = fitText(
      layer.text,
      { baseSize, maxWidth, maxLines: layer.maxLines, minScale: layer.minScale ?? 0.78 },
      (size, value) => {
        ctx.font = `${layer.fontWeight} ${size}px ${family}`;
        return ctx.measureText(value).width;
      },
    );
    if (fit.overflow) {
      throw new Error(`${layer.text} 문구가 레퍼런스의 ${layer.maxLines}줄 영역에 맞지 않습니다.`);
    }

    const lineHeight = fit.fontSize * layer.lineHeight;
    const blockHeight = lineHeight * fit.lines.length;
    const anchorX = w * layer.xRatio;
    const firstBaselineY = h * layer.yRatio;
    if (layer.backgroundColor) {
      // 필·배지 배경은 레이어 최대 폭이 아니라 '실제 텍스트 폭'에 맞춘다 —
      // 레퍼런스보다 짧은 카피가 들어오면 빈 꼬리가 남는 문제 방지(정렬 기준점은 유지).
      ctx.font = `${layer.fontWeight} ${fit.fontSize}px ${family}`;
      const textWidth = Math.max(...fit.lines.map((line) => ctx.measureText(line).width));
      const padX = Math.max(8, fit.fontSize * 0.45);
      const padY = Math.max(6, fit.fontSize * 0.3);
      const boxX = layer.align === "center"
        ? anchorX - textWidth / 2 - padX
        : layer.align === "right"
          ? anchorX - textWidth - padX
          : anchorX - padX;
      const boxY = firstBaselineY - fit.fontSize - padY;
      ctx.fillStyle = layer.backgroundColor;
      drawRoundedRect(
        ctx,
        boxX,
        boxY,
        textWidth + padX * 2,
        blockHeight + padY * 2,
        h * (layer.cornerRadiusRatio ?? 0.012),
      );
      ctx.fill();
    }

    ctx.font = `${layer.fontWeight} ${fit.fontSize}px ${family}`;
    ctx.textAlign = layer.align;
    for (let i = 0; i < fit.lines.length; i++) {
      const y = firstBaselineY + i * lineHeight;
      if (layer.strokeColor) {
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(1, fit.fontSize * 0.035);
        ctx.strokeStyle = layer.strokeColor;
        ctx.strokeText(fit.lines[i], anchorX, y);
      }
      if (layer.gradientEndColor) {
        const gradient = ctx.createLinearGradient(anchorX, y - fit.fontSize, anchorX + maxWidth, y);
        gradient.addColorStop(0, layer.color);
        gradient.addColorStop(1, layer.gradientEndColor);
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = layer.color;
      }
      ctx.fillText(fit.lines[i], anchorX, y);
    }
  }

  if (config.mainCopy?.text) {
    const baseSize = Math.round(h * (config.mainCopy.sizeRatio ?? 0.048));
    const family = pickFamily(config.fontSet, "headline");
    const align = config.mainCopy.align ?? (config.mainCopy.center === false ? "left" : "center");
    const weight = config.mainCopy.fontWeight ?? "bold";
    let fontSize = baseSize;
    let lines: string[];
    if (config.mainCopy.autoFit) {
      const maxWidth = w * (config.mainCopy.maxWidthRatio ?? 0.86);
      const fit = fitText(
        config.mainCopy.text,
        { baseSize, maxWidth, maxLines: config.mainCopy.maxLines ?? 3, minScale: config.mainCopy.minScale ?? 0.75 },
        (size, t) => {
          ctx.font = `${weight} ${size}px ${family}`;
          return ctx.measureText(t).width;
        },
      );
      fontSize = fit.fontSize;
      lines = fit.lines;
      if (fit.overflow) {
        throw new Error("헤드라인이 레퍼런스 텍스트 영역에 맞지 않습니다. 문구를 줄여 주세요.");
      }
    } else {
      lines = config.mainCopy.text.split("\n");
    }
    ctx.font = `${weight} ${fontSize}px ${family}`;
    const yStart = h * (config.mainCopy.yRatio ?? 0.08);
    const lineSpacing = config.mainCopy.autoFit
      ? fontSize * 1.3
      : h * (config.mainCopy.lineSpacingRatio ?? 0.075);
    const mainStroke = config.mainCopy.stroke
      ? {
          color: config.mainCopy.strokeColor ?? "rgba(0, 0, 0, 0.5)",
          width: Math.max(2, fontSize * 0.08),
        }
      : undefined;

    for (let i = 0; i < lines.length; i++) {
      const y = yStart + i * lineSpacing;
      const x = w * (config.mainCopy.xRatio ?? (align === "center" ? 0.5 : align === "right" ? 0.95 : 0.05));
      drawTextWithShadow(ctx, x, y, lines[i], config.mainCopy.color ?? "#FFFFFF", 3, align, mainStroke);
    }
  }

  if (config.subCopy?.text) {
    const baseSize = Math.round(h * (config.subCopy.sizeRatio ?? 0.026));
    const family = pickFamily(config.fontSet, "sub");
    const align = config.subCopy.align ?? (config.subCopy.center === false ? "left" : "center");
    const weight = config.subCopy.fontWeight ?? "normal";
    let fontSize = baseSize;
    let lines: string[];
    if (config.subCopy.autoFit) {
      const maxWidth = w * (config.subCopy.maxWidthRatio ?? 0.86);
      const fit = fitText(
        config.subCopy.text,
        { baseSize, maxWidth, maxLines: config.subCopy.maxLines ?? 2, minScale: config.subCopy.minScale ?? 0.75 },
        (size, t) => {
          ctx.font = `${weight} ${size}px ${family}`;
          return ctx.measureText(t).width;
        },
      );
      fontSize = fit.fontSize;
      lines = fit.lines;
      if (fit.overflow) {
        throw new Error("보조 문구가 레퍼런스 텍스트 영역에 맞지 않습니다. 문구를 줄여 주세요.");
      }
    } else {
      lines = [config.subCopy.text];
    }
    ctx.font = `${weight} ${fontSize}px ${family}`;
    const yStart = h * (config.subCopy.yRatio ?? 0.8);
    const lineSpacing = config.subCopy.lineSpacingRatio
      ? h * config.subCopy.lineSpacingRatio
      : fontSize * 1.3;
    const subStroke = config.subCopy.stroke
      ? {
          color: config.subCopy.strokeColor ?? "rgba(0, 0, 0, 0.45)",
          width: Math.max(1.5, fontSize * 0.07),
        }
      : undefined;
    for (let i = 0; i < lines.length; i++) {
      const y = yStart + i * lineSpacing;
      const x = w * (config.subCopy.xRatio ?? (align === "center" ? 0.5 : align === "right" ? 0.95 : 0.05));
      drawTextWithShadow(ctx, x, y, lines[i], config.subCopy.color ?? "#D4AF37", 2, align, subStroke);
    }
  }

  if (config.cta?.text) {
    const family = pickFamily(config.fontSet, "cta");
    let fontSize = Math.round(h * (config.cta.sizeRatio ?? 0.028));
    if (config.cta.autoFit) {
      const maxInner = w * (config.cta.maxWidthRatio ?? 0.8);
      for (const scale of [1, 0.9, 0.8, 0.7, 0.6]) {
        const s = Math.max(12, Math.round(fontSize * scale));
        ctx.font = `bold ${s}px ${family}`;
        fontSize = s;
        if (ctx.measureText(config.cta.text).width + w * 0.08 <= maxInner) break;
      }
    }
    ctx.font = `bold ${fontSize}px ${family}`;
    const metrics = ctx.measureText(config.cta.text);
    const textW = metrics.width;
    const textH = fontSize;
    const padX = w * 0.04;
    const padY = h * 0.012;

    const btnW = textW + padX * 2;
    const btnH = textH + padY * 2;
    const btnX = (w - btnW) / 2;
    const btnY = h * (config.cta.yRatio ?? 0.86);

    const radius = btnH * 0.4;
    ctx.fillStyle = config.cta.bgColor ?? "#D4AF37";
    drawRoundedRect(ctx, btnX, btnY, btnW, btnH, radius);
    ctx.fill();

    ctx.fillStyle = config.cta.textColor ?? "#1a1a2e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(config.cta.text, btnX + btnW / 2, btnY + btnH / 2);
    ctx.textBaseline = "alphabetic";
  }

  if (config.slogan?.text) {
    const fontSize = Math.round(h * (config.slogan.sizeRatio ?? 0.018));
    ctx.font = `${fontSize}px ${pickFamily(config.fontSet, "slogan")}`;
    ctx.fillStyle = config.slogan.color ?? "#999999";
    ctx.textAlign = "center";
    ctx.fillText(config.slogan.text, w / 2, h * (config.slogan.yRatio ?? 0.94));
  }

  return canvas.toBuffer("image/png");
}
