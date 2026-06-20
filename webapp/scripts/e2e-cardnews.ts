/**
 * 카드뉴스(캐러셀) v1 프로토타입 — 원문 → 자동 카드뉴스 초안을 로컬 PNG로 렌더한다.
 * 엔진 재사용: notice 추출 + cardnews 아웃라인(Claude) + 배경 1장(Gemini) + renderComposite.
 * 실행:  webapp 에서  npx tsx scripts/e2e-cardnews.ts
 */
import { config as loadEnv } from "dotenv";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBAPP = join(__dirname, "..");
const REPO_ROOT = join(WEBAPP, "..");
loadEnv({ path: join(REPO_ROOT, ".env") });
loadEnv({ path: join(WEBAPP, ".env.local") });

import { extractNoticeMeta } from "@/lib/notice/extract";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import {
  CARDNEWS_TOOL_NAME,
  CardNewsOutlineSchema,
  buildCardNewsSystem,
  buildCardNewsMessages,
  cardNewsTool,
  type Slide,
} from "@/lib/prompts/cardnews";
import { generateImage } from "@/lib/engines/gemini-image";
import {
  renderComposite,
  type ComposeConfig,
  type ComposeFontSet,
} from "@/lib/canvas/compositor";

const ANNOUNCEMENT = `※ 2026 스터디코어1.0 썸머스쿨 안내 ※

본 안내는 7월·8월 월 등록이 아닌, 썸머스쿨 기간만 별도로 등록하여 이용하는 학생을 위한 안내입니다.

■ 모집 안내
* 모집 인원: 30명 선착순
* 등록 대상: 썸머스쿨 기간만 별도 이용 희망 학생
※ 등록 확정은 구글폼 신청서 제출 완료 기준입니다.

■ 신청 안내
▶ 신청서: https://forms.gle/EV3U6o6VPE6b4wX59
▶ 공지: https://www.studycore.kr/notices/117bdb99
※ 신청 인원이 마감될 경우 이후 신청은 제한될 수 있습니다.
학교별 방학 기간이 상이하므로 등원 희망 기간도 신청서에 함께 기입해주시기 바랍니다.`;

const FONTS = join(REPO_ROOT, "fonts");
const fontSet: ComposeFontSet = {
  headline: { family: "Pretendard-Bold", fsPath: join(FONTS, "Pretendard-Bold.otf") },
  sub: { family: "Pretendard-Medium", fsPath: join(FONTS, "Pretendard-Medium.otf") },
  cta: { family: "Pretendard-SemiBold", fsPath: join(FONTS, "Pretendard-SemiBold.otf") },
  brand: { family: "Pretendard-SemiBold", fsPath: join(FONTS, "Pretendard-SemiBold.otf") },
  slogan: { family: "Pretendard-Medium", fsPath: join(FONTS, "Pretendard-Medium.otf") },
};

function slideConfig(slide: Slide, total: number): ComposeConfig {
  const base: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    fontSet,
    overlay: { top: true, topOpacity: 140, bottom: true, bottomOpacity: 205 },
    slogan: {
      text: `${String(slide.index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
      color: "#C9CDD6",
      sizeRatio: 0.02,
      yRatio: 0.95,
    },
  };
  if (slide.kicker) {
    base.brand = {
      text: slide.kicker,
      color: "#E7E9EE",
      sizeRatio: 0.026,
      xRatio: 0.08,
      yRatio: 0.12,
    };
  }
  if (slide.role === "hook") {
    base.mainCopy = { text: slide.headline, color: "#FFFFFF", sizeRatio: 0.082, yRatio: 0.44, center: true, autoFit: true, maxLines: 3, maxWidthRatio: 0.84 };
    if (slide.body) base.subCopy = { text: slide.body, color: "#D1D5DB", sizeRatio: 0.03, yRatio: 0.66, center: true, autoFit: true, maxLines: 2, maxWidthRatio: 0.82 };
  } else if (slide.role === "cta") {
    base.mainCopy = { text: slide.headline, color: "#FFFFFF", sizeRatio: 0.064, yRatio: 0.40, center: true, autoFit: true, maxLines: 3, maxWidthRatio: 0.84 };
    if (slide.body) base.subCopy = { text: slide.body, color: "#D1D5DB", sizeRatio: 0.03, yRatio: 0.6, center: true, autoFit: true, maxLines: 2, maxWidthRatio: 0.82 };
    base.cta = { text: "자세히 보기 ▶", bgColor: "#2563EB", textColor: "#FFFFFF", sizeRatio: 0.028, yRatio: 0.78, autoFit: true, maxWidthRatio: 0.7 };
  } else {
    base.mainCopy = { text: slide.headline, color: "#FFFFFF", sizeRatio: 0.058, yRatio: 0.30, center: true, autoFit: true, maxLines: 2, maxWidthRatio: 0.84 };
    if (slide.body) base.subCopy = { text: slide.body, color: "#D1D5DB", sizeRatio: 0.032, yRatio: 0.5, center: true, autoFit: true, maxLines: 4, maxWidthRatio: 0.82 };
  }
  return base;
}

async function contactSheet(slides: Buffer[]): Promise<Buffer> {
  const cols = Math.min(slides.length, 3);
  const rows = Math.ceil(slides.length / cols);
  const cell = 360;
  const gap = 16;
  const W = cols * cell + (cols + 1) * gap;
  const H = rows * cell + (rows + 1) * gap;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b0c10";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < slides.length; i++) {
    const img = await loadImage(slides[i]);
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = gap + c * (cell + gap);
    const y = gap + r * (cell + gap);
    ctx.drawImage(img, x, y, cell, cell);
  }
  return canvas.toBuffer("image/png");
}

async function main() {
  console.log("STEP 1 — 정보 추출");
  const noticeMeta = await extractNoticeMeta(ANNOUNCEMENT);
  console.log(JSON.stringify(noticeMeta, null, 2));

  console.log("\nSTEP 2 — 카드뉴스 아웃라인 (Claude)");
  const resp = await callClaude({
    model: "opus",
    maxTokens: 3000,
    system: buildCardNewsSystem({ isNotice: true, toneOverride: "사무적·간결, 프리미엄 톤 지양" }),
    messages: buildCardNewsMessages({ rawContent: ANNOUNCEMENT, noticeMeta, brandName: "스터디코어1.0" }),
    tools: [cardNewsTool],
    toolChoice: { type: "tool", name: CARDNEWS_TOOL_NAME },
  });
  const raw = extractToolUse(resp, CARDNEWS_TOOL_NAME);
  if (!raw) throw new Error("아웃라인 추출 실패");
  const outline = CardNewsOutlineSchema.parse(raw);
  console.log(`제목: ${outline.title} · ${outline.slides.length}장`);
  for (const s of outline.slides) {
    console.log(`  [${s.index} ${s.role}] ${s.kicker ? `(${s.kicker}) ` : ""}${s.headline}${s.body ? ` — ${s.body}` : ""}`);
  }

  console.log("\nSTEP 3 — 일관 배경 1장 (Gemini)");
  const bgPrompt = `Design a CLEAN, TEXTLESS BACKGROUND for a Korean informational card-news carousel (1:1, 1080x1080). Output must contain NO text, letters, numbers, or logo. Calm, modern, trustworthy: deep navy-to-charcoal soft gradient with subtle geometric lines, generous quiet center area for overlaid Korean text. Sober and clean, not flashy. No people, no objects.`;
  const bg = await generateImage({ prompt: bgPrompt, aspectRatio: "1:1", imageSize: "2K" });
  const bgBuf = Buffer.from(bg.base64, "base64");
  console.log(`배경: ${(bgBuf.length / 1024).toFixed(0)}KB`);

  console.log("\nSTEP 4 — 슬라이드별 합성 (renderComposite, Pretendard)");
  const outDir = join(REPO_ROOT, "_workspace", "images", "final", "cardnews_studycore");
  await mkdir(outDir, { recursive: true });
  const slideBufs: Buffer[] = [];
  for (const s of outline.slides) {
    const buf = await renderComposite(bgBuf, slideConfig(s, outline.slides.length));
    const p = join(outDir, `slide_${String(s.index).padStart(2, "0")}.png`);
    await writeFile(p, buf);
    slideBufs.push(buf);
    console.log(`  ✓ slide ${s.index}`);
  }

  const sheet = await contactSheet(slideBufs);
  const sheetPath = join(REPO_ROOT, "_workspace", "images", "final", "cardnews_studycore_sheet.png");
  await writeFile(sheetPath, sheet);

  console.log("\n완료");
  console.log("슬라이드 폴더:", outDir);
  console.log("컨택트시트:", sheetPath);
}

main().catch((e) => {
  console.error("\n실패:", e);
  process.exit(1);
});
