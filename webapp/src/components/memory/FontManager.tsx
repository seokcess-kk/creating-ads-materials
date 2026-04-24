"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type {
  BrandFontPair,
  FontRole,
  FontRow,
  FontTier,
} from "@/lib/memory/types";

const ROLES: Array<{ id: FontRole; label: string; hint: string }> = [
  { id: "headline", label: "Headline", hint: "메인 카피" },
  { id: "sub", label: "Sub", hint: "서브 카피 / 본문" },
  { id: "cta", label: "CTA", hint: "버튼 / 행동 유도" },
  { id: "brand", label: "Brand", hint: "브랜드명 / 로고 텍스트" },
  { id: "slogan", label: "Slogan", hint: "슬로건 / 감성 카피" },
];

const SOURCE_LABEL: Record<string, string> = {
  bp_typography: "BP 분석",
  voice_tone: "Voice Tone",
  category: "카테고리",
};

interface FontManagerProps {
  brandId: string;
  initialPairs: BrandFontPair[];
}

export function FontManager({ brandId, initialPairs }: FontManagerProps) {
  const router = useRouter();
  const [pairs, setPairs] = useState<BrandFontPair[]>(initialPairs);
  const [fontIndex, setFontIndex] = useState<Record<string, FontRow>>({});
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<FontTier | "all">("all");
  const [results, setResults] = useState<FontRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [editingRole, setEditingRole] = useState<FontRole | null>(null);

  useEffect(() => {
    const ids = pairs.map((p) => p.font_id).filter((id) => !fontIndex[id]);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/fonts?ids=${encodeURIComponent(ids.join(","))}&limit=${ids.length}`,
      );
      if (!res.ok || cancelled) return;
      const { fonts } = await res.json();
      if (cancelled) return;
      setFontIndex((prev) => {
        const next: Record<string, FontRow> = { ...prev };
        for (const f of fonts as FontRow[]) next[f.id] = f;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [pairs, fontIndex]);

  async function runSearch() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (tier !== "all") params.set("tier", tier);
      params.set("limit", "50");
      const res = await fetch(`/api/fonts?${params}`);
      if (!res.ok) throw new Error("검색 실패");
      const { fonts } = await res.json();
      setResults(fonts);
      const next: Record<string, FontRow> = { ...fontIndex };
      for (const f of fonts as FontRow[]) next[f.id] = f;
      setFontIndex(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 마운트 시 폰트 목록 초기 조회 — 외부 fetch 트리거. runSearch는 검색/필터 상태를 참조하지만
    // 초기 1회만 실행해야 하므로 의존성 분석에서 제외한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function assign(role: FontRole, fontId: string) {
    try {
      const res = await fetch(`/api/brands/${brandId}/font-pairs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, font_id: fontId, hierarchy_ratio: 1.0 }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "적용 실패");
      const { pair } = await res.json();
      setPairs((prev) => {
        const filtered = prev.filter((p) => p.role !== role);
        return [...filtered, pair];
      });
      toast.success(`${role} 적용 완료`);
      setEditingRole(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  async function autoPrefill(force: boolean) {
    setPrefilling(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/font-pairs/prefill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추천 실패");
      const { result, presetLabel } = data as {
        result: {
          skipped: boolean;
          reason?: string;
          presetId?: string;
          source?: string;
          filled: Array<{ role: FontRole; fontId: string }>;
          missing: Array<{ role: FontRole; family: string; weight: string }>;
        };
        presetLabel: string | null;
      };

      if (result.skipped) {
        if (result.reason === "has_existing_pairs") {
          toast.info(
            "이미 설정된 폰트가 있습니다. 덮어쓰려면 '다시 추천'을 누르세요.",
          );
        } else {
          toast.warning(
            "voice.tone·BP·카테고리에서 프리셋을 결정할 신호를 찾지 못했습니다",
          );
        }
        return;
      }

      const sourceLabel = result.source ? SOURCE_LABEL[result.source] : null;
      toast.success(
        `${presetLabel ?? result.presetId} 프리셋 적용 — ${result.filled.length}개 role${sourceLabel ? ` · ${sourceLabel} 기반` : ""}`,
      );
      if (result.missing.length > 0) {
        toast.warning(
          `일부 폰트 미등록: ${result.missing.map((m) => `${m.role}(${m.family})`).join(", ")}`,
        );
      }

      // pair 목록 새로고침
      const refreshed = await fetch(`/api/brands/${brandId}/font-pairs`);
      if (refreshed.ok) {
        const { pairs: nextPairs } = await refreshed.json();
        setPairs(nextPairs);
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setPrefilling(false);
    }
  }

  async function unassign(role: FontRole) {
    try {
      const res = await fetch(`/api/brands/${brandId}/font-pairs/${role}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("해제 실패");
      setPairs((prev) => prev.filter((p) => p.role !== role));
      toast.success(`${role} 해제 완료`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  function fontLabel(font: FontRow) {
    return `${font.family}${font.weight ? ` · ${font.weight}` : ""} [${font.tier}]`;
  }

  const hasAnyPair = pairs.length > 0;

  return (
    <div className="space-y-6">
      <Card className="bg-muted/20">
        <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="text-2xl" aria-hidden>
              ✨
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">자동 추천</p>
              <p className="text-xs text-muted-foreground">
                BP 분석 · Voice Tone · 카테고리로 5개 role을 한 번에 설정합니다
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={hasAnyPair ? "outline" : "default"}
            onClick={() => autoPrefill(hasAnyPair)}
            disabled={prefilling}
          >
            {prefilling
              ? "추천 중..."
              : hasAnyPair
                ? "다시 추천 (덮어쓰기)"
                : "자동 추천"}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold mb-3">역할별 폰트 조합</h2>
        <div className="space-y-2">
          {ROLES.map(({ id, label, hint }) => {
            const pair = pairs.find((p) => p.role === id);
            const font = pair ? fontIndex[pair.font_id] : null;
            return (
              <Card key={id}>
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="w-24">
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <div className="flex-1">
                    {font ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{font.family}</Badge>
                        {font.weight && <Badge variant="outline">{font.weight}</Badge>}
                        <Badge variant="outline" className="text-xs">
                          {font.tier}
                        </Badge>
                      </div>
                    ) : pair ? (
                      <span className="text-xs text-muted-foreground">폰트 정보 로드 중...</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">미설정</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={editingRole === id ? "secondary" : "outline"}
                      onClick={() => setEditingRole(editingRole === id ? null : id)}
                    >
                      {font ? "변경" : "선택"}
                    </Button>
                    {font && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => unassign(id)}
                        className="text-destructive"
                      >
                        해제
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {editingRole && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">{editingRole} 폰트 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="family 검색 (예: Pretendard)"
              />
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as FontTier | "all")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">전체</option>
                <option value="tier1">Tier 1 (웹)</option>
                <option value="tier0">Tier 0 (카탈로그)</option>
                <option value="tier2">Tier 2 (업로드)</option>
              </select>
              <Button onClick={runSearch} disabled={loading}>
                {loading ? "..." : "검색"}
              </Button>
            </div>
            <div className="max-h-96 overflow-auto border rounded-md">
              {results.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  결과 없음
                </div>
              ) : (
                <div className="divide-y">
                  {results.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => assign(editingRole, f.id)}
                      className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center justify-between"
                    >
                      <span className="text-sm">{fontLabel(f)}</span>
                      <div className="flex gap-1">
                        {f.tone_tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setEditingRole(null)}>
                닫기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
