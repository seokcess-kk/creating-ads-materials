import { getLearnings } from "@/lib/memory";
import { recomputeLearnings } from "@/lib/learning";
import { ok, serverError } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const learnings = await getLearnings(brandId);
    return ok({ learnings });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const agg = await recomputeLearnings(brandId);
    return ok({ learnings: agg });
  } catch (e) {
    return serverError(e);
  }
}
