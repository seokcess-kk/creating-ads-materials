"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CreativeStageRow, CreativeVariant } from "@/lib/campaigns/types";
import type { VisualValidatorResult } from "@/lib/prompts/visual";
import { RegenerateBox } from "./RegenerateBox";

import {
  aspectClass,
  variantGridCols,
  type ChannelAspectRatio,
} from "./aspect-layout";

interface VisualStageProps {
  campaignId: string;
  copyReady: boolean;
  aspectRatio?: ChannelAspectRatio;
  initialStage: CreativeStageRow | null;
  initialVariants: CreativeVariant[];
}

function scoreRow(label: string, value: number | undefined) {
  if (value === undefined) return null;
  const w = Math.round(((value - 1) / 4) * 100);
  return (
    <div key={label} className="flex items-center gap-2 text-xs">
      <span className="w-28 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${w}%` }} />
      </div>
      <span className="w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

export function VisualStage({
  campaignId,
  copyReady,
  aspectRatio,
  initialStage,
  initialVariants,
}: VisualStageProps) {
  const ac = aspectClass(aspectRatio);
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
        ? "방향성 반영 Visual 재생성 (90~180초)"
        : "Gemini 3 Pro Image × 3 생성 + Claude Vision 검증 (90~180초)",
    );
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/visual`, {
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
      if (data.failures?.length) {
        toast.warning(`${data.variants.length}개 성공, ${data.failures.length}개 실패`);
      } else {
        toast.success(
          instruction
            ? `${data.variants.length}개 추가 생성`
            : `${data.variants.length}개 비주얼 생성 완료`,
        );
      }
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
      const res = await fetch(`/api/campaigns/${campaignId}/visual/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "선택 실패");
      setVariants((prev) =>
        prev.map((v) => ({ ...v, selected: v.id === variantId })),
      );
      toast.success("Visual 선택 — M3(Retouch) 대기");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSelecting(null);
    }
  }

  if (!copyReady) return null;

  if (!stage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">③ Visual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Gemini 3 Pro Image로 3변형(제품·숫자·인물 포커스) 병렬 생성 + Claude Vision 4축 검증
          </p>
          <Button onClick={() => generate()} disabled={generating}>
            {generating ? "생성 중..." : "Visual 생성"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage.status === "failed") {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base">③ Visual — 실패</CardTitle>
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
          <CardTitle className="text-base">③ Visual 생성 중...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Gemini 병렬 생성 + Vision 검증 중 (90~180초)
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedId = variants.find((v) => v.selected)?.id ?? null;
  const sorted = [...variants].sort((a, b) => {
    const sa = (a.scores_json as Partial<VisualValidatorResult>)?.overall ?? 0;
    const sb = (b.scores_json as Partial<VisualValidatorResult>)?.overall ?? 0;
    return sb - sa;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>③ Visual — {variants.length}변형</span>
          <Badge variant="outline">M2 종료 게이트</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          overall 점수 내림차순. Retouch/Compose/Ship은 M3에서 활성화됩니다.
        </p>
        <div className={`grid gap-3 ${variantGridCols(aspectRatio)}`}>
          {sorted.map((v) => {
            const c = v.content_json as {
              url: string;
              focusLabel: string;
              focus: string;
            };
            const s = v.scores_json as Partial<VisualValidatorResult> & {
              validatorError?: string;
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
                <div
                  className={`${ac} overflow-hidden rounded-t-md border-b bg-muted/20 flex items-center justify-center`}
                >
                  <a href={c.url} target="_blank" rel="noreferrer">
                    <img src={c.url} alt={c.focusLabel} className="w-full h-full object-contain" />
                  </a>
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{c.focusLabel}</CardTitle>
                    <div className="flex gap-1">
                      {s?.overall != null && (
                        <Badge variant="secondary">{s.overall.toFixed(1)}</Badge>
                      )}
                      {isSelected && <Badge variant="secondary">selected</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {s?.validatorError ? (
                    <p className="text-xs text-destructive">Validator: {s.validatorError}</p>
                  ) : (
                    <div className="space-y-1">
                      {scoreRow("hook strength", s?.hookStrength)}
                      {scoreRow("text ready", s?.textReady)}
                      {scoreRow("brand consistency", s?.brandConsistency)}
                      {scoreRow("policy clear", s?.policyClear)}
                    </div>
                  )}
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
                        ? "선택됨 (M3 대기)"
                        : "이 비주얼 선택"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="pt-2">
          <RegenerateBox
            label="다른 방향으로 Visual 추가"
            placeholder="예: 더 미니멀 / 제품 위주 / 더 밝은 톤 / 인물 강조"
            suggestions={[
              "더 미니멀·여백 많이",
              "제품·UI 중심으로",
              "숫자를 훨씬 크게",
              "더 밝은 톤",
              "따뜻한 컬러 팔레트",
            ]}
            running={generating}
            onRegenerate={generate}
          />
        </div>
      </CardContent>
    </Card>
  );
}
