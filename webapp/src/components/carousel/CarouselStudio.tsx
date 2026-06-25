"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface BrandOption {
  id: string;
  name: string;
}

interface SlidePlanItem {
  index: number;
  role: "hook" | "point" | "cta";
  purpose: string;
}
type TemplateId = "midnight" | "noir" | "vivid";
const TEMPLATE_OPTIONS: { v: TemplateId; l: string }[] = [
  { v: "midnight", l: "미드나잇 — 차분한 다크블루" },
  { v: "noir", l: "느와르 — 프리미엄 블랙&골드" },
  { v: "vivid", l: "비비드 — 에너지 컬러(좌측 정렬)" },
];

interface BundleConcept {
  title: string;
  bigIdea: string;
  coreMessage: string;
  target: string;
  tone: string;
  narrativeArc: string;
  slideCount: number;
  template: TemplateId;
  slidePlan: SlidePlanItem[];
}
interface SlideRow {
  id: string;
  idx: number;
  role: string;
  kicker: string | null;
  headline: string;
  body: string | null;
  image_url: string | null;
}

type Step = "input" | "concept" | "slides";

async function downloadUrl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank");
  }
}

export function CarouselStudio({ brands }: { brands: BrandOption[] }) {
  const [step, setStep] = useState<Step>("input");

  // 입력
  const [rawContent, setRawContent] = useState("");
  const [tone, setTone] = useState("");
  const [brandId, setBrandId] = useState("");
  const [contentMode, setContentMode] = useState<"persuasion" | "notice">(
    "persuasion",
  );
  const [bgMode, setBgMode] = useState<"shared" | "per-slide">("shared");

  // 레퍼런스(선택) — 첨부 시 배경이 그 디자인 룩으로 통일됨(생성 시 서버에서 분석).
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [refUploading, setRefUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 상태
  const [carouselId, setCarouselId] = useState<string | null>(null);
  const [concept, setConcept] = useState<BundleConcept | null>(null);
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [busy, setBusy] = useState(false);

  const canSubmit = rawContent.trim().length >= 10;

  async function onPickReference(file: File | null) {
    if (!file) return;
    setRefUploading(true);
    try {
      const signRes = await fetch("/api/generate/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(sign.error ?? "업로드 준비 실패");
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(sign.bucket)
        .uploadToSignedUrl(sign.path, sign.token, file);
      if (error) throw error;
      setRefUrl(sign.publicUrl);
      toast.success("레퍼런스 첨부됨 — 배경이 이 디자인 룩으로 통일됩니다");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 오류");
    } finally {
      setRefUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function createConcept() {
    if (!canSubmit) {
      toast.error("원문을 10자 이상 입력하세요");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/carousels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawContent: rawContent.trim(),
          toneOverride: tone.trim() || null,
          brandId: brandId || null,
          contentMode,
          bgMode,
          referenceImageUrl: refUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "기획 생성 실패");
      if (data.error || data.carousel.status === "failed") {
        throw new Error(data.error ?? "기획 생성 실패");
      }
      setCarouselId(data.carousel.id);
      setConcept(data.carousel.concept_json as BundleConcept);
      setStep("concept");
      toast.success("번들 기획 생성됨 — 검토 후 슬라이드를 만드세요");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateConcept() {
    if (!carouselId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/carousels/${carouselId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "재생성 실패");
      setConcept(data.carousel.concept_json as BundleConcept);
      toast.success("기획을 다시 생성했습니다");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function buildSlides() {
    if (!carouselId || !concept) return;
    setBusy(true);
    try {
      // 1) 편집한 기획 저장
      const saveRes = await fetch(`/api/carousels/${carouselId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error ?? "기획 저장 실패");

      // 2) 슬라이드 생성
      toast.info("슬라이드 생성 중… (상세 카피 → 배경 → 합성, ~1분)");
      const res = await fetch(`/api/carousels/${carouselId}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "슬라이드 생성 실패");
      setSlides(data.slides as SlideRow[]);
      setStep("slides");
      toast.success(`슬라이드 ${data.slides.length}장 생성됨`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function saveSlide(slide: SlideRow) {
    if (!carouselId) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/carousels/${carouselId}/slides/${slide.idx}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kicker: slide.kicker,
            headline: slide.headline,
            body: slide.body,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "수정 실패");
      setSlides((prev) =>
        prev.map((s) => (s.id === slide.id ? (data.slide as SlideRow) : s)),
      );
      toast.success(`슬라이드 ${slide.idx} 재합성됨`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  function patchConcept(patch: Partial<BundleConcept>) {
    setConcept((prev) => (prev ? { ...prev, ...patch } : prev));
  }
  function patchPlan(index: number, purpose: string) {
    setConcept((prev) =>
      prev
        ? {
            ...prev,
            slidePlan: prev.slidePlan.map((p) =>
              p.index === index ? { ...p, purpose } : p,
            ),
          }
        : prev,
    );
  }
  function patchSlide(id: string, patch: Partial<SlideRow>) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  // ── STEP 1: 입력 ──────────────────────────────────────────────
  if (step === "input") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">원문 *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            placeholder="캐러셀로 만들 소식·안내·소개 원문을 통째로 붙여넣으세요"
            rows={8}
            disabled={busy}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">톤 (선택)</Label>
              <Input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="예: 신뢰감 있고 간결하게"
                disabled={busy}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">브랜드 (선택)</Label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                disabled={busy}
                className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring disabled:opacity-50"
              >
                <option value="">사용 안 함</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="space-y-1">
              <Label className="text-xs">콘텐츠 유형</Label>
              <div className="flex gap-1.5">
                {[
                  { v: "persuasion", l: "설득형" },
                  { v: "notice", l: "공지/안내" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    disabled={busy}
                    onClick={() => setContentMode(o.v as "persuasion" | "notice")}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50",
                      contentMode === o.v
                        ? "border-foreground font-medium"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">배경</Label>
              <div className="flex gap-1.5">
                {[
                  { v: "shared", l: "공통 1장" },
                  { v: "per-slide", l: "슬라이드별" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    disabled={busy}
                    onClick={() => setBgMode(o.v as "shared" | "per-slide")}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50",
                      bgMode === o.v
                        ? "border-foreground font-medium"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 레퍼런스 첨부(선택) — 배경 디자인 룩 통일 */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">레퍼런스 이미지 (선택)</Label>
              {refUrl ? (
                <button
                  type="button"
                  onClick={() => setRefUrl(null)}
                  disabled={busy}
                  className="text-[11px] text-muted-foreground underline disabled:opacity-50"
                >
                  제거
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={refUploading || busy}
                  className="text-[11px] text-primary underline disabled:opacity-50"
                >
                  {refUploading ? "업로드 중…" : "+ 첨부"}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickReference(e.target.files?.[0] ?? null)}
              />
            </div>
            {refUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={refUrl}
                  alt="레퍼런스"
                  className="h-16 w-16 rounded-md border object-cover"
                />
                <span className="text-[11px] text-muted-foreground">
                  팔레트·무드·구도를 추출해 전 슬라이드 배경에 반영합니다.
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                원하는 분위기의 이미지를 첨부하면 배경이 그 룩으로 통일됩니다.
              </p>
            )}
          </div>

          <Button onClick={createConcept} disabled={!canSubmit || busy}>
            {busy ? "기획 생성 중…" : "번들 기획 만들기 →"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── STEP 2: 기획 리뷰/편집 ────────────────────────────────────
  if (step === "concept" && concept) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">1단계 · 번들 기획</Badge>
          <button
            type="button"
            onClick={() => setStep("input")}
            className="text-xs text-muted-foreground underline"
          >
            ← 원문 수정
          </button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">캐러셀 전체 기획</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="빅 아이디어">
              <Input
                value={concept.bigIdea}
                onChange={(e) => patchConcept({ bigIdea: e.target.value })}
                disabled={busy}
              />
            </Field>
            <Field label="핵심 메시지">
              <Textarea
                value={concept.coreMessage}
                onChange={(e) => patchConcept({ coreMessage: e.target.value })}
                rows={2}
                disabled={busy}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="타겟">
                <Input
                  value={concept.target}
                  onChange={(e) => patchConcept({ target: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="톤">
                <Input
                  value={concept.tone}
                  onChange={(e) => patchConcept({ tone: e.target.value })}
                  disabled={busy}
                />
              </Field>
            </div>
            <Field label="서사 흐름">
              <Textarea
                value={concept.narrativeArc}
                onChange={(e) => patchConcept({ narrativeArc: e.target.value })}
                rows={2}
                disabled={busy}
              />
            </Field>
            <Field label="비주얼 템플릿">
              <select
                value={concept.template ?? "midnight"}
                onChange={(e) =>
                  patchConcept({ template: e.target.value as TemplateId })
                }
                disabled={busy}
                className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:border-ring disabled:opacity-50"
              >
                {TEMPLATE_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                AI가 톤에 맞춰 자동 선택했습니다. 바꾸면 배경·색이 함께 바뀝니다(슬라이드 다시 만들기 시 반영).
              </p>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              슬라이드 구성
              <Badge variant="outline">{concept.slidePlan.length}장</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {concept.slidePlan.map((p) => (
              <div key={p.index} className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {p.index} · {p.role}
                </Badge>
                <Input
                  value={p.purpose}
                  onChange={(e) => patchPlan(p.index, e.target.value)}
                  disabled={busy}
                  className="h-7 text-xs"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={buildSlides} disabled={busy}>
            {busy ? "처리 중…" : "이 기획으로 슬라이드 만들기 →"}
          </Button>
          <Button variant="outline" onClick={regenerateConcept} disabled={busy}>
            AI로 다시 기획
          </Button>
        </div>
      </div>
    );
  }

  // ── STEP 3: 슬라이드 리뷰/편집 ────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">2단계 · 슬라이드 {slides.length}장</Badge>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep("concept")}
            className="text-xs text-muted-foreground underline"
          >
            ← 기획 수정
          </button>
          {carouselId && (
            <button
              type="button"
              onClick={() =>
                downloadUrl(
                  `/api/carousels/${carouselId}/download`,
                  `carousel_${carouselId}.zip`,
                )
              }
              className="text-xs text-primary underline"
            >
              전체 zip 다운로드
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {slides.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-start gap-3">
                {s.image_url && (
                  <img
                    src={s.image_url}
                    alt={`슬라이드 ${s.idx}`}
                    className="w-32 h-32 shrink-0 rounded-md border object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {s.idx} · {s.role}
                    </Badge>
                    {s.image_url && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadUrl(
                            s.image_url as string,
                            `slide_${String(s.idx).padStart(2, "0")}.png`,
                          )
                        }
                        className="text-[11px] text-primary underline"
                      >
                        다운로드
                      </button>
                    )}
                  </div>
                  <Input
                    value={s.headline}
                    onChange={(e) => patchSlide(s.id, { headline: e.target.value })}
                    disabled={busy}
                    className="h-7 text-xs"
                    placeholder="헤드라인"
                  />
                  <Textarea
                    value={s.body ?? ""}
                    onChange={(e) => patchSlide(s.id, { body: e.target.value })}
                    disabled={busy}
                    rows={2}
                    placeholder="본문 (선택)"
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveSlide(s)}
                    disabled={busy}
                  >
                    수정 반영(재합성)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={buildSlides} disabled={busy}>
        슬라이드 전체 다시 만들기
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
