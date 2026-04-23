import Link from "next/link";
import {
  getPricingNote,
  getRecentUsage,
  getUsageByBrand,
  getUsageSummary,
} from "@/lib/usage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarList } from "@/components/insights/BarList";
import { formatKst } from "@/lib/format/date";

export const dynamic = "force-dynamic";

const OPERATION_LABELS: Record<string, string> = {
  strategy: "Strategy 생성",
  copy: "Copy 생성",
  visual_gen: "Visual 생성",
  visual_validator: "Visual 검증",
  retouch: "Retouch 편집",
  vision_bp: "BP 분석",
  vision_bp_reanalyze: "BP 재분석",
  vision_bp_promote: "자사 BP 승격 분석",
  analyze_website: "홈페이지 분석",
};

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period = "month" } = await searchParams;

  const now = new Date();
  let from: Date | undefined;
  if (period === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === "30d") {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === "7d") {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const [summary, recent, byBrand] = await Promise.all([
    getUsageSummary({ from }),
    getRecentUsage(50),
    getUsageByBrand(),
  ]);

  const anthropic = summary.byProvider["anthropic"] ?? { cost: 0, count: 0 };
  const gemini = summary.byProvider["gemini"] ?? { cost: 0, count: 0 };

  const operationItems = Object.entries(summary.byOperation)
    .map(([k, v]) => ({
      key: `${OPERATION_LABELS[k] ?? k} · ${fmtUsd(v.cost)}`,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count);

  const modelItems = Object.entries(summary.byModel)
    .map(([k, v]) => ({
      key: `${k} · ${fmtUsd(v.cost)}`,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count);

  const brandItems = byBrand.map((b) => ({
    key: `${b.brandName} · ${fmtUsd(b.cost)}`,
    count: b.count,
  }));

  const periodLabel =
    period === "month"
      ? "이번 달"
      : period === "30d"
        ? "최근 30일"
        : period === "7d"
          ? "최근 7일"
          : "전체 기간";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Usage</h1>
        <p className="text-muted-foreground">Claude · Gemini 호출 비용 추적</p>
      </div>

      <div className="flex gap-1 text-sm">
        {[
          { id: "7d", label: "최근 7일" },
          { id: "month", label: "이번 달" },
          { id: "30d", label: "최근 30일" },
          { id: "all", label: "전체" },
        ].map((p) => (
          <Link
            key={p.id}
            href={`/usage?period=${p.id}`}
            className={`rounded-md px-3 py-1 text-xs border transition-colors ${
              period === p.id
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>총 비용 · {periodLabel}</CardDescription>
            <CardTitle className="text-2xl">{fmtUsd(summary.totalCost)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {fmtNum(summary.totalCalls)} 호출
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Anthropic (Claude)</CardDescription>
            <CardTitle className="text-2xl">{fmtUsd(anthropic.cost)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {fmtNum(anthropic.count)} 호출 · 입력 {fmtNum(summary.totalInputTokens)}t · 출력{" "}
            {fmtNum(summary.totalOutputTokens)}t
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gemini (Image)</CardDescription>
            <CardTitle className="text-2xl">{fmtUsd(gemini.cost)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {fmtNum(gemini.count)} 호출 · {fmtNum(summary.totalImages)} 이미지
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>호출당 평균</CardDescription>
            <CardTitle className="text-2xl">
              {summary.totalCalls > 0
                ? fmtUsd(summary.totalCost / summary.totalCalls)
                : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {getPricingNote()}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">작업별 호출 / 비용</CardTitle>
            <CardDescription className="text-xs">기간 내 호출 횟수 기준 정렬</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList title="Operation" items={operationItems} emptyLabel="기록 없음" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">모델별 호출</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList title="Model" items={modelItems} emptyLabel="기록 없음" color="accent" />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">브랜드별 누적 비용</CardTitle>
            <CardDescription className="text-xs">기간 제한 없이 누적</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList title="Brand" items={brandItems} emptyLabel="브랜드 연결 호출 없음" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 호출 (최대 50건)</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">호출 기록 없음</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2">시각</th>
                    <th className="py-2 pr-2">Provider</th>
                    <th className="py-2 pr-2">Operation</th>
                    <th className="py-2 pr-2">Model</th>
                    <th className="py-2 pr-2 text-right">Input</th>
                    <th className="py-2 pr-2 text-right">Output</th>
                    <th className="py-2 pr-2 text-right">Image</th>
                    <th className="py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 whitespace-nowrap">
                        {formatKst(r.created_at)}
                      </td>
                      <td className="py-2 pr-2">
                        <Badge variant="outline" className="text-[10px]">
                          {r.provider}
                        </Badge>
                      </td>
                      <td className="py-2 pr-2">
                        {OPERATION_LABELS[r.operation] ?? r.operation}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{r.model ?? "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {r.input_tokens != null ? fmtNum(r.input_tokens) : "—"}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {r.output_tokens != null ? fmtNum(r.output_tokens) : "—"}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {r.image_count != null ? r.image_count : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {fmtUsd(Number(r.estimated_cost_usd ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
