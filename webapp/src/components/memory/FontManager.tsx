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
  const [editingRole, setEditingRole] = useState<FontRole | null>(null);

  useEffect(() => {
    const ids = pairs.map((p) => p.font_id).filter((id) => !fontIndex[id]);
    if (ids.length === 0) return;
    (async () => {
      const res = await fetch(`/api/fonts?limit=200`);
      if (!res.ok) return;
      const { fonts } = await res.json();
      const next: Record<string, FontRow> = { ...fontIndex };
      for (const f of fonts as FontRow[]) next[f.id] = f;
      setFontIndex(next);
    })();
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

  return (
    <div className="space-y-6">
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
