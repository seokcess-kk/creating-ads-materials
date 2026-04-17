import { createCanvas, loadImage, registerFont, type Canvas, type CanvasRenderingContext2D } from "@napi-rs/canvas";
import { createAdminClient } from "@/lib/supabase/admin";
import path from "path";
import fs from "fs";
import os from "os";

// 폰트 캐시: 같은 폰트를 여러 번 등록하지 않도록
const fontCache = new Set<string>();

interface ComposeConfig {
  backgroundImageUrl: string;
  output: {
    bucket: string;
    path: string;
  };
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
    position?: "top-left" | "top-center" | "top-right";
    widthRatio?: number;
    yRatio?: number;
  };
  mainCopy?: {
    text: string;
    color?: string;
    sizeRatio?: number;
    yRatio?: number;
    lineSpacingRatio?: number;
    center?: boolean;
  };
  subCopy?: {
    text: string;
    color?: string;
    sizeRatio?: number;
    yRatio?: number;
    center?: boolean;
  };
  cta?: {
    text: string;
    bgColor?: string;
    textColor?: string;
    sizeRatio?: number;
    yRatio?: number;
  };
  slogan?: {
    text: string;
    color?: string;
    sizeRatio?: number;
    yRatio?: number;
  };
}

async function loadFontFromUrl(url: string, family: string, weight?: string): Promise<void> {
  const cacheKey = `${family}-${weight || "normal"}`;
  if (fontCache.has(cacheKey)) return;

  const tmpDir = path.join(os.tmpdir(), "ad-studio-fonts");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const fileName = `${cacheKey}${path.extname(url) || ".ttf"}`;
  const tmpPath = path.join(tmpDir, fileName);

  if (!fs.existsSync(tmpPath)) {
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(tmpPath, buffer);
  }

  registerFont(tmpPath, { family, weight: weight || "normal" });
  fontCache.add(cacheKey);
}

function addGradientOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, direction: "top" | "bottom", opacity: number) {
  if (direction === "top") {
    const gradient = ctx.createLinearGradient(0, 0, 0, h / 3);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${opacity / 255})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h / 3);
  } else {
    const startY = (h * 2) / 3;
    const gradient = ctx.createLinearGradient(0, startY, 0, h);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, `rgba(0, 0, 0, ${opacity / 255})`);
    ctx.fillStyle = gradient;
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
  // 그림자
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillText(text, x + shadowOffset, y + shadowOffset);
  // 본문
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export async function composeAd(config: ComposeConfig): Promise<string> {
  // 1. 배경 이미지 로드
  const bgRes = await fetch(config.backgroundImageUrl);
  const bgBuffer = Buffer.from(await bgRes.arrayBuffer());
  const bgImage = await loadImage(bgBuffer);

  const w = bgImage.width;
  const h = bgImage.height;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  // 배경 그리기
  ctx.drawImage(bgImage, 0, 0);

  // 2. 그라데이션 오버레이
  const overlay = config.overlay ?? { top: true, bottom: true };
  if (overlay.top) addGradientOverlay(ctx, w, h, "top", overlay.topOpacity ?? 180);
  if (overlay.bottom) addGradientOverlay(ctx, w, h, "bottom", overlay.bottomOpacity ?? 220);

  // 기본 폰트 설정 (시스템 sans-serif 사용)
  const fontFamily = "sans-serif";

  // 3. 로고
  if (config.logo?.url) {
    try {
      const logoRes = await fetch(config.logo.url);
      const logoBuffer = Buffer.from(await logoRes.arrayBuffer());
      const logoImg = await loadImage(logoBuffer);

      const logoW = w * (config.logo.widthRatio ?? 0.15);
      const logoH = (logoImg.height / logoImg.width) * logoW;
      const logoY = h * (config.logo.yRatio ?? 0.03);

      let logoX: number;
      switch (config.logo.position ?? "top-left") {
        case "top-center": logoX = (w - logoW) / 2; break;
        case "top-right": logoX = w - logoW - w * 0.05; break;
        default: logoX = w * 0.05;
      }

      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
    } catch {
      console.warn("로고 로드 실패");
    }
  }

  // 4. 브랜드명 (로고 대신 텍스트)
  if (config.brand?.text && !config.logo?.url) {
    const fontSize = Math.round(h * (config.brand.sizeRatio ?? 0.024));
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    const x = w * (config.brand.xRatio ?? 0.05);
    const y = h * (config.brand.yRatio ?? 0.05);
    drawTextWithShadow(ctx, x, y, config.brand.text, config.brand.color ?? "#FFFFFF", 1);
  }

  // 5. 메인 카피
  if (config.mainCopy?.text) {
    const fontSize = Math.round(h * (config.mainCopy.sizeRatio ?? 0.048));
    ctx.font = `bold ${fontSize}px ${fontFamily}`;

    const lines = config.mainCopy.text.split("\n");
    const yStart = h * (config.mainCopy.yRatio ?? 0.08);
    const lineSpacing = h * (config.mainCopy.lineSpacingRatio ?? 0.065);

    for (let i = 0; i < lines.length; i++) {
      const y = yStart + i * lineSpacing;
      if (config.mainCopy.center !== false) {
        drawTextWithShadow(ctx, w / 2, y, lines[i], config.mainCopy.color ?? "#FFFFFF", 3, "center");
      } else {
        drawTextWithShadow(ctx, w * 0.05, y, lines[i], config.mainCopy.color ?? "#FFFFFF", 3);
      }
    }
  }

  // 6. 서브 카피
  if (config.subCopy?.text) {
    const fontSize = Math.round(h * (config.subCopy.sizeRatio ?? 0.026));
    ctx.font = `${fontSize}px ${fontFamily}`;
    const y = h * (config.subCopy.yRatio ?? 0.80);
    if (config.subCopy.center !== false) {
      drawTextWithShadow(ctx, w / 2, y, config.subCopy.text, config.subCopy.color ?? "#D4AF37", 2, "center");
    } else {
      drawTextWithShadow(ctx, w * 0.05, y, config.subCopy.text, config.subCopy.color ?? "#D4AF37", 2);
    }
  }

  // 7. CTA 버튼
  if (config.cta?.text) {
    const fontSize = Math.round(h * (config.cta.sizeRatio ?? 0.028));
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(config.cta.text);
    const textW = metrics.width;
    const textH = fontSize;
    const padX = w * 0.04;
    const padY = h * 0.012;

    const btnW = textW + padX * 2;
    const btnH = textH + padY * 2;
    const btnX = (w - btnW) / 2;
    const btnY = h * (config.cta.yRatio ?? 0.86);

    // 둥근 버튼 배경
    const radius = btnH * 0.4;
    ctx.fillStyle = config.cta.bgColor ?? "#D4AF37";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, radius);
    ctx.fill();

    // 버튼 텍스트
    ctx.fillStyle = config.cta.textColor ?? "#1a1a2e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(config.cta.text, btnX + btnW / 2, btnY + btnH / 2);
    ctx.textBaseline = "alphabetic";
  }

  // 8. 슬로건
  if (config.slogan?.text) {
    const fontSize = Math.round(h * (config.slogan.sizeRatio ?? 0.018));
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = config.slogan.color ?? "#999999";
    ctx.textAlign = "center";
    ctx.fillText(config.slogan.text, w / 2, h * (config.slogan.yRatio ?? 0.94));
  }

  // 9. Supabase Storage에 업로드
  const buffer = canvas.toBuffer("image/png");
  const supabase = createAdminClient();

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
