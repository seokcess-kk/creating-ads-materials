import { z } from "zod";
import { createCampaign, listCampaigns } from "@/lib/campaigns";
import { ok, parseJson, serverError } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const campaigns = await listCampaigns(brandId);
    return ok({ campaigns });
  } catch (e) {
    return serverError(e);
  }
}

const NoticeMetaInput = z
  .object({
    summary: z.string().max(200).optional(),
    capacity: z.string().max(120).optional(),
    applyUrl: z.string().max(500).optional(),
    noticeUrl: z.string().max(500).optional(),
    eligibility: z.string().max(300).optional(),
    deadline: z.string().max(200).optional(),
    requestFields: z.array(z.string().max(120)).max(12).optional(),
  })
  .nullable()
  .optional();

const CreateSchema = z
  .object({
    name: z.string().min(1),
    goal: z.enum(["TOFU", "MOFU", "BOFU"]).default("BOFU"),
    offer_id: z.string().uuid().nullable(),
    audience_id: z.string().uuid().nullable(),
    channel: z.string().min(1),
    constraints: z.record(z.string(), z.unknown()).optional(),
    automation_level: z.enum(["manual", "assist", "auto"]).optional(),
    key_visual_intent: z.string().max(500).nullable().optional(),
    selected_key_visual_ids: z.array(z.string().uuid()).max(10).optional(),
    content_mode: z.enum(["persuasion", "notice"]).default("persuasion"),
    raw_content: z.string().max(8000).nullable().optional(),
    notice_meta: NoticeMetaInput,
    tone_override: z.string().max(500).nullable().optional(),
  })
  .refine(
    (v) =>
      v.content_mode !== "notice" ||
      (v.raw_content != null && v.raw_content.trim().length > 0),
    { message: "안내문 모드는 raw_content(안내문 원문)가 필요합니다", path: ["raw_content"] },
  );

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, CreateSchema);
    const campaign = await createCampaign(brandId, {
      ...input,
      goal: input.goal ?? "BOFU",
      content_mode: input.content_mode ?? "persuasion",
      raw_content: input.raw_content ?? null,
      notice_meta: input.notice_meta ?? null,
      tone_override: input.tone_override ?? null,
    });
    return ok({ campaign });
  } catch (e) {
    return serverError(e);
  }
}
