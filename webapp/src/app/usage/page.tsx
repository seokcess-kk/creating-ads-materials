import Link from "next/link";
import {
  getPricingNote,
  getUsageByBrand,
  getUsageList,
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

const PAGE_SIZE_OPTIONS = [50, 100, 200];

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

interface SearchParamsShape {
  period?: string;
  page?: string;
  pageSize?: string;
  provider?: string;
  operation?: string;
}

function buildUsageHref(
  current: SearchParamsShape,
  overrides: Partial<SearchParamsShape>,
): string {
  const merged: SearchParamsShape = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.period) params.set("period", merged.period);
  if (merged.provider) params.set("provider", merged.provider);
  if (merged.operation) params.set("operation", merged.operation);
  if (merged.pageSize) params.set("pageSize", merged.pageSize);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const qs = params.toString();
  return qs ? `/usage?${qs}` : "/usage";
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  const sp = await searchParams;
  const period = sp.period ?? "month";
  const provider = sp.provider && sp.provider !== "all" ? sp.provider : undefined;
  const operation = sp.operation && sp.operation !== "all" ? sp.operation : undefined;
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(sp.pageSize))
    ? Number(sp.pageSize)
    : 50;
  const page = Math.max(1, Number(sp.page) || 1);

  const now = new Date();
  let from: Date | undefined;
  if (period === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === "30d") {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === "7d") {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const [summary, list, byBrand] = await Promise.all([
    getUsageSummary({ from }),
    getUsageList({ from, provider, operation, page, pageSize }),
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

  const totalPages = Math.max(1, Math.ceil(list.total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = list.total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, list.total);

  const providerOptions: Array<{ id: string; label: string }> = [
    { id: "all", label: "전체" },
    { id: "anthropic", label: "Anthropic" },
    { id: "gemini", label: "Gemini" },
  ];

  const operationOptions: Array<{ id: string; label: string }> = [
    { id: "all", label: "전체" },
    ...Object.keys(summary.byOperation).map((k) => ({
      id: k,
      label: OPERATION_LABELS[k] ?? k,
    })),
  ];

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
            href={buildUsageHref(sp, { period: p.id, page: "1" })}
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
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">호출 내역</CardTitle>
              <CardDescription className="text-xs">
                {periodLabel} · 총 {fmtNum(list.total)}건
                {list.total > 0 && (
                  <>
                    {" "}
                    · {fmtNum(rangeStart)}–{fmtNum(rangeEnd)} 표시
                  </>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-muted-foreground mr-1">페이지당</span>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <Link
                  key={n}
                  href={buildUsageHref(sp, { pageSize: String(n), page: "1" })}
                  className={`rounded-md px-2 py-0.5 border transition-colors ${
                    pageSize === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  {n}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Provider</span>
              {providerOptions.map((opt) => {
                const active = (provider ?? "all") === opt.id;
                return (
                  <Link
                    key={opt.id}
                    href={buildUsageHref(sp, {
                      provider: opt.id === "all" ? undefined : opt.id,
                      page: "1",
                    })}
                    className={`rounded-md px-2 py-0.5 border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </Link>
                );
              })}
            </div>
            {operationOptions.length > 1 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-muted-foreground">Operation</span>
                {operationOptions.map((opt) => {
                  const active = (operation ?? "all") === opt.id;
                  return (
                    <Link
                      key={opt.id}
                      href={buildUsageHref(sp, {
                        operation: opt.id === "all" ? undefined : opt.id,
                        page: "1",
                      })}
                      className={`rounded-md px-2 py-0.5 border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {list.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">호출 기록 없음</p>
          ) : (
            <>
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
                    {list.rows.map((r) => (
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

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-xs">
                  <span className="text-muted-foreground">
                    페이지 {currentPage} / {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <PageLink
                      sp={sp}
                      targetPage={1}
                      disabled={currentPage === 1}
                      label="« 처음"
                    />
                    <PageLink
                      sp={sp}
                      targetPage={currentPage - 1}
                      disabled={currentPage === 1}
                      label="‹ 이전"
                    />
                    <PageLink
                      sp={sp}
                      targetPage={currentPage + 1}
                      disabled={currentPage === totalPages}
                      label="다음 ›"
                    />
                    <PageLink
                      sp={sp}
                      targetPage={totalPages}
                      disabled={currentPage === totalPages}
                      label="끝 »"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PageLink({
  sp,
  targetPage,
  disabled,
  label,
}: {
  sp: SearchParamsShape;
  targetPage: number;
  disabled: boolean;
  label: string;
}) {
  const baseClass = "rounded-md px-2 py-1 border transition-colors";
  if (disabled) {
    return (
      <span
        aria-disabled
        className={`${baseClass} text-muted-foreground opacity-40 cursor-not-allowed`}
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={buildUsageHref(sp, { page: String(targetPage) })}
      className={`${baseClass} hover:bg-muted`}
    >
      {label}
    </Link>
  );
}
