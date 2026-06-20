/**
 * 안내문(notice) 모드 E2E — 실제 스터디코어 썸머스쿨 안내문으로 파이프라인을 구동한다.
 *
 * 웹 라우트는 세션/RLS가 필요해 스크립트에서 직접 못 돌리므로, 라우트가 호출하는
 * "엔진 레이어"를 동일하게 in-memory로 구동한다:
 *   1) extractNoticeMeta (실제 Claude)  — 원문 → 정보 슬롯
 *   2) buildCopySystem(notice) + copyTool (실제 Claude) — 사무적 카피 5~6안
 *   3) buildGeminiPrompt(notice) + generateImage (실제 Gemini) — 글자 없는 배경
 *   4) renderComposite (컴포지터 auto-fit) — 카피 오버레이 → 로컬 PNG
 *
 * 실행:  webapp 디렉터리에서  npx tsx scripts/e2e-notice.ts
 */
import { config as loadEnv } from "dotenv";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBAPP = join(__dirname, "..");
const REPO_ROOT = join(WEBAPP, "..");
// .env는 레포 루트에 있음(키: ANTHROPIC_API_KEY, GEMINI_API_KEY 등).
loadEnv({ path: join(REPO_ROOT, ".env") });
loadEnv({ path: join(WEBAPP, ".env.local") });

import { extractNoticeMeta, formatNoticeMeta } from "@/lib/notice/extract";
import {
  COPY_TOOL_NAME,
  CopyOutputSchema,
  buildCopySystem,
  copyTool,
  type CopyVariant,
} from "@/lib/prompts/copy";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import {
  buildGeminiPrompt,
  VISUAL_VARIANT_SPECS,
  type VisualPromptContext,
} from "@/lib/prompts/visual";
import { generateImage } from "@/lib/engines/gemini-image";
import { getChannel } from "@/lib/channels";
import { getPlaybook } from "@/lib/playbook";
import {
  renderComposite,
  type ComposeConfig,
  type ComposeFontSet,
} from "@/lib/canvas/compositor";
import type { StrategyAlternative } from "@/lib/prompts/strategy";
import type { BrandMemory } from "@/lib/memory/types";

const ANNOUNCEMENT = `※ 2026 스터디코어1.0 썸머스쿨 안내 ※

안녕하세요. 스터디코어1.0입니다.

본 안내 및 신청서는
7월·8월 월 등록이 아닌,
썸머스쿨 기간만 별도로 등록하여 이용하는 학생을 위한 안내입니다.

운영 기간, 등록비, 운영시간, 의무학습 기준, 학생 확인사항 등
세부 안내는 아래 홈페이지 공지를 통해 꼼꼼하게 확인해주시기 바랍니다.

▶ 2026 스터디코어1.0 썸머스쿨 안내
https://www.studycore.kr/notices/117bdb99-e3c6-4ddf-8385-365db638c82b

■ 모집 안내
* 모집 인원: 30명 선착순
* 등록 대상: 썸머스쿨 기간만 별도 이용 희망 학생
※ 등록 확정은 구글폼 신청서 제출 완료 기준입니다.

■ 신청 안내
썸머스쿨 기간만 별도 등록을 희망하는 경우 아래 신청서를 작성하여 제출해주시기 바랍니다.
▶ 2026 썸머스쿨 신청서
https://forms.gle/EV3U6o6VPE6b4wX59
※ 신청 인원이 마감될 경우 이후 신청은 제한될 수 있습니다.

학교별 방학 기간이 상이하므로 등원 희망 기간도 신청서에 함께 기입해주시기 바랍니다.

감사합니다.`;

function log(title: string) {
  console.log(`\n${"═".repeat(60)}\n${title}\n${"═".repeat(60)}`);
}

async function main() {
  log("STEP 1 — 안내문 정보 추출 (실제 Claude)");
  const noticeMeta = await extractNoticeMeta(ANNOUNCEMENT);
  console.log(JSON.stringify(noticeMeta, null, 2));

  log("STEP 2 — 안내문 카피 생성 (실제 Claude, notice 시스템 프롬프트)");
  const userMsg = `# 안내문 원문 (1급 소스 — 이 사실만 사용, 창작 금지)
${ANNOUNCEMENT}

# 정보 슬롯 (추출됨)
${formatNoticeMeta(noticeMeta)}

# 톤 오버라이드
사무적·간결, 프리미엄 톤 지양

# Brand
스터디코어1.0 / 교육

# 채널
Instagram Feed 1:1 (1080x1080) · headline ≤40자 / sub ≤80자 / cta ≤15자

# TASK
안내문의 핵심 정보를 서로 다른 정보 위계로 5~6개 카피 + 각 self-critique. 사실만, 사무적 톤. ${COPY_TOOL_NAME}로 기록.`;

  const resp = await callClaude({
    model: "opus",
    maxTokens: 8000,
    system: buildCopySystem(true),
    messages: [{ role: "user", content: userMsg }],
    tools: [copyTool],
    toolChoice: { type: "tool", name: COPY_TOOL_NAME },
  });
  const rawCopy = extractToolUse(resp, COPY_TOOL_NAME);
  if (!rawCopy) throw new Error("카피 추출 실패");
  const parsed = CopyOutputSchema.parse(rawCopy);
  const overallById = new Map(parsed.critiques.map((c) => [c.variantId, c.scores.overall]));
  console.log("생성된 카피 변형:");
  for (const v of parsed.variants) {
    console.log(`  [${(overallById.get(v.id) ?? 0).toFixed(1)}] ${v.headline} / ${v.subCopy} / ${v.cta}`);
  }
  const best: CopyVariant =
    [...parsed.variants].sort(
      (a, b) => (overallById.get(b.id) ?? 0) - (overallById.get(a.id) ?? 0),
    )[0] ?? parsed.variants[0];
  console.log("\n선택된 카피:", JSON.stringify(best, null, 2));

  log("STEP 3 — 글자 없는 배경 생성 (실제 Gemini, notice 배경 프롬프트)");
  const channel = getChannel("ig_feed_square");
  if (!channel) throw new Error("채널 없음");
  const playbook = getPlaybook("ig_feed_square", "BOFU");
  const memory = {
    brand: { name: "스터디코어1.0", category: "교육" },
  } as unknown as BrandMemory;
  const strategy = {
    angleName: "썸머스쿨 안내",
    hookType: "number",
    frameworkId: "4U",
    keyMessage: noticeMeta.summary ?? "썸머스쿨 기간만 별도 등록 안내",
    visualDirection:
      "clean calm informational notice card, soft neutral palette, generous empty space",
  } as unknown as StrategyAlternative;
  const vctx: VisualPromptContext = {
    memory,
    strategy,
    selectedCopy: best,
    playbook,
    channel,
    goal: "BOFU",
    isNotice: true,
    toneOverride: "사무적·간결, 프리미엄 톤 지양",
  };
  const bgPrompt = buildGeminiPrompt(vctx, VISUAL_VARIANT_SPECS[1]);
  console.log("배경 프롬프트(앞 600자):\n", bgPrompt.slice(0, 600), "...");
  const bgImg = await generateImage({
    prompt: bgPrompt,
    aspectRatio: "1:1",
    imageSize: "2K",
  });
  const bgBuf = Buffer.from(bgImg.base64, "base64");
  console.log(`배경 생성 완료: ${(bgBuf.length / 1024).toFixed(0)}KB, ${bgImg.mimeType}`);

  log("STEP 4 — 카피 오버레이 합성 (컴포지터 auto-fit, Pretendard)");
  const FONTS = join(REPO_ROOT, "fonts");
  const fontSet: ComposeFontSet = {
    headline: { family: "Pretendard-Bold", fsPath: join(FONTS, "Pretendard-Bold.otf") },
    sub: { family: "Pretendard-Medium", fsPath: join(FONTS, "Pretendard-Medium.otf") },
    cta: { family: "Pretendard-SemiBold", fsPath: join(FONTS, "Pretendard-SemiBold.otf") },
  };
  const config: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    overlay: { top: true, topOpacity: 150, bottom: true, bottomOpacity: 200 },
    fontSet,
    mainCopy: {
      text: best.headline,
      color: "#FFFFFF",
      sizeRatio: 0.052,
      yRatio: 0.28,
      center: true,
      autoFit: true,
      maxLines: 3,
      maxWidthRatio: 0.86,
    },
    subCopy: {
      text: best.subCopy,
      color: "#E5E7EB",
      sizeRatio: 0.028,
      yRatio: 0.62,
      center: true,
      autoFit: true,
      maxLines: 2,
      maxWidthRatio: 0.86,
    },
    cta: {
      text: best.cta,
      bgColor: "#1F2937",
      textColor: "#FFFFFF",
      sizeRatio: 0.028,
      yRatio: 0.84,
      autoFit: true,
      maxWidthRatio: 0.78,
    },
  };
  const finalBuf = await renderComposite(bgBuf, config);

  const outDir = join(REPO_ROOT, "_workspace", "images", "final");
  await mkdir(outDir, { recursive: true });
  const bgPath = join(outDir, "e2e_notice_studycore_bg.png");
  const finalPath = join(outDir, "e2e_notice_studycore_final.png");
  await writeFile(bgPath, bgBuf);
  await writeFile(finalPath, finalBuf);

  log("완료");
  console.log("배경(글자 없음):", bgPath);
  console.log("최종 소재(카피 오버레이):", finalPath);
}

main().catch((e) => {
  console.error("\nE2E 실패:", e);
  process.exit(1);
});
