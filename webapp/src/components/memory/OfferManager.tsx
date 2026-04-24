"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TagInput } from "./TagInput";
import { OptionChips, toggleInList } from "./OptionChips";
import { OfferDraftCopilot } from "./OfferDraftCopilot";
import type { Brand, BrandAudience, BrandIdentity, BrandOffer } from "@/lib/memory/types";
import { getDomainOptions } from "@/lib/memory/offer-domain";
import {
  OFFER_LIMITS,
  countChars,
  detectTabooHits,
  type CharCounterState,
} from "@/lib/memory/offer-validate";

interface OfferManagerProps {
  brandId: string;
  initial: BrandOffer[];
  brand: Brand;
  identity: BrandIdentity | null;
  audiences: BrandAudience[];
}

const EMPTY: Omit<BrandOffer, "id" | "brand_id" | "created_at" | "updated_at"> = {
  title: "",
  usp: null,
  price: null,
  benefits: [],
  urgency: null,
  evidence: [],
  is_default: false,
};

function CharCounter({ state }: { state: CharCounterState }) {
  const color =
    state.level === "over"
      ? "text-destructive"
      : state.level === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <span className={`text-[10px] tabular-nums ${color}`}>
      {state.count}/{state.soft}자{state.level === "over" ? ` (최대 ${state.hard})` : ""}
    </span>
  );
}

function HelpHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full border text-[10px] text-muted-foreground cursor-help"
      aria-label="도움말"
    >
      ?
    </span>
  );
}

export function OfferManager({
  brandId,
  initial,
  brand,
  identity,
  audiences,
}: OfferManagerProps) {
  const router = useRouter();
  const [list, setList] = useState<BrandOffer[]>(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const domain = useMemo(() => getDomainOptions(brand.category), [brand.category]);
  const brandTaboos = useMemo(() => identity?.taboos ?? [], [identity]);

  const titleCount = countChars(draft.title, OFFER_LIMITS.titleSoft, OFFER_LIMITS.titleHard);
  const uspCount = countChars(
    draft.usp ?? "",
    OFFER_LIMITS.uspSoft,
    OFFER_LIMITS.uspHard,
  );
  const tabooHits = useMemo(
    () =>
      detectTabooHits(
        {
          title: draft.title,
          usp: draft.usp,
          benefits: draft.benefits,
          urgency: draft.urgency,
          evidence: draft.evidence,
        },
        brandTaboos,
      ),
    [draft, brandTaboos],
  );

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
  function startDuplicate(o: BrandOffer) {
    setDraft({
      title: `${o.title} (변형)`,
      usp: o.usp,
      price: o.price,
      benefits: [...o.benefits],
      urgency: o.urgency,
      evidence: [...o.evidence],
      is_default: false,
    });
    setEditingId("new");
    toast.message("복제됨 — 타이틀·USP를 변형해서 저장하세요");
  }
  function cancel() {
    setEditingId(null);
  }

  function pushAccepted(offer: BrandOffer) {
    setList((prev) => [offer, ...prev]);
    router.refresh();
  }

  async function save() {
    if (!draft.title.trim()) {
      toast.error("타이틀은 필수입니다");
      return;
    }
    if (titleCount.level === "over") {
      toast.error(`타이틀이 너무 깁니다 (최대 ${OFFER_LIMITS.titleHard}자)`);
      return;
    }
    if (uspCount.level === "over") {
      toast.error(`USP가 너무 깁니다 (최대 ${OFFER_LIMITS.uspHard}자)`);
      return;
    }
    if (tabooHits.length > 0) {
      const proceed = confirm(
        `금기 표현이 ${tabooHits.length}개 감지되었습니다 (${tabooHits
          .map((h) => h.term)
          .join(", ")}). 계속 저장할까요?`,
      );
      if (!proceed) return;
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
        toast.success("저장 완료", {
          action: {
            label: "캠페인 만들기 →",
            onClick: () => router.push(`/brands/${brandId}/campaigns/new`),
          },
        });
      } else if (editingId) {
        const res = await fetch(`/api/brands/${brandId}/offers/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "수정 실패");
        const { offer } = await res.json();
        setList((prev) => prev.map((o) => (o.id === offer.id ? offer : o)));
        toast.success("수정 완료");
      }
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
      {editingId === null && (
        <OfferDraftCopilot
          brandId={brandId}
          audiences={audiences}
          onAccept={pushAccepted}
        />
      )}

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">오퍼 {list.length}개</p>
        {editingId === null && (
          <Button onClick={startNew} variant="outline">
            + 직접 입력
          </Button>
        )}
      </div>

      {editingId !== null && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">
                {editingId === "new" ? "새 오퍼" : "오퍼 수정"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tabooHits.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                  ⚠ 금기 표현 감지: {tabooHits.map((h) => `"${h.term}"`).join(", ")}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    타이틀 *
                    <HelpHint text="오퍼 카드/광고에 노출되는 짧은 이름. 16자 이내 권장." />
                  </Label>
                  <CharCounter state={titleCount} />
                </div>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder={domain.titleHint}
                  disabled={saving}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      USP
                      <HelpHint text="이 오퍼만의 차별점 한 줄. 광고 헤드라인 후보로 활용됩니다." />
                    </Label>
                    <CharCounter state={uspCount} />
                  </div>
                  <Input
                    value={draft.usp ?? ""}
                    onChange={(e) => setDraft({ ...draft, usp: e.target.value || null })}
                    placeholder={domain.uspHint}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    가격
                    <HelpHint text="할인 노출 시 '원가 → 할인가' 형식 권장. 비공개면 비워두세요." />
                  </Label>
                  <Input
                    value={draft.price ?? ""}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value || null })}
                    placeholder="예: 35만원 → 25만원"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  혜택 (benefits)
                  <HelpHint text="검증 가능한 사실만. 3~5개 권장. 추천 칩 또는 직접 입력." />
                </Label>
                <TagInput
                  value={draft.benefits}
                  onChange={(v) => setDraft({ ...draft, benefits: v })}
                  placeholder="구체적 혜택 항목"
                  disabled={saving}
                />
                <OptionChips
                  options={domain.benefits}
                  active={draft.benefits}
                  onToggle={(v) =>
                    setDraft({ ...draft, benefits: toggleInList(draft.benefits, v) })
                  }
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  긴급성 (urgency)
                  <HelpHint text="가짜 다급함 금지. 정원제·시즌 한정 등 사실 기반만." />
                </Label>
                <Textarea
                  value={draft.urgency ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, urgency: e.target.value || null })
                  }
                  placeholder="예: 정원제 운영, 대기 등록 필요"
                  rows={2}
                  disabled={saving}
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {domain.urgency.map((t) => (
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
                <Label className="flex items-center gap-1.5">
                  증거 (evidence)
                  <HelpHint text="검증 가능한 신뢰 신호 (수치·인증·경력). 추측 금지." />
                </Label>
                <TagInput
                  value={draft.evidence}
                  onChange={(v) => setDraft({ ...draft, evidence: v })}
                  placeholder="수치/인증/경력 등"
                  disabled={saving}
                />
                <OptionChips
                  options={domain.evidence}
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

          <OfferLivePreview draft={draft} brandName={brand.name} />
        </div>
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
                    onClick={() => startDuplicate(o)}
                    disabled={editingId !== null}
                    title="복제하여 변형 만들기"
                  >
                    복제
                  </Button>
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
              아직 오퍼가 없습니다. 위 ✨ AI 시작하기로 4개를 한 번에 만들어보세요.
            </CardContent>
          </Card>
        )}
      </div>

      {list.length > 0 && editingId === null && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs flex items-center justify-between">
          <span className="text-muted-foreground">
            오퍼가 준비됐다면 다음 단계로 진행하세요
          </span>
          <Link href={`/brands/${brandId}/campaigns/new`}>
            <Button size="sm" variant="default">
              캠페인 만들기 →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function OfferLivePreview({
  draft,
  brandName,
}: {
  draft: typeof EMPTY;
  brandName: string;
}) {
  return (
    <div className="space-y-2 sticky top-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        광고 미리보기 (4:5)
      </p>
      <div className="aspect-[4/5] rounded-lg border-2 border-dashed bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 flex flex-col">
        <div className="text-[9px] text-muted-foreground">{brandName}</div>
        <div className="flex-1 flex flex-col justify-center space-y-2">
          <div className="text-base font-bold leading-tight line-clamp-3 text-foreground">
            {draft.title || "타이틀 미입력"}
          </div>
          {draft.usp && (
            <div className="text-xs text-muted-foreground line-clamp-3">{draft.usp}</div>
          )}
          {draft.benefits.length > 0 && (
            <ul className="text-[10px] space-y-0.5 text-muted-foreground">
              {draft.benefits.slice(0, 4).map((b, i) => (
                <li key={i}>✓ {b}</li>
              ))}
            </ul>
          )}
          {draft.price && (
            <div className="text-xs font-semibold text-foreground">{draft.price}</div>
          )}
        </div>
        <div className="space-y-1.5">
          {draft.urgency && (
            <div className="text-[10px] text-amber-700 dark:text-amber-400">
              ⏰ {draft.urgency}
            </div>
          )}
          <div className="rounded-md bg-foreground text-background text-center py-1.5 text-[10px] font-semibold">
            지금 신청하기 →
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        실제 광고는 카피·비주얼 단계에서 정밀 합성됩니다. 이 미리보기는 입력 정보의
        구조 점검용입니다.
      </p>
    </div>
  );
}
