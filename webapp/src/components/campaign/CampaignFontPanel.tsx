"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  TONE_PRESETS,
  type TonePresetId,
} from "@/lib/fonts/tone-pairs";

interface Suggestion {
  presetId: TonePresetId;
  presetLabel: string;
  description: string;
  score: number;
  reasons: string[];
}

interface CampaignFontPanelProps {
  campaignId: string;
  initialPresetId: TonePresetId | null;
  initialPresetLabel: string | null;
  visualReady: boolean;
}

export function CampaignFontPanel({
  campaignId,
  initialPresetId,
  initialPresetLabel,
  visualReady,
}: CampaignFontPanelProps) {
  const router = useRouter();
  const [presetId, setPresetId] = useState<TonePresetId | null>(initialPresetId);
  const [presetLabel, setPresetLabel] = useState<string | null>(
    initialPresetLabel,
  );
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [applying, setApplying] = useState<TonePresetId | "clear" | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/font-suggest`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "추천 로드 실패");
        setSuggestions(data.suggestions ?? []);
      } catch (e) {
        if (!cancelled) {
          console.warn("font suggestions:", (e as Error).message);
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  async function apply(target: TonePresetId | null) {
    setApplying(target ?? "clear");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/font-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset_id: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "적용 실패");

      if (target === null) {
        setPresetId(null);
        setPresetLabel(null);
        toast.success("브랜드 기본 폰트로 복귀");
      } else {
        setPresetId(data.presetId);
        setPresetLabel(data.presetLabel);
        toast.success(
          `${data.presetLabel} 적용 — ${data.filled.length}개 role`,
        );
        if (data.missing?.length > 0) {
          toast.warning(
            `일부 미등록: ${data.missing
              .map(
                (m: { role: string; family: string }) =>
                  `${m.role}(${m.family})`,
              )
              .join(", ")}`,
          );
        }
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setApplying(null);
    }
  }

  const top3 = (suggestions ?? [])
    .filter((s) => s.score > 0)
    .slice(0, 3);

  return (
    <Card className="bg-muted/20">
      <CardContent className="py-3 space-y-2">
        {/* 상단: 현재 상태 + 추천 Top-3 한 줄 */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">🔤 폰트</span>
            {presetId ? (
              <Badge variant="secondary" className="gap-1">
                {presetLabel}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void apply(null);
                  }}
                  disabled={applying !== null}
                  className="text-destructive hover:opacity-70 ml-0.5"
                  aria-label="오버라이드 해제"
                  title="오버라이드 해제"
                >
                  ✕
                </button>
              </Badge>
            ) : (
              <Badge variant="outline">브랜드 기본</Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded((v) => !v)}
            disabled={applying !== null}
          >
            {expanded ? "접기" : "모두 보기"}
          </Button>
        </div>

        {/* 추천 Top-3 인라인 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">추천:</span>
          {loadingSuggestions && (
            <span className="text-[11px] text-muted-foreground">불러오는 중...</span>
          )}
          {!loadingSuggestions && top3.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              {visualReady
                ? "BP 신호 부족 — 아래 '모두 보기'에서 수동 선택"
                : "Visual 완료 후 정확해집니다"}
            </span>
          )}
          {top3.map((s, i) => {
            const isApplied = presetId === s.presetId;
            const isBusy = applying === s.presetId;
            return (
              <button
                key={s.presetId}
                type="button"
                onClick={() => void apply(s.presetId)}
                disabled={applying !== null || isApplied}
                title={s.reasons.slice(0, 2).join(" · ")}
                className={
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-60 " +
                  (isApplied
                    ? "border-primary bg-primary/10 text-primary"
                    : i === 0
                      ? "border-primary/40 hover:bg-primary/5"
                      : "hover:bg-muted/40")
                }
              >
                {i === 0 && <span aria-hidden>★</span>}
                <span>{s.presetLabel}</span>
                <span className="text-muted-foreground">
                  {s.score.toFixed(1)}
                </span>
                {isBusy && <span className="text-primary">…</span>}
              </button>
            );
          })}
        </div>

        {/* 펼치면: 전체 프리셋 그리드 */}
        {expanded && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t">
            {TONE_PRESETS.map((p) => {
              const isCurrent = p.id === presetId;
              const isBusy = applying === p.id;
              const suggestion = suggestions?.find((s) => s.presetId === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void apply(p.id)}
                  disabled={applying !== null || isCurrent}
                  className={
                    "text-left border rounded-md p-2 transition-colors disabled:opacity-60 " +
                    (isCurrent
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40 hover:bg-muted/40")
                  }
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium">{p.label}</span>
                    {suggestion && suggestion.score > 0 && (
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {suggestion.score.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {p.description}
                  </p>
                  {isBusy && (
                    <p className="text-[10px] text-primary pt-0.5">적용 중...</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
