/**
 * reuse 파이프라인 반복 검증 — 프로덕션 경로와 동일 순서:
 * 분석(실측+색 보정) → 텍스트 제거 → 대비 게이트 → 실측 레이어 합성.
 * 실행: npx tsx --tsconfig tsconfig.json scripts/__iterate-reuse.manual.ts [라운드라벨]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const OUT = String.raw`C:\Users\assag\AppData\Local\Temp\claude\C--Users-assag-solution-creating-ads-materials\08a7cc42-24b2-4e25-a141-872344f46b3b\scratchpad`;
const REF = String.raw`C:\Users\assag\OneDrive\바탕 화면\zeus_ref\ref_4.jpg`;

// single-image.ts TEXT_REMOVAL_PROMPT 사본(모듈이 next/headers를 끌고 와 직접 import 불가).
const TEXT_REMOVAL_PROMPT =
  "Remove ALL text from this image, together with the badge/pill/sticker containers that hold text. Specifically remove: " +
  "(1) every letter, word and logo wordmark; (2) ALL numbers including large stylized/decorative numerals — a giant number is text, not decoration; " +
  "(3) every text container: pills, badges, stickers, seals, scalloped shapes, ribbons and speech bubbles, whether filled or empty. " +
  "Fill every removed area by cleanly extending the surrounding background colors and gradients — flat and crisp, never blurred, smudged or hazy. " +
  "KEEP everything else exactly identical: illustrated objects (boxes, products, characters), scene decorations, colors, lighting, layout and composition. " +
  "Lettering printed on a kept object is removed cleanly, leaving the object's plain surface. " +
  "The result must be a completely text-free, badge-free version of the same scene.";

// 실사용 재현 — 사용자가 실제 앱에서 넣은 카피 세트.
const LAYER_COPY: Record<string, string> = {
  eyebrow: "지금 확인하는 임플란트 가격",
  badge: "가격공개",
  headline: "이 가격 실화?",
  sub: "국산 오스템으로 이 가격",
  price: "35",
  legal: "개당·상담 후 결정",
  footer: "개당·상담 후 결정",
};

async function main() {
  const label = process.argv[2] ?? "r1";
  const fs = await import("node:fs/promises");
  const sharp = (await import("sharp")).default;
  const { analyzeReferenceDesign } = await import("@/lib/generate/analyze-reference");
  const { editImage } = await import("@/lib/engines");
  const { renderComposite } = await import("@/lib/canvas/compositor");
  const { singleAdConfig } = await import("@/lib/generate/render");
  const { nearestAspect, resizeToChannel } = await import("@/lib/canvas/resize");
  const { findLowContrastLayers } = await import("@/lib/generate/quality");
  const { fontSetForReference } = await import("@/lib/carousel/style");
  const { refineLayersFromOriginal } = await import("@/lib/generate/measure-layers");

  const refBuf = await fs.readFile(REF);
  const dataUrl = `data:image/jpeg;base64,${refBuf.toString("base64")}`;

  // 1) 분석(실측 + 색 픽셀 보정) — 프로덕션은 업로드 시 1회 분석을 재사용하므로,
  //    하네스도 캐시로 같은 조건을 만든다. --fresh 로 재분석.
  const cachePath = `${OUT}/design-ref4.json`;
  let design: Awaited<ReturnType<typeof analyzeReferenceDesign>> = null;
  if (!process.argv.includes("--fresh")) {
    design = await fs.readFile(cachePath, "utf8").then(JSON.parse).catch(() => null);
    if (design) console.log(`[${label}] 분석 캐시 사용`);
  }
  if (!design) {
    design = await analyzeReferenceDesign(dataUrl, {
      operation: "single_image_ref_analyze",
      brandId: null,
      metadata: { harness: label },
    });
    if (design) await fs.writeFile(cachePath, JSON.stringify(design, null, 2));
  }
  if (!design?.textLayers?.length || design.textLayersMeasured !== true) {
    throw new Error(`실측 실패: measured=${design?.textLayersMeasured} layers=${design?.textLayers?.length ?? 0}`);
  }
  console.log(`[${label}] layers:`);
  for (const l of design.textLayers) {
    console.log(
      `  ${l.role.padEnd(8)} @(${l.xRatio.toFixed(2)},${l.yRatio.toFixed(2)}) w${l.widthRatio.toFixed(2)} s${l.sizeRatio.toFixed(3)} ${l.align} color=${l.color} stroke=${l.strokeColor ?? "-"} bg=${l.backgroundColor ?? "-"}`,
    );
  }

  // 2) 텍스트 제거(원본 비율 스냅)
  const meta = await sharp(refBuf).metadata();
  const aspect = nearestAspect(meta.width, meta.height) ?? "1:1";
  const cleaned = await editImage({
    prompt: TEXT_REMOVAL_PROMPT,
    baseImage: { mimeType: "image/jpeg", base64: refBuf.toString("base64") },
    aspectRatio: aspect,
    imageSize: "1K",
    usageContext: { operation: "single_image_reuse_clean", brandId: null, metadata: { harness: label } },
  });
  const bgBuf = await resizeToChannel(Buffer.from(cleaned.base64, "base64"), aspect);
  await fs.writeFile(`${OUT}/it-${label}-cleaned.png`, bgBuf);

  // 3) 원본 색 유도 실측 — 기하·색의 정본. 비전은 의미(역할·컨테이너·대략 위치·색 prior)만.
  const layers = await refineLayersFromOriginal(refBuf, design.textLayers);
  console.log(`[${label}] refined layers:`);
  for (const l of layers) {
    console.log(
      `  ${l.role.padEnd(8)} @(${l.xRatio.toFixed(2)},${l.yRatio.toFixed(2)}) w${l.widthRatio.toFixed(2)} s${l.sizeRatio.toFixed(3)} lines${l.maxLines} color=${l.color} bg=${l.backgroundColor ?? "-"}`,
    );
  }

  // 4) 대비 게이트 + 5) 합성 (reuse 경로와 동일 config)
  const busy = await findLowContrastLayers(bgBuf, layers);
  console.log(`[${label}] busyRoles:`, busy.join(",") || "-");
  const config = singleAdConfig({
    headline: LAYER_COPY.headline,
    sub: LAYER_COPY.sub,
    fontSet: fontSetForReference(design),
    typography: design.typography ?? null,
    textLayers: layers,
    layerCopy: LAYER_COPY,
    busyTextRoles: busy,
  });
  const composed = await renderComposite(bgBuf, config);
  await fs.writeFile(`${OUT}/it-${label}-final.png`, composed);
  console.log(`[${label}] saved it-${label}-cleaned.png / it-${label}-final.png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
