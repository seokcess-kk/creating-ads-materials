"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TONE_PRESETS, type TonePresetId } from "@/lib/fonts/tone-pairs";

interface CampaignFontOverrideProps {
  campaignId: string;
  initialPresetId: TonePresetId | null;
  initialPresetLabel: string | null;
}

export function CampaignFontOverride({
  campaignId,
  initialPresetId,
  initialPresetLabel,
}: CampaignFontOverrideProps) {
  const router = useRouter();
  const [presetId, setPresetId] = useState<TonePresetId | null>(initialPresetId);
  const [presetLabel, setPresetLabel] = useState<string | null>(initialPresetLabel);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState<TonePresetId | "clear" | null>(null);

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
        const msg = `${data.presetLabel} 오버라이드 — ${data.filled.length}개 role 적용`;
        toast.success(msg);
        if (data.missing?.length > 0) {
          toast.warning(
            `일부 폰트 미등록: ${data.missing.map((m: { role: string; family: string }) => `${m.role}(${m.family})`).join(", ")}`,
          );
        }
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setApplying(null);
    }
  }

  return (
    <Card className="bg-muted/20">
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">🔤 이 캠페인 폰트</span>
            {presetId ? (
              <Badge variant="secondary">{presetLabel} 오버라이드</Badge>
            ) : (
              <Badge variant="outline">브랜드 기본 사용</Badge>
            )}
          </div>
          <div className="flex gap-1">
            {presetId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => apply(null)}
                disabled={applying !== null}
                className="text-destructive"
              >
                해제
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen((o) => !o)}
              disabled={applying !== null}
            >
              {open ? "접기" : presetId ? "변경" : "오버라이드"}
            </Button>
          </div>
        </div>
        {open && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            {TONE_PRESETS.map((p) => {
              const isCurrent = p.id === presetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => apply(p.id)}
                  disabled={applying !== null || isCurrent}
                  className={
                    "text-left border rounded-md p-2 transition-colors disabled:opacity-60 " +
                    (isCurrent
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40 hover:bg-muted/40")
                  }
                >
                  <div className="text-xs font-medium">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1">
                    {p.description}
                  </div>
                  {applying === p.id && (
                    <div className="text-[10px] text-primary pt-0.5">적용 중...</div>
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
