import { createCanvas, GlobalFonts, loadImage, type CanvasRenderingContext2D } from "@napi-rs/canvas";
import { createClient } from "@/lib/supabase/server";
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

export const LOGO_POSITIONS: LogoPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

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

export interface ComposeConfig {
  backgroundImageUrl: string;
  output: { bucket: string; path: string };
  overlay?: {
    top?: boolean;
    topOpacity?: number;
    bottom?: boolean;
    bottomOpacity?: number;
  };
  brand?: {
    text: string;
    color?: string;
    sizeRatio?: number;
    xRatio?: number;
    yRatio?: number;
  };
  logo?: {
    url: string;
    position?: LogoPosition;
    widthRatio?: number;
    marginRatio?: number;
    xRatio?: number;
    yRatio?: number;
  };
  mainCopy?: {
    text: string;
    color?: string;
    sizeRatio?: number;
    yRatio?: number;
    lineSpacingRatio?: number;
    center?: boolean;
    // autoFit: 폭에 맞춰 자동 줄바꿈 + maxLines 이내로 폰트 축소(가변 길이 대응).
    autoFit?: boolean;
    maxLines?: number;
    maxWidthRatio?: number;
  };
  subCopy?: {
    text: string;
    color?: string;
    sizeRatio?: number;
    yRatio?: number;
    center?: boolean;
    autoFit?: boolean;
    maxLines?: number;
    maxWidthRatio?: number;
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
) {
  const alpha = opacity / 255;
  if (direction === "top") {
    const g = ctx.createLinearGradient(0, 0, 0, h / 3);
    g.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h / 3);
  } else {
    const startY = (h * 2) / 3;
    const g = ctx.createLinearGradient(0, startY, 0, h);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, `rgba(0, 0, 0, ${alpha})`);
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
) {
  ctx.textAlign = align;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillText(text, x + shadowOffset, y + shadowOffset);
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

// 배경 버퍼 위에 오버레이를 합성해 PNG 버퍼를 반환(업로드 없음).
// composeAd가 Supabase 업로드로 감싸고, 로컬 테스트/E2E는 이 함수를 직접 사용한다.
export async function renderComposite(
  background: Buffer | Uint8Array,
  config: ComposeConfig,
): Promise<Buffer> {
  const bgImage = await loadImage(Buffer.from(background));

  const w = bgImage.width;
  const h = bgImage.height;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bgImage, 0, 0);

  const overlay = config.overlay ?? { top: true, bottom: true };
  if (overlay.top) addGradientOverlay(ctx, w, h, "top", overlay.topOpacity ?? 180);
  if (overlay.bottom) addGradientOverlay(ctx, w, h, "bottom", overlay.bottomOpacity ?? 220);

  if (config.fontSet) {
    const entries = (Object.values(config.fontSet) as Array<CanvasFontEntry | undefined>)
      .filter((e): e is CanvasFontEntry => Boolean(e));
    await Promise.all(entries.map(ensureFontRegistered));
  }

  if (config.logo?.url) {
    try {
      const logoRes = await fetch(config.logo.url);
      if (logoRes.ok) {
        const logoBuffer = Buffer.from(await logoRes.arrayBuffer());
        const logoImg = await loadImage(logoBuffer);

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

  if (config.mainCopy?.text) {
    const baseSize = Math.round(h * (config.mainCopy.sizeRatio ?? 0.048));
    const family = pickFamily(config.fontSet, "headline");
    const center = config.mainCopy.center !== false;
    let fontSize = baseSize;
    let lines: string[];
    if (config.mainCopy.autoFit) {
      const maxWidth = w * (config.mainCopy.maxWidthRatio ?? 0.86);
      const fit = fitText(
        config.mainCopy.text,
        { baseSize, maxWidth, maxLines: config.mainCopy.maxLines ?? 3 },
        (size, t) => {
          ctx.font = `bold ${size}px ${family}`;
          return ctx.measureText(t).width;
        },
      );
      fontSize = fit.fontSize;
      lines = fit.lines;
    } else {
      lines = config.mainCopy.text.split("\n");
    }
    ctx.font = `bold ${fontSize}px ${family}`;
    const yStart = h * (config.mainCopy.yRatio ?? 0.08);
    const lineSpacing = config.mainCopy.autoFit
      ? fontSize * 1.3
      : h * (config.mainCopy.lineSpacingRatio ?? 0.075);

    for (let i = 0; i < lines.length; i++) {
      const y = yStart + i * lineSpacing;
      if (center) {
        drawTextWithShadow(ctx, w / 2, y, lines[i], config.mainCopy.color ?? "#FFFFFF", 3, "center");
      } else {
        drawTextWithShadow(ctx, w * 0.05, y, lines[i], config.mainCopy.color ?? "#FFFFFF", 3);
      }
    }
  }

  if (config.subCopy?.text) {
    const baseSize = Math.round(h * (config.subCopy.sizeRatio ?? 0.026));
    const family = pickFamily(config.fontSet, "sub");
    const center = config.subCopy.center !== false;
    let fontSize = baseSize;
    let lines: string[];
    if (config.subCopy.autoFit) {
      const maxWidth = w * (config.subCopy.maxWidthRatio ?? 0.86);
      const fit = fitText(
        config.subCopy.text,
        { baseSize, maxWidth, maxLines: config.subCopy.maxLines ?? 2 },
        (size, t) => {
          ctx.font = `${size}px ${family}`;
          return ctx.measureText(t).width;
        },
      );
      fontSize = fit.fontSize;
      lines = fit.lines;
    } else {
      lines = [config.subCopy.text];
    }
    ctx.font = `${fontSize}px ${family}`;
    const yStart = h * (config.subCopy.yRatio ?? 0.8);
    const lineSpacing = fontSize * 1.3;
    for (let i = 0; i < lines.length; i++) {
      const y = yStart + i * lineSpacing;
      if (center) {
        drawTextWithShadow(ctx, w / 2, y, lines[i], config.subCopy.color ?? "#D4AF37", 2, "center");
      } else {
        drawTextWithShadow(ctx, w * 0.05, y, lines[i], config.subCopy.color ?? "#D4AF37", 2);
      }
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

export async function composeAd(config: ComposeConfig): Promise<string> {
  const bgRes = await fetch(config.backgroundImageUrl);
  if (!bgRes.ok) throw new Error(`배경 이미지 fetch 실패: ${bgRes.status}`);
  const bgBuffer = Buffer.from(await bgRes.arrayBuffer());

  const buffer = await renderComposite(bgBuffer, config);

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(config.output.bucket)
    .upload(config.output.path, buffer, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(config.output.bucket)
    .getPublicUrl(config.output.path);
  return urlData.publicUrl;
}
