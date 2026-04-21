"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CreativeStageRow, CreativeVariant } from "@/lib/campaigns/types";
import type { CopyCritique, CopyVariant } from "@/lib/prompts/copy";
import { RegenerateBox } from "./RegenerateBox";

interface CopyGateProps {
  campaignId: string;
  strategyReady: boolean;
  initialStage: CreativeStageRow | null;
  initialVariants: CreativeVariant[];
}

function scoreBar(label: string, value: number) {
  const w = Math.round(((value - 1) / 4) * 100);
  return (
    <div key={label} className="flex items-center gap-2 text-xs">
      <span className="w-24 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${w}%` }} />
      </div>
      <span className="w-6 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

export function CopyGate({
  campaignId,
  strategyReady,
  initialStage,
  initialVariants,
}: CopyGateProps) {
  const router = useRouter();
  const [stage, setStage] = useState<CreativeStageRow | null>(initialStage);
  const [variants, setVariants] = useState<CreativeVariant[]>(initialVariants);
  const [generating, setGenerating] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => setStage(initialStage), [initialStage]);
  useEffect(() => setVariants(initialVariants), [initialVariants]);

  async function generate(instruction?: string) {
    setGenerating(true);
    toast.info(
      instruction
        ? "방향성 반영 카피 재생성 (60~120초)"
        : "카피 5~8변형 + self-critique 생성 중 (60~120초)",
    );
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instruction ? { instruction } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setStage(data.stage);
      setVariants((prev) =>
        instruction ? [...prev, ...data.variants] : data.variants,
      );
      toast.success(
        instruction
          ? `${data.variants.length}개 추가 생성`
          : `${data.variants.length}개 변형 생성 + 검증 완료`,
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setGenerating(false);
    }
  }

  async function select(variantId: string) {
    setSelecting(variantId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/copy/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "선택 실패");
      setVariants((prev) =>
        prev.map((v) => ({ ...v, selected: v.id === variantId })),
      );
      toast.success("Copy 선택 — Visual 단계로");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSelecting(null);
    }
  }

  if (!strategyReady) return null;

  if (!stage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">② Copy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            선택된 Strategy 기반 5~8변형 + 표준 self-critique(4축)
          </p>
          <Button onClick={() => generate()} disabled={generating}>
            {generating ? "생성 중..." : "Copy 생성"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage.status === "failed") {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base">② Copy — 실패</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">{stage.error}</p>
          <Button onClick={() => generate()} disabled={generating}>
            {generating ? "재생성 중..." : "다시 시도"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage.status === "running") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">② Copy 생성 중...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            카피 + critique 생성 중입니다 (60~120초).
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedId = variants.find((v) => v.selected)?.id ?? null;
  const sorted = [...variants].sort((a, b) => {
    const sa = (a.scores_json as Partial<CopyCritique["scores"]>)?.overall ?? 0;
    const sb = (b.scores_json as Partial<CopyCritique["scores"]>)?.overall ?? 0;
    return sb - sa;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>② Copy — {variants.length}변형</span>
          <Badge variant="outline">Human Gate 2</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          overall 점수 내림차순 정렬. 하나를 선택하면 Visual 단계가 활성화됩니다.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {sorted.map((v) => {
            const c = v.content_json as unknown as CopyVariant;
            const s = v.scores_json as unknown as CopyCritique["scores"] & {
              issues?: string[];
              suggestions?: string[];
            };
            const isSelected = v.selected;
            return (
              <Card
                key={v.id}
                className={
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40 transition-colors"
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs text-muted-foreground">{v.label}</code>
                    <div className="flex gap-1">
                      {s?.overall && (
                        <Badge variant="secondary">{s.overall.toFixed(1)}</Badge>
                      )}
                      {isSelected && <Badge variant="secondary">selected</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">헤드라인</p>
                    <p className="text-base font-semibold">{c.headline}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">서브</p>
                    <p className="text-sm">{c.subCopy}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CTA</p>
                    <Badge variant="outline">{c.cta}</Badge>
                  </div>
                  <div className="pt-2 space-y-1">
                    {s?.taboosClear != null && scoreBar("taboos clear", s.taboosClear)}
                    {s?.frameworkFit != null &&
                      scoreBar("framework fit", s.frameworkFit)}
                    {s?.hookStrength != null && scoreBar("hook strength", s.hookStrength)}
                    {s?.koreanNatural != null &&
                      scoreBar("한국어 자연스러움", s.koreanNatural)}
                  </div>
                  {(s?.issues?.length ?? 0) > 0 && (
                    <div className="text-xs">
                      <p className="font-medium text-destructive">Issues</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {s.issues?.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(s?.suggestions?.length ?? 0) > 0 && (
                    <div className="text-xs">
                      <p className="font-medium">Suggestions</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {s.suggestions?.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">근거</summary>
                    <p className="pt-1">{c.rationale}</p>
                  </details>
                  <Button
                    size="sm"
                    variant={isSelected ? "outline" : "default"}
                    className="w-full"
                    onClick={() => select(v.id)}
                    disabled={selecting !== null || (selectedId !== null && !isSelected)}
                  >
                    {selecting === v.id
                      ? "선택 중..."
                      : isSelected
                        ? "선택됨"
                        : "이 카피 선택"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="pt-2">
          <RegenerateBox
            label="다른 방향으로 카피 추가"
            placeholder="예: 숫자 더 강조 / 더 짧게 / 긴박감 추가 / 일상적 톤"
            suggestions={[
              "숫자·수치를 더 강조",
              "더 짧고 강하게",
              "긴박감·한정성 추가",
              "일상 대화 톤",
              "페인 포인트 직설적으로",
            ]}
            running={generating}
            onRegenerate={generate}
          />
        </div>
      </CardContent>
    </Card>
  );
}
