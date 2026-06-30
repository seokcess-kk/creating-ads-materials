"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LIGHTING_PRESETS, PALETTE_PRESETS, MOOD_PRESETS } from "@/lib/style-presets";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { DownloadButton } from "@/components/common/DownloadButton";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import { useNotifications } from "@/components/notifications/NotificationContext";

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

/** 최근 캐러셀 목록(상단 스트립). */
export interface RecentCarousel {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

/** ?id로 재오픈 시 서버가 넘기는 하이드레이션 데이터. */
export interface InitialCarousel {
  id: string;
  status: string;
  rawContent: string;
  toneOverride: string | null;
  brandId: string | null;
  contentMode: "persuasion" | "notice";
  bgMode: "shared" | "per-slide";
  renderMode: "full" | "overlay";
  referenceUrl: string | null;
  concept: BundleConcept | null;
  slides: SlideRow[];
}

type Step = "input" | "concept" | "slides";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  concept: "기획",
  generating: "생성중",
  ready: "완료",
  failed: "실패",
};

const MIN_SLIDES = 4;
const MAX_SLIDES = 5; // 광고 캐러셀 UX 권장 상한(인지 부하 최소화)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SWIPE_THRESHOLD = 40; // px — 라이트박스 좌우 스와이프 인식 최소 이동

/** 슬라이드 계획을 index 1..N 연속 + 역할(첫=hook, 끝=cta, 중간=point)로 정규화. */
function normalizePlan(items: SlidePlanItem[]): SlidePlanItem[] {
  const n = items.length;
  return items.map((it, i) => ({
    ...it,
    index: i + 1,
    role: (i === 0 ? "hook" : i === n - 1 ? "cta" : "point") as SlidePlanItem["role"],
  }));
}

export function CarouselStudio({
  brands,
  recent = [],
  initial = null,
}: {
  brands: BrandOption[];
  recent?: RecentCarousel[];
  initial?: InitialCarousel | null;
}) {
  const initialStep: Step = initial
    ? initial.status === "ready" && initial.slides.length > 0
      ? "slides"
      : initial.concept
        ? "concept"
        : "input"
    : "input";

  const [step, setStep] = useState<Step>(initialStep);

  // 입력
  const [rawContent, setRawContent] = useState(initial?.rawContent ?? "");
  const [tone, setTone] = useState(initial?.toneOverride ?? "");
  const [brandId, setBrandId] = useState(initial?.brandId ?? "");
  const [contentMode, setContentMode] = useState<"persuasion" | "notice">(
    initial?.contentMode ?? "persuasion",
  );
  const [bgMode, setBgMode] = useState<"shared" | "per-slide">(
    initial?.bgMode ?? "shared",
  );
  const [renderMode, setRenderMode] = useState<"full" | "overlay">(
    // 기본은 overlay(수정 가능한 광고형) — 정확성·편집성 우선. full(AI 일체형)은 옵트인.
    initial?.renderMode ?? "overlay",
  );
  // 구조화 스타일 노브(프리셋 칩) — 빈 값이면 아트디렉터 자율.
  const [lighting, setLighting] = useState("");
  const [palette, setPalette] = useState("");
  const [mood, setMood] = useState("");

  // 레퍼런스(선택) — 첨부 시 배경이 그 디자인 룩으로 통일됨(생성 시 서버에서 분석).
  const [refUrl, setRefUrl] = useState<string | null>(
    initial?.referenceUrl ?? null,
  );
  const [refUploading, setRefUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 상태
  const [carouselId, setCarouselId] = useState<string | null>(
    initial?.id ?? null,
  );
  const [concept, setConcept] = useState<BundleConcept | null>(
    initial?.concept ?? null,
  );
  const [slides, setSlides] = useState<SlideRow[]>(initial?.slides ?? []);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null); // 재합성 중인 슬라이드
  // busy는 모든 입력을 잠그는 공용 플래그, pendingAction은 어느 버튼에 스피너를 띄울지 구분.
  const [pendingAction, setPendingAction] = useState<
    null | "concept" | "regenerate" | "slides"
  >(null);

  const { startOp, completeOp, failOp } = useNotifications();

  // 슬라이드 라이트박스(큰 미리보기 + 이전/다음 + 스와이프)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const showPrev = () =>
    setPreviewIdx((i) =>
      i === null ? i : (i - 1 + slides.length) % slides.length,
    );
  const showNext = () =>
    setPreviewIdx((i) => (i === null ? i : (i + 1) % slides.length));

  const canSubmit = rawContent.trim().length >= 10;

  useEffect(() => {
    if (previewIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewIdx(null);
      else if (e.key === "ArrowLeft")
        setPreviewIdx((i) =>
          i === null ? i : (i - 1 + slides.length) % slides.length,
        );
      else if (e.key === "ArrowRight")
        setPreviewIdx((i) => (i === null ? i : (i + 1) % slides.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewIdx, slides.length]);

  const preview = previewIdx !== null ? slides[previewIdx] ?? null : null;

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
    setPendingAction("concept");
    const opId = startOp({
      kind: "strategy",
      title: "번들 기획 생성",
      subtitle: "콘셉트 · 서사 · 슬라이드 구성",
      estimatedSeconds: 15,
      steps: [
        { label: "원문 분석", atSec: 0 },
        { label: "콘셉트·서사 도출", atSec: 4 },
        { label: "슬라이드 구성 설계", atSec: 11 },
      ],
      celebrate: false,
    });
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
          renderMode,
          lighting: lighting || null,
          palette: palette || null,
          mood: mood || null,
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
      // URL에 id 반영 → 새로고침 시 서버가 이 캐러셀을 복원(리마운트 없이 주소만 갱신).
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/carousel?id=${data.carousel.id}`);
      }
      completeOp(opId, { subtitle: "기획 완료 — 검토 후 슬라이드를 만드세요" });
      toast.success("번들 기획 생성됨 — 검토 후 슬라이드를 만드세요");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      failOp(opId, msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function regenerateConcept() {
    if (!carouselId) return;
    setBusy(true);
    setPendingAction("regenerate");
    const opId = startOp({
      kind: "strategy",
      title: "기획 다시 생성",
      subtitle: "콘셉트·서사 재도출",
      estimatedSeconds: 14,
      celebrate: false,
    });
    try {
      const res = await fetch(`/api/carousels/${carouselId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "재생성 실패");
      setConcept(data.carousel.concept_json as BundleConcept);
      completeOp(opId, { subtitle: "기획을 다시 생성했습니다" });
      toast.success("기획을 다시 생성했습니다");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      failOp(opId, msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function buildSlides() {
    if (!carouselId || !concept) return;
    setBusy(true);
    setGenerating(true);
    setPendingAction("slides");
    const slideEst = renderMode === "full" ? 70 : 35;
    const opId = startOp({
      kind: "compose",
      title: "슬라이드 생성",
      subtitle: `${concept.slidePlan.length}장 · ${
        renderMode === "full" ? "AI 일체형" : "광고형"
      }`,
      estimatedSeconds: slideEst,
      steps: [
        { label: "기획 저장", atSec: 0 },
        { label: "슬라이드 배경·디자인 생성", atSec: 4 },
        { label: "마무리·정리", atSec: Math.round(slideEst * 0.85) },
      ],
      celebrate: false,
    });
    let polling = false; // finally에서 끄려면 try 바깥 스코프여야 함
    try {
      // 1) 편집한 기획 저장
      const saveRes = await fetch(`/api/carousels/${carouselId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error ?? "기획 저장 실패");

      // 2) 슬라이드 생성 — 생성 화면으로 전환하고, 완성되는 슬라이드를 폴링으로 채운다.
      setSlides([]);
      setStep("slides");
      toast.info("슬라이드 생성 중… 완성되는 대로 채워집니다");

      polling = true;
      const pollLoop = (async () => {
        while (polling) {
          await sleep(2500);
          if (!polling) break;
          try {
            const r = await fetch(`/api/carousels/${carouselId}`);
            if (r.ok) {
              const d = await r.json();
              if (Array.isArray(d.slides)) setSlides(d.slides as SlideRow[]);
            }
          } catch {
            /* 폴링 실패는 무시(최종 응답에서 보정) */
          }
        }
      })();

      const res = await fetch(`/api/carousels/${carouselId}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      polling = false;
      await pollLoop;

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "슬라이드 생성 실패");
      if (Array.isArray(data.slides)) setSlides(data.slides as SlideRow[]);
      // 서버가 텍스트 안전 게이트로 모드를 강등(full→overlay)했을 수 있음 → 로컬 상태 동기화
      // (슬라이드 편집 경로가 로컬 renderMode로 분기하므로 일관성 필요) + 사용자에게 안내.
      const effMode = data.carousel?.render_mode as "full" | "overlay" | undefined;
      if (effMode && effMode !== renderMode) {
        setRenderMode(effMode);
        if (effMode === "overlay" && renderMode === "full") {
          toast.info("정확한 정보·수치가 있어 '수정 가능한 광고형'으로 생성했어요");
        }
      }
      completeOp(opId, { subtitle: `${data.slides?.length ?? ""}장 완성` });
      toast.success(`슬라이드 ${data.slides?.length ?? ""}장 생성됨`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      failOp(opId, msg);
      toast.error(msg);
    } finally {
      polling = false; // POST가 reject돼도 폴링 루프를 반드시 종료
      setGenerating(false);
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function saveSlide(slide: SlideRow) {
    if (!carouselId) return;
    setBusy(true);
    setSavingIdx(slide.idx);
    const isFull = renderMode === "full";
    const opId = isFull
      ? startOp({
          kind: "compose",
          title: `슬라이드 ${slide.idx} 재생성`,
          subtitle: "AI 일체형 — 카피 반영해 다시 그리는 중",
          estimatedSeconds: 30,
          celebrate: false,
        })
      : null;
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
      if (opId) completeOp(opId, { subtitle: `슬라이드 ${slide.idx} 재합성 완료` });
      toast.success(`슬라이드 ${slide.idx} 재합성됨`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      if (opId) failOp(opId, msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setSavingIdx(null);
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
  function setPlan(items: SlidePlanItem[]) {
    const plan = normalizePlan(items);
    setConcept((prev) =>
      prev ? { ...prev, slidePlan: plan, slideCount: plan.length } : prev,
    );
  }
  function addSlide() {
    if (!concept || concept.slidePlan.length >= MAX_SLIDES) return;
    setPlan([
      ...concept.slidePlan,
      { index: 0, role: "point", purpose: "" },
    ]);
  }
  function removeSlide(index: number) {
    if (!concept || concept.slidePlan.length <= MIN_SLIDES) return;
    setPlan(concept.slidePlan.filter((p) => p.index !== index));
  }
  function moveSlide(index: number, dir: -1 | 1) {
    if (!concept) return;
    const arr = [...concept.slidePlan];
    const pos = arr.findIndex((p) => p.index === index);
    const next = pos + dir;
    if (pos < 0 || next < 0 || next >= arr.length) return;
    [arr[pos], arr[next]] = [arr[next], arr[pos]];
    setPlan(arr);
  }
  function patchSlide(id: string, patch: Partial<SlideRow>) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  // ── 상단: 최근 캐러셀 + 새로 만들기 ───────────────────────────
  const topBar = (recent.length > 0 || carouselId) && (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* 풀 내비게이션(plain <a>) — replaceState로 ?id가 붙은 상태에서도 key 충돌 없이
          항상 새 폼으로 리셋되도록 소프트 내비게이션을 피한다. */}
      <a
        href="/carousel"
        className="rounded-lg border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
      >
        + 새 캐러셀
      </a>
      {recent.slice(0, 6).map((r) => (
        <Link
          key={r.id}
          href={`/carousel?id=${r.id}`}
          className={cn(
            "max-w-[12rem] truncate rounded-lg border px-2 py-1 transition-colors",
            r.id === carouselId
              ? "border-foreground font-medium"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
          title={r.title || "제목 없음"}
        >
          {r.title || "제목 없음"} · {STATUS_LABEL[r.status] ?? r.status}
        </Link>
      ))}
    </div>
  );

  // ── STEP별 컨텐츠 ─────────────────────────────────────────────
  let content: React.ReactNode;

  if (step === "input") {
    content = (
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
              <Label className="text-xs">슬라이드 형식</Label>
              <div className="flex gap-1.5">
                {[
                  { v: "overlay", l: "수정 가능한 광고형" },
                  { v: "full", l: "AI 일체형 시안" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    disabled={busy}
                    onClick={() => setRenderMode(o.v as "full" | "overlay")}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50",
                      renderMode === o.v
                        ? "border-foreground font-medium"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            {renderMode === "overlay" && (
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
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {renderMode === "full"
              ? "AI 일체형 시안: AI가 배경·레이아웃·한글까지 한 번에 디자인합니다. 짧은 후킹 문구·시안용에 적합하며, 정확한 날짜·금액·연락처나 긴 본문이 있으면 자동으로 '수정 가능한 광고형'으로 생성됩니다."
              : "수정 가능한 광고형(권장): 텍스트 없는 배경에 한글을 또렷하게 얹습니다. 카피 수정·현지화가 즉시·무료로 반영됩니다."}
          </p>

          <div className="space-y-2 rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground">분위기·조명·색 (선택)</Label>
            {[
              { label: "조명", presets: LIGHTING_PRESETS, value: lighting, set: setLighting },
              { label: "팔레트", presets: PALETTE_PRESETS, value: palette, set: setPalette },
              { label: "무드", presets: MOOD_PRESETS, value: mood, set: setMood },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <Label className="text-[11px]">{row.label}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {row.presets.map((o) => (
                    <button
                      key={o.l}
                      type="button"
                      disabled={busy}
                      onClick={() => row.set(o.v)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
                        row.value === o.v
                          ? "border-foreground font-medium"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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

          <Button
            onClick={createConcept}
            disabled={!canSubmit || busy}
            pending={pendingAction === "concept"}
          >
            {pendingAction === "concept" ? "기획 생성 중…" : "번들 기획 만들기 →"}
          </Button>
        </CardContent>
      </Card>
    );
  } else if (step === "concept" && concept) {
    content = (
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
              {refUrl ? (
                // 레퍼런스가 있으면 레퍼런스가 배경·색·폰트를 결정 → 템플릿 선택 비활성(숨김).
                <p className="text-[11px] text-muted-foreground">
                  레퍼런스 이미지가 배경·색·폰트를 결정합니다 (템플릿 미적용).
                </p>
              ) : (
                <>
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
                </>
              )}
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
            {concept.slidePlan.map((p, i) => (
              <div key={p.index} className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {p.index} · {p.role}
                </Badge>
                <Input
                  value={p.purpose}
                  onChange={(e) => patchPlan(p.index, e.target.value)}
                  disabled={busy}
                  className="h-7 text-xs"
                  placeholder="이 슬라이드의 역할/목적"
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveSlide(p.index, -1)}
                    disabled={busy || i === 0}
                    aria-label="위로"
                    className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlide(p.index, 1)}
                    disabled={busy || i === concept.slidePlan.length - 1}
                    aria-label="아래로"
                    className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlide(p.index)}
                    disabled={busy || concept.slidePlan.length <= MIN_SLIDES}
                    aria-label="삭제"
                    className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addSlide}
              disabled={busy || concept.slidePlan.length >= MAX_SLIDES}
              className="text-xs text-primary underline disabled:opacity-40"
            >
              + 슬라이드 추가 (현재 {concept.slidePlan.length}장 · 최대 {MAX_SLIDES})
            </button>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={buildSlides}
            disabled={busy}
            pending={pendingAction === "slides"}
          >
            {pendingAction === "slides" ? "처리 중…" : "이 기획으로 슬라이드 만들기 →"}
          </Button>
          <Button
            variant="outline"
            onClick={regenerateConcept}
            disabled={busy}
            pending={pendingAction === "regenerate"}
          >
            {pendingAction === "regenerate" ? "다시 기획 중…" : "AI로 다시 기획"}
          </Button>
        </div>
      </div>
    );
  } else {
    const doneCount = slides.filter((s) => s.image_url).length;
    // 생성 중에는 기대 슬라이드 수만큼 슬롯을 만들어 "채워지는" 진행감을 준다.
    const expectedCount = generating
      ? Math.max(slides.length, concept?.slidePlan.length ?? slides.length)
      : slides.length;
    const slots: (SlideRow | null)[] = Array.from(
      { length: expectedCount },
      (_, i) => slides[i] ?? null,
    );
    content = (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">2단계 · 슬라이드 {slides.length}장</Badge>
            {generating && (
              <Badge variant="outline" className="gap-1">
                <Loader2Icon className="size-3 animate-spin" aria-hidden />
                생성 중
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("concept")}
              disabled={generating}
              className="text-xs text-muted-foreground underline disabled:opacity-40"
            >
              ← 기획 수정
            </button>
            {carouselId && !generating && (
              <DownloadButton
                url={`/api/carousels/${carouselId}/download`}
                filename={`carousel_${carouselId}.zip`}
                className="text-xs text-primary hover:underline"
                successToast="zip 저장됨"
              >
                전체 zip 다운로드
              </DownloadButton>
            )}
          </div>
        </div>

        {generating && (
          <GenerationProgress
            estimatedSeconds={renderMode === "full" ? 70 : 35}
            label={
              slides.length === 0
                ? "기획을 슬라이드로 펼치는 중…"
                : "슬라이드 생성 중…"
            }
            done={doneCount}
            total={expectedCount}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slots.map((s, i) =>
            s ? (
              <Card key={s.id}>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-start gap-3">
                    {s.image_url ? (
                      <button
                        type="button"
                        onClick={() => setPreviewIdx(i)}
                        className="shrink-0 overflow-hidden rounded-md transition-transform active:scale-95"
                        title="크게 보기"
                      >
                        <img
                          src={s.image_url}
                          alt={`슬라이드 ${s.idx}`}
                          loading="lazy"
                          className="w-32 h-32 rounded-md border object-cover transition-opacity hover:opacity-80"
                        />
                      </button>
                    ) : (
                      <div className="flex h-32 w-32 shrink-0 animate-pulse items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
                        합성 중…
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">
                          {s.idx} · {s.role}
                        </Badge>
                        {s.image_url && (
                          <DownloadButton
                            url={s.image_url}
                            filename={`slide_${String(s.idx).padStart(2, "0")}.png`}
                            className="text-[11px] text-primary hover:underline"
                          />
                        )}
                      </div>
                      <Input
                        value={s.headline}
                        onChange={(e) =>
                          patchSlide(s.id, { headline: e.target.value })
                        }
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
                        pending={savingIdx === s.idx}
                      >
                        {savingIdx === s.idx
                          ? "재합성 중…"
                          : renderMode === "full"
                            ? "카피 반영(재생성·~30초)"
                            : "수정 반영(재합성)"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card key={`slot-${i}`} aria-hidden>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-32 w-32 shrink-0 animate-pulse items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
                      대기 중…
                    </div>
                    <div className="min-w-0 flex-1 space-y-2 pt-1">
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                      <div className="h-7 w-full animate-pulse rounded bg-muted" />
                      <div className="h-10 w-full animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ),
          )}
        </div>

        <Button
          variant="outline"
          onClick={buildSlides}
          disabled={busy}
          pending={generating}
        >
          슬라이드 전체 다시 만들기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {topBar}
      {content}

      {/* 슬라이드 라이트박스 — 큰 미리보기 + 이전/다음(한국어 가독성 확인용) */}
      {preview?.image_url && previewIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewIdx(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setPreviewIdx(null)}
            aria-label="닫기"
            className="absolute right-4 top-4 text-2xl text-white/80 hover:text-white"
          >
            ✕
          </button>
          <div
            className="flex max-h-full flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const start = touchStartX.current;
              touchStartX.current = null;
              if (start === null || slides.length < 2) return;
              const dx = (e.changedTouches[0]?.clientX ?? start) - start;
              if (Math.abs(dx) < SWIPE_THRESHOLD) return;
              if (dx > 0) showPrev();
              else showNext();
            }}
          >
            <img
              src={preview.image_url}
              alt={`슬라이드 ${preview.idx}`}
              className="max-h-[80vh] max-w-[92vw] rounded-lg object-contain"
            />
            <div className="flex items-center gap-4 text-sm text-white">
              {slides.length > 1 && (
                <button
                  type="button"
                  onClick={showPrev}
                  className="hover:underline"
                >
                  ← 이전
                </button>
              )}
              <span className="text-xs tabular-nums text-white/60">
                {previewIdx + 1} / {slides.length}
              </span>
              {slides.length > 1 && (
                <button
                  type="button"
                  onClick={showNext}
                  className="hover:underline"
                >
                  다음 →
                </button>
              )}
              <DownloadButton
                url={preview.image_url as string}
                filename={`slide_${String(preview.idx).padStart(2, "0")}.png`}
                className="rounded-md border border-white/40 px-2 py-1 text-xs text-white hover:bg-white/10"
              />
            </div>
          </div>
        </div>
      )}
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
