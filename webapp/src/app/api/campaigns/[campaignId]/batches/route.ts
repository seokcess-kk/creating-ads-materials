import { z } from "zod";
import {
  getLatestRun,
  getStage,
  listBatches,
  listVariants,
  markDownstreamStale,
  restoreBatch,
} from "@/lib/campaigns";
import type { CreativeStageName } from "@/lib/campaigns/types";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const STAGES: CreativeStageName[] = [
  "strategy",
  "copy",
  "visual",
  "retouch",
  "compose",
];

function parseStage(raw: string | null): CreativeStageName {
  if (!raw) throw new ApiError(400, "stage 쿼리 파라미터 필요");
  if (!STAGES.includes(raw as CreativeStageName)) {
    throw new ApiError(400, `알 수 없는 stage: ${raw}`);
  }
  return raw as CreativeStageName;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const url = new URL(request.url);
    const stage = parseStage(url.searchParams.get("stage"));

    const run = await getLatestRun(campaignId);
    if (!run) return ok({ batches: [], archivedVariants: [] });

    const stageRow = await getStage(run.id, stage);
    if (!stageRow) return ok({ batches: [], archivedVariants: [] });

    const [batches, allVariants] = await Promise.all([
      listBatches(stageRow.id),
      listVariants(stageRow.id, { includeArchived: true }),
    ]);
    const archivedVariants = allVariants.filter((v) => v.archived_at != null);
    return ok({ batches, archivedVariants });
  } catch (e) {
    return serverError(e);
  }
}

const RestoreSchema = z.object({
  stage: z.enum([
    "strategy",
    "copy",
    "visual",
    "retouch",
    "compose",
  ] as const),
  batchId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const { stage, batchId } = await parseJson(request, RestoreSchema);

    const run = await getLatestRun(campaignId);
    if (!run) throw new ApiError(400, "실행이 없습니다");

    const stageRow = await getStage(run.id, stage);
    if (!stageRow) throw new ApiError(404, "stage 없음");

    await restoreBatch(stageRow.id, batchId);
    await markDownstreamStale(run.id, stage);
    const [batches, activeVariants] = await Promise.all([
      listBatches(stageRow.id),
      listVariants(stageRow.id),
    ]);
    return ok({ batches, activeVariants });
  } catch (e) {
    return serverError(e);
  }
}
