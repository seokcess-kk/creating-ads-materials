import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { GoogleGenAI } from "@google/genai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const envPath = join(PROJECT_ROOT, ".env.local");
loadEnv({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_API_KEY) {
  console.error(
    `환경변수 누락. ${envPath}에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY가 있어야 합니다.`,
  );
  process.exit(1);
}

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

interface VisionAnalysis {
  layout?: {
    textZone?: string;
    marginRatio?: number;
    hierarchy?: number;
  };
  color?: { palette?: string[]; contrastRatio?: number; mood?: string };
  typography?: { style?: string; sizeRatio?: Record<string, number> };
  hookElement?: { type?: string; placement?: string };
  copyStructure?: { headlineLen?: number; hookType?: string; framework?: string };
  brandElements?: { logoPosition?: string; logoSizeRatio?: number; ctaStyle?: string };
  channelFit?: Record<string, number>;
  funnelFit?: Record<string, number>;
  notes?: string;
}

function bpAnalysisToText(
  a: VisionAnalysis,
  extras?: { sourceType?: string; note?: string | null },
): string {
  const lines: string[] = [];
  if (extras?.sourceType) lines.push(`Source: ${extras.sourceType}`);
  if (extras?.note) lines.push(`Note: ${extras.note}`);
  if (a.copyStructure?.hookType) lines.push(`Hook type: ${a.copyStructure.hookType}`);
  if (a.copyStructure?.framework) lines.push(`Copy framework: ${a.copyStructure.framework}`);
  if (a.copyStructure?.headlineLen) lines.push(`Headline length: ~${a.copyStructure.headlineLen} chars`);
  if (a.hookElement?.type) lines.push(`Hook element: ${a.hookElement.type}`);
  if (a.hookElement?.placement) lines.push(`Hook placement: ${a.hookElement.placement}`);
  if (a.color?.mood) lines.push(`Mood: ${a.color.mood}`);
  if (a.color?.palette?.length) lines.push(`Palette: ${a.color.palette.join(", ")}`);
  if (a.typography?.style) lines.push(`Typography: ${a.typography.style}`);
  if (a.layout?.textZone) lines.push(`Text zone: ${a.layout.textZone}`);
  if (a.layout?.marginRatio != null)
    lines.push(`Margin ratio: ${(a.layout.marginRatio * 100).toFixed(0)}%`);
  if (a.brandElements?.logoPosition) lines.push(`Logo position: ${a.brandElements.logoPosition}`);
  if (a.brandElements?.ctaStyle) lines.push(`CTA style: ${a.brandElements.ctaStyle}`);
  if (a.funnelFit) {
    const fit = Object.entries(a.funnelFit)
      .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
      .join(", ");
    if (fit) lines.push(`Funnel fit: ${fit}`);
  }
  if (a.channelFit) {
    const fit = Object.entries(a.channelFit)
      .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
      .join(", ");
    if (fit) lines.push(`Channel fit: ${fit}`);
  }
  if (a.notes) lines.push(`Notes: ${a.notes}`);
  return lines.join("\n");
}

async function embedText(text: string): Promise<number[]> {
  const res = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIM,
    },
  });
  const values = res.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding dim mismatch: got ${values?.length ?? 0}, expected ${EMBEDDING_DIM}`,
    );
  }
  return values;
}

interface RefRow {
  id: string;
  brand_id: string;
  source_type: string;
  source_note: string | null;
  vision_analysis_json: VisionAnalysis;
}

async function main() {
  const { data: refs, error } = await supabase
    .from("brand_references")
    .select("id, brand_id, source_type, source_note, vision_analysis_json")
    .eq("vision_status", "ready")
    .is("embedded_at", null);
  if (error) {
    console.error("BP 조회 실패:", error.message);
    process.exit(1);
  }
  const rows = (refs ?? []) as RefRow[];
  console.log(`embedding 미생성 BP: ${rows.length}건`);
  if (rows.length === 0) {
    console.log("모두 최신 상태. 종료.");
    return;
  }

  let ok = 0;
  let fail = 0;
  const failures: Array<{ id: string; err: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const text = bpAnalysisToText(r.vision_analysis_json, {
      sourceType: r.source_type,
      note: r.source_note,
    });
    if (!text.trim()) {
      console.warn(`  [${i + 1}/${rows.length}] ${r.id.slice(0, 8)} — 분석 텍스트 비어있음, 건너뜀`);
      fail += 1;
      failures.push({ id: r.id, err: "empty analysis text" });
      continue;
    }
    try {
      const vec = await embedText(text);
      const { error: upErr } = await supabase
        .from("brand_references")
        .update({
          embedding: vec,
          embedding_model: EMBEDDING_MODEL,
          embedded_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (upErr) throw new Error(upErr.message);
      ok += 1;
      console.log(`  [${i + 1}/${rows.length}] ${r.id.slice(0, 8)} ✓ (brand ${r.brand_id.slice(0, 8)})`);
    } catch (e) {
      fail += 1;
      const msg = e instanceof Error ? e.message : String(e);
      failures.push({ id: r.id, err: msg });
      console.error(`  [${i + 1}/${rows.length}] ${r.id.slice(0, 8)} ✗ ${msg}`);
    }
  }

  console.log(`\n완료: 성공 ${ok} / 실패 ${fail} / 총 ${rows.length}`);
  if (failures.length) {
    console.log("실패 목록:");
    for (const f of failures) console.log(`  - ${f.id}: ${f.err}`);
  }
}

main().catch((e) => {
  console.error("치명적 오류:", e);
  process.exit(1);
});
