"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { TonePresetId } from "@/lib/fonts/tone-pairs";

interface Suggestion {
  presetId: TonePresetId;
  presetLabel: string;
  description: string;
  score: number;
  reasons: string[];
}

interface FontSuggestionsPanelProps {
  campaignId: string;
  // 현재 active 오버라이드 (있다면 하이라이트)
  currentPresetId: TonePresetId | null;
  visualReady: boolean;
}

export function FontSuggestionsPanel({
  campaignId,
  currentPresetId,
  visualReady,
}: FontSuggestionsPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [applying, setApplying] = useState<TonePresetId | null>(null);
  const [applied, setApplied] = useState<TonePresetId | null>(currentPresetId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/font-suggest`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추천 로드 실패");
      setSuggestions(data.suggestions ?? []);
      setLoaded(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !loaded && !loading) {
      void load();
    }
  }

  async function apply(presetId: TonePresetId) {
    setApplying(presetId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/font-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset_id: presetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "적용 실패");
      setApplied(presetId);
      toast.success(`${data.presetLabel} 적용 — ${data.filled.length}개 role`);
      if (data.missing?.length > 0) {
        toast.warning(
          `일부 미등록: ${data.missing.map((m: { role: string; family: string }) => `${m.role}(${m.family})`).join(", ")}`,
        );
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setApplying(null);
    }
  }

  const hasMeaningful = suggestions.some((s) => s.score > 0);

  return (
    <Card className="bg-muted/20">
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2">
            <span className="text-lg" aria-hidden>
              🎨
            </span>
            <div>
              <p className="text-sm font-medium">
                소재에 맞는 폰트 추천
                {!visualReady && (
                  <span className="ml-2 text-[11px] text-muted-foreground font-normal">
                    (Visual 완료 후 더 정확해집니다)
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                BP 분석(typography·mood·CTA)을 기반으로 상위 3개 프리셋을 점수화
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleOpen}
          >
            {open ? "접기" : "추천 보기"}
          </Button>
        </div>

        {open && (
          <div className="pt-1">
            {loading && (
              <p className="text-xs text-muted-foreground p-3">추천 계산 중...</p>
            )}
            {!loading && loaded && !hasMeaningful && (
              <p className="text-xs text-muted-foreground p-3 border rounded-md">
                BP 패턴 신호가 부족합니다. BP를 업로드하면 정확도가 올라갑니다.
              </p>
            )}
            {!loading && loaded && hasMeaningful && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {suggestions.map((s, i) => {
                  const isApplied = applied === s.presetId;
                  const isTop = i === 0 && s.score > 0;
                  return (
                    <div
                      key={s.presetId}
                      className={
                        "border rounded-md p-3 space-y-2 transition-colors " +
                        (isApplied
                          ? "border-primary bg-primary/5"
                          : isTop
                            ? "border-primary/40"
                            : "")
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium">{s.presetLabel}</p>
                            {isTop && (
                              <Badge variant="secondary" className="text-[10px]">
                                Top
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {s.description}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0"
                          title="점수"
                        >
                          {s.score.toFixed(1)}
                        </Badge>
                      </div>
                      {s.reasons.length > 0 && (
                        <ul className="text-[11px] text-muted-foreground space-y-0.5">
                          {s.reasons.slice(0, 3).map((r, ri) => (
                            <li key={ri} className="line-clamp-1">
                              · {r}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        size="sm"
                        variant={isApplied ? "outline" : "default"}
                        className="w-full"
                        onClick={() => apply(s.presetId)}
                        disabled={applying !== null || isApplied}
                      >
                        {applying === s.presetId
                          ? "적용 중..."
                          : isApplied
                            ? "적용됨"
                            : "이 프리셋 적용"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
