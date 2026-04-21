"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CreativeRun, CreativeStageRow, CreativeVariant } from "@/lib/campaigns/types";
import type { StrategyAlternative } from "@/lib/prompts/strategy";

interface StrategyGateProps {
  campaignId: string;
  initialRun: CreativeRun | null;
  initialStage: CreativeStageRow | null;
  initialVariants: CreativeVariant[];
}

export function StrategyGate({
  campaignId,
  initialRun,
  initialStage,
  initialVariants,
}: StrategyGateProps) {
  const router = useRouter();
  const [run, setRun] = useState<CreativeRun | null>(initialRun);
  const [stage, setStage] = useState<CreativeStageRow | null>(initialStage);
  const [variants, setVariants] = useState<CreativeVariant[]>(initialVariants);
  const [generating, setGenerating] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => setRun(initialRun), [initialRun]);
  useEffect(() => setStage(initialStage), [initialStage]);
  useEffect(() => setVariants(initialVariants), [initialVariants]);

  async function generate() {
    setGenerating(true);
    toast.info("Claude Opus가 3대안 설계 중 (30~60초)");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/strategy`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setRun(data.run);
      setStage(data.stage);
      setVariants(data.variants);
      toast.success("3대안 생성 완료");
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
      const res = await fetch(`/api/campaigns/${campaignId}/strategy/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "선택 실패");
      setVariants((prev) =>
        prev.map((v) => ({ ...v, selected: v.id === variantId })),
      );
      toast.success("Strategy 선택 완료 — Copy 단계로");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSelecting(null);
    }
  }

  const hasReady = stage?.status === "ready" && variants.length > 0;
  const selectedId = variants.find((v) => v.selected)?.id ?? null;

  if (!run || !stage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">① Strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Brand Memory + 플레이북 + 프레임워크 기반 3대안 설계
          </p>
          <Button onClick={generate} disabled={generating}>
            {generating ? "생성 중..." : "Strategy 생성"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage.status === "failed") {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base">① Strategy — 실패</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">{stage.error}</p>
          <Button onClick={generate} disabled={generating}>
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
          <CardTitle className="text-base">① Strategy 생성 중...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Claude Opus가 3대안을 설계하고 있습니다 (30~60초). 새로고침하면 상태가 갱신됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasReady) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>① Strategy — 3대안</span>
          <Badge variant="outline">Human Gate 1</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          하나를 선택하면 Copy 단계가 활성화됩니다.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          {variants.map((v) => {
            const c = v.content_json as unknown as StrategyAlternative;
            const isSelected = v.selected;
            const roleLabel =
              c.role === "safe"
                ? "🛡 Safe"
                : c.role === "explore"
                  ? "🧭 Explore"
                  : c.role === "challenge"
                    ? "⚡ Challenge"
                    : null;
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {roleLabel && (
                      <Badge
                        variant={
                          c.role === "safe"
                            ? "secondary"
                            : c.role === "challenge"
                              ? "destructive"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {roleLabel}
                      </Badge>
                    )}
                    <CardTitle className="text-sm">{c.angleName}</CardTitle>
                    {isSelected && <Badge variant="secondary">selected</Badge>}
                  </div>
                  <div className="flex gap-1 pt-1">
                    <Badge variant="outline" className="text-xs">
                      {c.hookType}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {c.frameworkId}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div>
                    <p className="font-medium text-muted-foreground">각도</p>
                    <p>{c.angleSummary}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">핵심 메시지</p>
                    <p>{c.keyMessage}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">비주얼 방향</p>
                    <p>{c.visualDirection}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">근거</p>
                    <p>{c.whyItWorks}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={isSelected ? "outline" : "default"}
                    className="w-full mt-2"
                    onClick={() => select(v.id)}
                    disabled={selecting !== null || (selectedId !== null && !isSelected)}
                  >
                    {selecting === v.id
                      ? "선택 중..."
                      : isSelected
                        ? "선택됨"
                        : "이 대안 선택"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
