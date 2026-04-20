import { listFonts } from "@/lib/fonts";
import type { FontTier } from "@/lib/memory/types";
import { ok, serverError } from "@/lib/api-utils";

const VALID_TIERS: FontTier[] = ["tier0", "tier1", "tier2", "tier3"];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tierParam = url.searchParams.get("tier");
    const category = url.searchParams.get("category") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const limit = Number(url.searchParams.get("limit")) || 100;

    let tier: FontTier | FontTier[] | undefined;
    if (tierParam) {
      const parts = tierParam.split(",").filter((t): t is FontTier =>
        VALID_TIERS.includes(t as FontTier),
      );
      tier = parts.length === 1 ? parts[0] : parts.length > 1 ? parts : undefined;
    }

    const fonts = await listFonts({ tier, category, search, limit });
    return ok({ fonts });
  } catch (e) {
    return serverError(e);
  }
}
