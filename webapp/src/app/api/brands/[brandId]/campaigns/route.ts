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

const CreateSchema = z.object({
  name: z.string().min(1),
  goal: z.enum(["TOFU", "MOFU", "BOFU"]).default("BOFU"),
  offer_id: z.string().uuid().nullable(),
  audience_id: z.string().uuid().nullable(),
  channel: z.string().min(1),
  constraints: z.record(z.string(), z.unknown()).optional(),
  automation_level: z.enum(["manual", "assist", "auto"]).optional(),
});

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
    });
    return ok({ campaign });
  } catch (e) {
    return serverError(e);
  }
}
