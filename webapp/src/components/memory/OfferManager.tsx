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
import type { BrandOffer } from "@/lib/memory/types";

interface OfferManagerProps {
  brandId: string;
  initial: BrandOffer[];
}

const BENEFIT_OPTIONS = [
  "무료 체험",
  "1:1 상담·피드백",
  "AI 맞춤 기능",
  "할인 혜택",
  "멤버십 특전",
  "24시간 지원",
  "전문가 강의",
  "모바일 앱",
  "오프라인 참여",
  "환불 보장",
  "무료 배송",
  "즉시 이용",
];

const URGENCY_TEMPLATES = [
  "이번 주 한정",
  "선착순 100명",
  "한정 수량",
  "오픈 이벤트",
  "월말까지 한정",
  "당일 발송",
];

const EVIDENCE_OPTIONS = [
  "연속 1위",
  "누적 이용자 N만명",
  "만족도 95%",
  "공식 인증",
  "수상 경력",
  "언론 보도",
  "실사용 후기 N건",
];

const EMPTY: Omit<BrandOffer, "id" | "brand_id" | "created_at" | "updated_at"> = {
  title: "",
  usp: null,
  price: null,
  benefits: [],
  urgency: null,
  evidence: [],
  is_default: false,
};

export function OfferManager({ brandId, initial }: OfferManagerProps) {
  const router = useRouter();
  const [list, setList] = useState<BrandOffer[]>(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  function startNew() {
    setDraft({ ...EMPTY, is_default: list.length === 0 });
    setEditingId("new");
  }
  function startEdit(o: BrandOffer) {
    setDraft({
      title: o.title,
      usp: o.usp,
      price: o.price,
      benefits: o.benefits,
      urgency: o.urgency,
      evidence: o.evidence,
      is_default: o.is_default,
    });
    setEditingId(o.id);
  }
  function cancel() {
    setEditingId(null);
  }

  async function save() {
    if (!draft.title.trim()) {
      toast.error("타이틀은 필수입니다");
      return;
    }
    setSaving(true);
    try {
      if (editingId === "new") {
        const res = await fetch(`/api/brands/${brandId}/offers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "생성 실패");
        const { offer } = await res.json();
        setList((prev) => [offer, ...prev]);
      } else if (editingId) {
        const res = await fetch(`/api/brands/${brandId}/offers/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "수정 실패");
        const { offer } = await res.json();
        setList((prev) => prev.map((o) => (o.id === offer.id ? offer : o)));
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
    if (!confirm("이 오퍼를 삭제할까요?")) return;
    try {
      const res = await fetch(`/api/brands/${brandId}/offers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setList((prev) => prev.filter((o) => o.id !== id));
      toast.success("삭제 완료");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">오퍼 {list.length}개</p>
        {editingId === null && <Button onClick={startNew}>+ 오퍼 추가</Button>}
      </div>

      {editingId !== null && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">
              {editingId === "new" ? "새 오퍼" : "오퍼 수정"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>타이틀 *</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="예: 봄 신학기 3개월 패키지"
                disabled={saving}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>USP</Label>
                <Input
                  value={draft.usp ?? ""}
                  onChange={(e) => setDraft({ ...draft, usp: e.target.value || null })}
                  placeholder="차별점 한 줄"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>가격</Label>
                <Input
                  value={draft.price ?? ""}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value || null })}
                  placeholder="예: 월 99,000원"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>혜택 (benefits)</Label>
              <TagInput
                value={draft.benefits}
                onChange={(v) => setDraft({ ...draft, benefits: v })}
                placeholder="구체적 혜택 항목"
                disabled={saving}
              />
              <OptionChips
                options={BENEFIT_OPTIONS}
                active={draft.benefits}
                onToggle={(v) =>
                  setDraft({ ...draft, benefits: toggleInList(draft.benefits, v) })
                }
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>긴급성 (urgency)</Label>
              <Textarea
                value={draft.urgency ?? ""}
                onChange={(e) => setDraft({ ...draft, urgency: e.target.value || null })}
                placeholder="예: 3/15까지 한정 / 선착순 100명"
                rows={2}
                disabled={saving}
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {URGENCY_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraft({ ...draft, urgency: t })}
                    disabled={saving}
                    className="text-[11px] rounded-full border px-2 py-0.5 hover:bg-muted transition-colors"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>증거 (evidence)</Label>
              <TagInput
                value={draft.evidence}
                onChange={(v) => setDraft({ ...draft, evidence: v })}
                placeholder="수치/인증/수상 등"
                disabled={saving}
              />
              <OptionChips
                options={EVIDENCE_OPTIONS}
                active={draft.evidence}
                onToggle={(v) =>
                  setDraft({ ...draft, evidence: toggleInList(draft.evidence, v) })
                }
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
              기본 오퍼로 설정
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancel} disabled={saving}>
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
        {list.map((o) => (
          <Card key={o.id}>
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{o.title}</h3>
                    {o.is_default && <Badge variant="secondary">default</Badge>}
                  </div>
                  {o.usp && <p className="text-sm text-muted-foreground">{o.usp}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(o)}
                    disabled={editingId !== null}
                  >
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(o.id)}
                    disabled={editingId !== null}
                    className="text-destructive"
                  >
                    삭제
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {o.price && <Badge variant="outline">{o.price}</Badge>}
                {o.benefits.map((b, i) => (
                  <Badge key={`b-${i}`} variant="outline">
                    ✓ {b}
                  </Badge>
                ))}
                {o.urgency && <Badge variant="outline">⏰ {o.urgency}</Badge>}
              </div>
              {o.evidence.length > 0 && (
                <p className="text-xs text-muted-foreground">증거: {o.evidence.join(" · ")}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && editingId === null && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              아직 오퍼가 없습니다
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
