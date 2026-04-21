"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { CreativeStageRow, CreativeVariant } from "@/lib/campaigns/types";

interface RetouchStudioProps {
  campaignId: string;
  visualReady: boolean;
  baseImageUrl: string | null;
  visualSuggestions: string[];
  initialStage: CreativeStageRow | null;
  initialVariants: CreativeVariant[];
}

interface TurnContent {
  url: string;
  path: string;
  instruction: string;
  baseVariantId: string;
  baseLabel: string;
}

export function RetouchStudio({
  campaignId,
  visualReady,
  baseImageUrl,
  visualSuggestions,
  initialStage,
  initialVariants,
}: RetouchStudioProps) {
  const router = useRouter();
  const [stage, setStage] = useState<CreativeStageRow | null>(initialStage);
  const [variants, setVariants] = useState<CreativeVariant[]>(initialVariants);
  const [instruction, setInstruction] = useState("");
  const [strict, setStrict] = useState(false);
  const [baseVariantId, setBaseVariantId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => setStage(initialStage), [initialStage]);
  useEffect(() => setVariants(initialVariants), [initialVariants]);

  const currentBaseUrl =
    (baseVariantId
      ? (variants.find((v) => v.id === baseVariantId)?.content_json as TurnContent)?.url
      : null) ?? baseImageUrl;

  async function run() {
    if (!instruction.trim()) {
      toast.error("수정 지시를 입력하세요");
      return;
    }
    setRunning(true);
    toast.info("Gemini 3 Pro Image 편집 중 (30~60초)");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/retouch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: instruction.trim(),
          baseVariantId: baseVariantId ?? undefined,
          keepCompositionStrict: strict,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "편집 실패");
      setStage(data.stage);
      setVariants((prev) => [...prev, data.variant]);
      setInstruction("");
      toast.success("편집 완료");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setRunning(false);
    }
  }

  async function select(variantId: string) {
    setSelecting(variantId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/retouch/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "확정 실패");
      setVariants((prev) => prev.map((v) => ({ ...v, selected: v.id === variantId })));
      toast.success("최종 Visual 확정 — Compose 단계로");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSelecting(null);
    }
  }

  if (!visualReady) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>④ Retouch</span>
          <Badge variant="outline">Optional · 멀티턴 편집</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              현재 base {baseVariantId ? "(턴 이미지)" : "(원본 Visual)"}
            </p>
            {currentBaseUrl ? (
              <img
                src={currentBaseUrl}
                alt="base"
                className="w-full aspect-square rounded-md border object-cover"
              />
            ) : (
              <div className="w-full aspect-square rounded-md border flex items-center justify-center text-xs text-muted-foreground">
                base 이미지 없음
              </div>
            )}
            {baseVariantId && (
              <Button size="sm" variant="ghost" onClick={() => setBaseVariantId(null)}>
                원본 Visual로 되돌리기
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">수정 지시</p>
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="예: 숫자를 더 크게, 배경을 더 어둡게, CTA 영역 밝게"
                rows={4}
                disabled={running}
              />
            </div>

            {visualSuggestions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Validator 제안 (클릭하여 채우기)
                </p>
                <div className="flex flex-wrap gap-1">
                  {visualSuggestions.slice(0, 5).map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setInstruction(s)}
                      disabled={running}
                      className="text-xs rounded-full border px-2 py-1 hover:bg-muted transition-colors text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={strict}
                onChange={(e) => setStrict(e.target.checked)}
                disabled={running}
              />
              엄격 모드 (최소 변경만)
            </label>

            <Button onClick={run} disabled={running || !instruction.trim()}>
              {running ? "편집 중..." : "편집 적용"}
            </Button>
          </div>
        </div>

        {variants.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">편집 이력 ({variants.length} turns)</h3>
            <div className="grid md:grid-cols-3 gap-3">
              {variants.map((v, i) => {
                const c = v.content_json as unknown as TurnContent;
                const isSelected = v.selected;
                const isBase = baseVariantId === v.id;
                return (
                  <Card
                    key={v.id}
                    className={
                      isSelected
                        ? "border-primary bg-primary/5"
                        : isBase
                          ? "border-primary/40"
                          : "hover:border-primary/30 transition-colors"
                    }
                  >
                    <div className="aspect-square overflow-hidden rounded-t-md border-b">
                      <a href={c.url} target="_blank" rel="noreferrer">
                        <img src={c.url} alt={`turn ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    </div>
                    <CardContent className="pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">turn {i + 1}</Badge>
                        <div className="flex gap-1">
                          {isBase && <Badge variant="outline">base</Badge>}
                          {isSelected && <Badge variant="secondary">final</Badge>}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {c.instruction}
                      </p>
                      <div className="flex gap-1">
                        {!isBase && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setBaseVariantId(v.id)}
                            disabled={running}
                          >
                            이걸 base로
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={isSelected ? "outline" : "default"}
                          className="flex-1"
                          onClick={() => select(v.id)}
                          disabled={selecting !== null || (isSelected && variants.some((x) => x.selected))}
                        >
                          {selecting === v.id
                            ? "확정 중..."
                            : isSelected
                              ? "선택됨"
                              : "최종 확정"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
