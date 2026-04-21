import { createAdminClient } from "@/lib/supabase/admin";

export interface UsageRow {
  id: string;
  provider: string;
  operation: string;
  model: string | null;
  brand_id: string | null;
  campaign_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  image_count: number | null;
  estimated_cost_usd: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UsageSummary {
  totalCost: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalImages: number;
  byProvider: Record<string, { cost: number; count: number }>;
  byOperation: Record<string, { cost: number; count: number }>;
  byModel: Record<string, { cost: number; count: number }>;
  fromDate: string | null;
  toDate: string | null;
}

export interface UsageFilter {
  from?: Date;
  to?: Date;
  brandId?: string;
  campaignId?: string;
}

export async function getUsageSummary(filter: UsageFilter = {}): Promise<UsageSummary> {
  const supabase = createAdminClient();
  let query = supabase.from("api_usage").select("*");
  if (filter.from) query = query.gte("created_at", filter.from.toISOString());
  if (filter.to) query = query.lte("created_at", filter.to.toISOString());
  if (filter.brandId) query = query.eq("brand_id", filter.brandId);
  if (filter.campaignId) query = query.eq("campaign_id", filter.campaignId);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as UsageRow[];

  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalImages = 0;
  const byProvider: Record<string, { cost: number; count: number }> = {};
  const byOperation: Record<string, { cost: number; count: number }> = {};
  const byModel: Record<string, { cost: number; count: number }> = {};

  for (const r of rows) {
    const cost = Number(r.estimated_cost_usd ?? 0);
    totalCost += cost;
    totalInput += r.input_tokens ?? 0;
    totalOutput += r.output_tokens ?? 0;
    totalImages += r.image_count ?? 0;

    const incP = byProvider[r.provider] ?? { cost: 0, count: 0 };
    byProvider[r.provider] = { cost: incP.cost + cost, count: incP.count + 1 };

    const incO = byOperation[r.operation] ?? { cost: 0, count: 0 };
    byOperation[r.operation] = { cost: incO.cost + cost, count: incO.count + 1 };

    if (r.model) {
      const incM = byModel[r.model] ?? { cost: 0, count: 0 };
      byModel[r.model] = { cost: incM.cost + cost, count: incM.count + 1 };
    }
  }

  return {
    totalCost,
    totalCalls: rows.length,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalImages,
    byProvider,
    byOperation,
    byModel,
    fromDate: filter.from?.toISOString() ?? null,
    toDate: filter.to?.toISOString() ?? null,
  };
}

export async function getRecentUsage(limit: number = 50): Promise<UsageRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("api_usage")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as UsageRow[];
}

export interface BrandUsageRow {
  brandId: string;
  brandName: string;
  cost: number;
  count: number;
}

export async function getUsageByBrand(): Promise<BrandUsageRow[]> {
  const supabase = createAdminClient();
  const { data: usage } = await supabase
    .from("api_usage")
    .select("brand_id, estimated_cost_usd")
    .not("brand_id", "is", null);
  const { data: brands } = await supabase.from("brands").select("id, name");
  const nameMap = new Map<string, string>(
    ((brands ?? []) as Array<{ id: string; name: string }>).map((b) => [b.id, b.name]),
  );

  const agg = new Map<string, { cost: number; count: number }>();
  for (const r of (usage ?? []) as Array<{
    brand_id: string | null;
    estimated_cost_usd: number | null;
  }>) {
    if (!r.brand_id) continue;
    const prev = agg.get(r.brand_id) ?? { cost: 0, count: 0 };
    agg.set(r.brand_id, {
      cost: prev.cost + Number(r.estimated_cost_usd ?? 0),
      count: prev.count + 1,
    });
  }

  return Array.from(agg.entries())
    .map(([brandId, v]) => ({
      brandId,
      brandName: nameMap.get(brandId) ?? "(삭제된 브랜드)",
      cost: v.cost,
      count: v.count,
    }))
    .sort((a, b) => b.cost - a.cost);
}
