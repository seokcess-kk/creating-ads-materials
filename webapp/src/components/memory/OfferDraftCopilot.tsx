"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { BrandAudience, BrandOffer } from "@/lib/memory/types";

interface DraftItem {
  title: string;
  usp: string;
  price?: string | null;
  benefits: string[];
  urgency?: string | null;
  evidence?: string[];
  angle: string;
  rationale: string;
}

interface Props {
  brandId: string;
  audiences: BrandAudience[];
  onAccept: (offer: BrandOffer) => void;
}

const INTENT_PRESETS = [
  "메타(인스타그램) 학부모 견학 신청 캠페인",
  "검색 광고용 핵심 셀링 포인트",
  "디스플레이 배너용 브랜드 인지도",
  "리타겟팅 — 사이트 방문자 전환",
];

export function OfferDraftCopilot({ brandId, audiences, onAccept }: Props) {
  const [intent, setIntent] = useState("");
  const [audienceId, setAudienceId] = useState<string>(
    audiences.find((a) => a.is_default)?.id ?? audiences[0]?.id ?? "",
  );
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<DraftItem[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  async function generate() {
    if (!intent.trim()) {
      toast.error("어떤 광고용인지 한 문장으로 입력하세요");
      return;
    }
    if (audiences.length === 0) {
      toast.error("먼저 Audiences 페이지에서 페르소나를 등록하세요");
      return;
    }
    setLoading(true);
    setDrafts(null);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/brands/${brandId}/offers/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: intent.trim(),
          audienceId: audienceId || null,
          count,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI 초안 생성 실패");
      setDrafts(json.drafts);
      setSelected(new Set(json.drafts.map((_: DraftItem, i: number) => i)));
      toast.success(`초안 ${json.drafts.length}개 생성 완료`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function saveSelected() {
    if (!drafts || selected.size === 0) return;
    setSaving(true);
    let okCount = 0;
    for (const i of selected) {
      const d = drafts[i];
      try {
        const res = await fetch(`/api/brands/${brandId}/offers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: d.title,
            usp: d.usp,
            price: d.price ?? null,
            benefits: d.benefits,
            urgency: d.urgency ?? null,
            evidence: d.evidence ?? [],
            is_default: false,
          }),
        });
        if (!res.ok) throw new Error("저장 실패");
        const { offer } = await res.json();
        onAccept(offer);
        okCount++;
      } catch (e) {
        console.warn("draft 저장 실패", e);
      }
    }
    setSaving(false);
    toast.success(`${okCount}개 저장 완료`);
    setDrafts(null);
    setSelected(new Set());
    setIntent("");
  }

  return (
    <Card className="border-primary/40 bg-primary/[0.02]">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span aria-hidden>✨</span> AI로 시작하기
          <Badge variant="secondary" className="ml-2 text-[10px]">
            추천
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          한 문장으로 의도를 알려주면 페르소나·키비주얼·voice를 분석해 오퍼 초안 {count}개를 자동
          생성합니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">어떤 광고를 만들고 싶나요?</Label>
          <Textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            rows={2}
            placeholder="예: 메타 학부모 견학 신청 캠페인 / 검색 광고 핵심 셀링 포인트"
            disabled={loading || saving}
          />
          <div className="flex flex-wrap gap-1">
            {INTENT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setIntent(p)}
                disabled={loading || saving}
                className="text-[11px] rounded-full border px-2 py-0.5 hover:bg-muted transition-colors"
              >
                + {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">페르소나</Label>
            <select
              value={audienceId}
              onChange={(e) => setAudienceId(e.target.value)}
              disabled={loading || saving || audiences.length === 0}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            >
              {audiences.length === 0 && <option value="">페르소나 없음</option>}
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.persona_name}
                  {a.is_default ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">생성 개수</Label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={loading || saving}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}개
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button onClick={generate} disabled={loading || saving} className="w-full">
          {loading ? "AI가 초안을 만들고 있습니다…" : "✨ 초안 생성"}
        </Button>

        {drafts && drafts.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selected.size} / {drafts.length}개 선택됨 — 체크된 항목만 저장됩니다
              </p>
              <Button
                size="sm"
                onClick={saveSelected}
                disabled={saving || selected.size === 0}
              >
                {saving ? "저장 중..." : `선택한 ${selected.size}개 저장`}
              </Button>
            </div>
            <div className="space-y-2">
              {drafts.map((d, i) => {
                const on = selected.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggle(i)}
                    className={`w-full text-left rounded-md border p-3 transition-colors ${
                      on ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={on}
                        readOnly
                        className="mt-1 shrink-0"
                        aria-label={`select ${d.title}`}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{d.title}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {d.angle}
                          </Badge>
                          {d.price && (
                            <Badge variant="outline" className="text-[10px]">
                              {d.price}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{d.usp}</p>
                        {d.benefits.length > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            ✓ {d.benefits.slice(0, 3).join(" · ")}
                            {d.benefits.length > 3 ? ` +${d.benefits.length - 3}` : ""}
                          </p>
                        )}
                        {d.urgency && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">
                            ⏰ {d.urgency}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground italic pt-1">
                          왜 이 앵글? — {d.rationale}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
