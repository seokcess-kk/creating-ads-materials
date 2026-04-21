"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TagInput } from "./TagInput";
import { OptionChips, toggleInList } from "./OptionChips";
import type { BrandAudience } from "@/lib/memory/types";

const LANGUAGE_LEVELS = ["casual", "professional", "expert"];

const PAIN_OPTIONS = [
  "시간 부족",
  "비용 부담",
  "효과 미약",
  "방법 혼란",
  "결과 불확실",
  "선택 장애",
  "이해 어려움",
  "지속성 부족",
  "경쟁 심화",
  "동기 저하",
  "정보 과잉",
  "신뢰 부족",
];

const DESIRE_OPTIONS = [
  "빠른 결과",
  "검증된 솔루션",
  "명확한 방법",
  "자기주도 학습",
  "전문성 획득",
  "인정받기",
  "성장 기회",
  "안정감",
  "시간 절약",
  "비용 절약",
  "프리미엄 경험",
  "도전과 변화",
];

interface AudienceManagerProps {
  brandId: string;
  initial: BrandAudience[];
}

interface Draft {
  persona_name: string;
  age?: string;
  gender?: string;
  region?: string;
  income?: string;
  language_level: string;
  pains: string[];
  desires: string[];
  notes: string;
  is_default: boolean;
}

const EMPTY_DRAFT: Draft = {
  persona_name: "",
  age: "",
  gender: "",
  region: "",
  income: "",
  language_level: "casual",
  pains: [],
  desires: [],
  notes: "",
  is_default: false,
};

export function AudienceManager({ brandId, initial }: AudienceManagerProps) {
  const router = useRouter();
  const [list, setList] = useState<BrandAudience[]>(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT });
  const [saving, setSaving] = useState(false);

  function audienceToDraft(a: BrandAudience): Draft {
    const d = a.demographics as Record<string, string>;
    return {
      persona_name: a.persona_name,
      age: d.age ?? "",
      gender: d.gender ?? "",
      region: d.region ?? "",
      income: d.income ?? "",
      language_level: a.language_level ?? "casual",
      pains: a.pains,
      desires: a.desires,
      notes: a.notes ?? "",
      is_default: a.is_default,
    };
  }

  function startNew() {
    setDraft({ ...EMPTY_DRAFT, is_default: list.length === 0 });
    setEditingId("new");
  }
  function startEdit(a: BrandAudience) {
    setDraft(audienceToDraft(a));
    setEditingId(a.id);
  }

  function buildPayload() {
    return {
      persona_name: draft.persona_name.trim(),
      demographics: {
        ...(draft.age ? { age: draft.age } : {}),
        ...(draft.gender ? { gender: draft.gender } : {}),
        ...(draft.region ? { region: draft.region } : {}),
        ...(draft.income ? { income: draft.income } : {}),
      },
      language_level: draft.language_level,
      pains: draft.pains,
      desires: draft.desires,
      notes: draft.notes.trim() || null,
      is_default: draft.is_default,
    };
  }

  async function save() {
    if (!draft.persona_name.trim()) {
      toast.error("페르소나 이름은 필수입니다");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId === "new") {
        const res = await fetch(`/api/brands/${brandId}/audiences`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "생성 실패");
        const { audience } = await res.json();
        setList((prev) => [audience, ...prev]);
      } else if (editingId) {
        const res = await fetch(`/api/brands/${brandId}/audiences/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "수정 실패");
        const { audience } = await res.json();
        setList((prev) => prev.map((a) => (a.id === audience.id ? audience : a)));
      }
      toast.success("저장 완료");
      setEditingId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 페르소나를 삭제할까요?")) return;
    try {
      const res = await fetch(`/api/brands/${brandId}/audiences/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setList((prev) => prev.filter((a) => a.id !== id));
      toast.success("삭제 완료");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">페르소나 {list.length}개</p>
        {editingId === null && <Button onClick={startNew}>+ 페르소나 추가</Button>}
      </div>

      {editingId !== null && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">
              {editingId === "new" ? "새 페르소나" : "페르소나 수정"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>페르소나 이름 *</Label>
              <Input
                value={draft.persona_name}
                onChange={(e) => setDraft({ ...draft, persona_name: e.target.value })}
                placeholder="예: 고1 학부모, 30대 직장인"
                disabled={saving}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>연령</Label>
                <Input
                  value={draft.age ?? ""}
                  onChange={(e) => setDraft({ ...draft, age: e.target.value })}
                  placeholder="예: 40대"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>성별</Label>
                <Input
                  value={draft.gender ?? ""}
                  onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                  placeholder="남/여/전체"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>지역</Label>
                <Input
                  value={draft.region ?? ""}
                  onChange={(e) => setDraft({ ...draft, region: e.target.value })}
                  placeholder="예: 수도권"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>소득</Label>
                <Input
                  value={draft.income ?? ""}
                  onChange={(e) => setDraft({ ...draft, income: e.target.value })}
                  placeholder="예: 중상층"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>언어 수준</Label>
              <select
                value={draft.language_level}
                onChange={(e) => setDraft({ ...draft, language_level: e.target.value })}
                disabled={saving}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {LANGUAGE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pains (고민·문제)</Label>
                <TagInput
                  value={draft.pains}
                  onChange={(v) => setDraft({ ...draft, pains: v })}
                  placeholder="타겟이 겪는 문제"
                  disabled={saving}
                />
                <OptionChips
                  options={PAIN_OPTIONS}
                  active={draft.pains}
                  onToggle={(v) =>
                    setDraft({ ...draft, pains: toggleInList(draft.pains, v) })
                  }
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>Desires (욕구·목표)</Label>
                <TagInput
                  value={draft.desires}
                  onChange={(v) => setDraft({ ...draft, desires: v })}
                  placeholder="타겟이 원하는 결과"
                  disabled={saving}
                />
                <OptionChips
                  options={DESIRE_OPTIONS}
                  active={draft.desires}
                  onToggle={(v) =>
                    setDraft({ ...draft, desires: toggleInList(draft.desires, v) })
                  }
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={3}
                placeholder="추가 맥락·관심사·반감 요소"
                disabled={saving}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.is_default}
                onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })}
                disabled={saving}
              />
              기본 페르소나로 설정
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingId(null)} disabled={saving}>
                취소
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {list.map((a) => {
          const d = a.demographics as Record<string, string>;
          return (
            <Card key={a.id}>
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{a.persona_name}</h3>
                      {a.is_default && <Badge variant="secondary">default</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[d.age, d.gender, d.region, d.income].filter(Boolean).join(" · ")}
                      {a.language_level && ` · ${a.language_level}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(a)}
                      disabled={editingId !== null}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(a.id)}
                      disabled={editingId !== null}
                      className="text-destructive"
                    >
                      삭제
                    </Button>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-2 text-xs">
                  {a.pains.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Pains</p>
                      <div className="flex flex-wrap gap-1">
                        {a.pains.map((p, i) => (
                          <Badge key={`p-${i}`} variant="outline">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.desires.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Desires</p>
                      <div className="flex flex-wrap gap-1">
                        {a.desires.map((d2, i) => (
                          <Badge key={`d-${i}`} variant="outline">
                            {d2}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
              </CardContent>
            </Card>
          );
        })}
        {list.length === 0 && editingId === null && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              아직 페르소나가 없습니다
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
