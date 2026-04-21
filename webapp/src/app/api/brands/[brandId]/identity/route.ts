import { z } from "zod";
import {
  getBrand,
  getIdentity,
  listReferences,
  upsertIdentity,
} from "@/lib/memory";
import { collectSignalsForPrefill, prefillFontPairs } from "@/lib/fonts/prefill";
import { ok, parseJson, serverError } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const identity = await getIdentity(brandId);
    return ok({ identity });
  } catch (e) {
    return serverError(e);
  }
}

const ColorSchema = z.object({
  role: z.enum(["primary", "secondary", "accent", "neutral", "semantic"]),
  hex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  usage: z.string().optional(),
});

const VoiceSchema = z.object({
  tone: z.string().optional(),
  personality: z.array(z.string()).optional(),
  do: z.array(z.string()).optional(),
  dont: z.array(z.string()).optional(),
});

const LogoSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  label: z.string().optional(),
  is_primary: z.boolean().optional(),
});

const PutSchema = z.object({
  voice: VoiceSchema.optional(),
  taboos: z.array(z.string()).optional(),
  colors: z.array(ColorSchema).optional(),
  logos: z.array(LogoSchema).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, PutSchema);
    const identity = await upsertIdentity(brandId, input);
    // voice.tone 또는 BP typography가 확정되면 폰트 프리셋 프리필 시도.
    // 기존 font_pairs가 있으면 건드리지 않음 (사용자 선택 보존).
    try {
      const [brand, references] = await Promise.all([
        getBrand(brandId),
        listReferences(brandId),
      ]);
      await prefillFontPairs(
        brandId,
        collectSignalsForPrefill({
          category: brand?.category ?? null,
          identity,
          references,
        }),
      );
    } catch (e) {
      console.warn("[identity] font prefill failed:", e);
    }
    return ok({ identity });
  } catch (e) {
    return serverError(e);
  }
}
