"use client";

import { useEffect, useRef, useState } from "react";
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

interface VariantCopy {
  headline: string;
  sub: string;
  cta: string;
}

interface ResultVariant {
  id: string | null;
  label: string;
  url: string;
  selected: boolean;
  mode: string;
  recomposable: boolean;
  /** 이 후보에 합성된 카피(후보별로 독립 — 재합성 입력 소스). */
  copy: VariantCopy;
}

type CopyAngle = "benefit" | "curiosity" | "urgency" | "social_proof" | "emotional";
interface CopyOption {
  headline: string;
  sub?: string;
  cta?: string;
  angle: CopyAngle;
}
const ANGLE_LABEL: Record<CopyAngle, string> = {
  benefit: "혜택",
  curiosity: "호기심",
  urgency: "긴급성",
  social_proof: "사회적 증거",
  emotional: "감성",
};

const ASPECTS: Array<{ value: "1:1" | "4:5" | "9:16" | "16:9"; label: string }> = [
  { value: "1:1", label: "정사각 1:1" },
  { value: "4:5", label: "세로 4:5" },
  { value: "9:16", label: "스토리 9:16" },
  { value: "16:9", label: "가로 16:9" },
];

async function downloadImage(url: string, filename: string) {
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

export function GenerateStudio({ brands }: { brands: BrandOption[] }) {
  const [concept, setConcept] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [headline, setHeadline] = useState("");
  const [sub, setSub] = useState("");
  const [cta, setCta] = useState("");
  const [tone, setTone] = useState("");
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [brandId, setBrandId] = useState<string>("");
  const [bakeText, setBakeText] = useState(false);
  const [count, setCount] = useState(3);

  // 레퍼런스
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [refMode, setRefMode] = useState<"style" | "base">("style");
  const [refUploading, setRefUploading] = useState(false);
  const [designRef, setDesignRef] = useState<Record<string, unknown> | null>(null);
  const [conceptDraft, setConceptDraft] = useState<string | null>(null);
  const [conceptLoading, setConceptLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 카피 자동작성
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyOptions, setCopyOptions] = useState<CopyOption[]>([]);

  const [generating, setGenerating] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [variants, setVariants] = useState<ResultVariant[]>([]);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  // 라이트박스 내 카피 수정 → 재합성(이미지 모델 호출 없음). 카피는 후보별(variant.copy)로 보관.
  const [reBusy, setReBusy] = useState(false);

  const canSubmit = keyMessage.trim().length >= 4;
  const hasText = Boolean(headline.trim() || sub.trim() || cta.trim());

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
      toast.success("레퍼런스 첨부됨 · 비주얼 초안을 만드는 중…");
      await draftConcept(sign.publicUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 오류");
    } finally {
      setRefUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // 레퍼런스 → 비주얼·장면 초안 + 디자인 요소(생성 시 재사용). 비주얼 필드가 비어있으면 자동 채움.
  async function draftConcept(url: string) {
    setConceptLoading(true);
    try {
      const res = await fetch("/api/generate/concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceImageUrl: url,
          keyMessage: keyMessage.trim() || null,
          brandId: brandId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "비주얼 초안 실패");
      setDesignRef(data.designRef ?? null);
      setConceptDraft(data.conceptDraft ?? null);
      if (!concept.trim() && data.conceptDraft) {
        setConcept(data.conceptDraft);
        toast.success("레퍼런스로 비주얼·장면을 채웠어요 (수정 가능)");
      } else {
        toast.success("레퍼런스 디자인 반영 준비됨 · '비주얼 초안 적용'으로 바꿀 수 있어요");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "비주얼 초안 오류");
    } finally {
      setConceptLoading(false);
    }
  }

  async function autoCopy() {
    if (!canSubmit) {
      toast.error("메시지를 4자 이상 입력하세요");
      return;
    }
    setCopyLoading(true);
    try {
      const res = await fetch("/api/generate/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyMessage: keyMessage.trim(),
          concept: concept.trim() || null,
          tone: tone.trim() || null,
          brandId: brandId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "카피 생성 실패");
      setCopyOptions(data.options as CopyOption[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setCopyLoading(false);
    }
  }

  function applyCopy(opt: CopyOption) {
    setHeadline(opt.headline);
    setSub(opt.sub ?? "");
    setCta(opt.cta ?? "");
    toast.success("카피를 입력란에 채웠습니다 (수정 가능)");
  }

  async function generate() {
    if (!canSubmit) {
      toast.error("메시지를 4자 이상 입력하세요");
      return;
    }
    setGenerating(true);
    setVariants([]);
    setGenerationId(null);
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyMessage: keyMessage.trim(),
          concept: concept.trim() || null,
          headline: headline.trim() || null,
          sub: sub.trim() || null,
          cta: cta.trim() || null,
          tone: tone.trim() || null,
          aspectRatio,
          referenceImageUrl: refUrl,
          referenceMode: refUrl ? refMode : undefined,
          designRef: refUrl && refMode === "style" ? designRef : undefined,
          brandId: brandId || null,
          renderMode: bakeText ? "full" : "overlay",
          count,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      // 각 후보의 초기 카피 = 생성에 쓰인 폼 카피(=베이킹/합성된 값). 이후 후보별로 독립 편집.
      const formCopy: VariantCopy = {
        headline: headline.trim(),
        sub: sub.trim(),
        cta: cta.trim(),
      };
      setVariants(
        (data.variants as ResultVariant[]).map((v) => ({ ...v, copy: { ...formCopy } })),
      );
      setGenerationId(data.generationId ?? null);
      const failed = (data.failures ?? []).length;
      toast.success(
        `이미지 ${data.variants.length}장 생성됨${failed ? ` (${failed}장 실패)` : ""}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setGenerating(false);
    }
  }

  async function select(v: ResultVariant) {
    setVariants((prev) => prev.map((x) => ({ ...x, selected: x.label === v.label })));
    if (generationId && v.id) {
      try {
        await fetch(`/api/generate/image/${generationId}/select`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId: v.id }),
        });
      } catch {
        /* 선택 영속화 실패는 무시 */
      }
    }
  }

  // 후보별 카피 편집(입력은 해당 후보의 copy에 직접 바인딩 — 후보 간 누수 없음).
  function setVariantCopy(idx: number, field: keyof VariantCopy, value: string) {
    setVariants((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, copy: { ...x.copy, [field]: value } } : x)),
    );
  }

  // 카피 수정 후 보존된 배경으로 재합성(이미지 모델 호출 없음).
  async function recompose(v: ResultVariant) {
    if (!generationId || !v.id) return;
    const hasCopy = Boolean(v.copy.headline.trim() || v.copy.sub.trim() || v.copy.cta.trim());
    if (!hasCopy) {
      toast.error("카피를 1개 이상 입력하세요");
      return;
    }
    setReBusy(true);
    try {
      const res = await fetch(`/api/generate/image/${generationId}/recompose`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: v.id,
          headline: v.copy.headline.trim() || null,
          sub: v.copy.sub.trim() || null,
          cta: v.copy.cta.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "재합성 실패");
      const newUrl = data.variant.url as string;
      setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, url: newUrl } : x)));
      toast.success("재합성 완료 (이미지 모델 호출 없음)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setReBusy(false);
    }
  }

  const showPrev = () =>
    setPreviewIdx((i) => (i === null ? i : (i - 1 + variants.length) % variants.length));
  const showNext = () =>
    setPreviewIdx((i) => (i === null ? i : (i + 1) % variants.length));

  useEffect(() => {
    if (previewIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewIdx(null);
      else if (e.key === "ArrowLeft")
        setPreviewIdx((i) => (i === null ? i : (i - 1 + variants.length) % variants.length));
      else if (e.key === "ArrowRight")
        setPreviewIdx((i) => (i === null ? i : (i + 1) % variants.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewIdx, variants.length]);

  const preview = previewIdx !== null ? variants[previewIdx] ?? null : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">메시지 · 혜택 *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={keyMessage}
            onChange={(e) => setKeyMessage(e.target.value)}
            placeholder="이 소재로 무엇을 알릴까요? 핵심 메시지·혜택 (예: 시그니처 라떼 2+1, 이번 주말 한정)"
            rows={2}
            disabled={generating}
          />
          <div className="space-y-1">
            <Label className="text-xs">비주얼·장면 (선택 — 레퍼런스 첨부 시 자동)</Label>
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="원하는 장면·분위기·소재 (예: 따뜻한 햇살이 드는 카페에서 라떼 한 잔). 레퍼런스를 첨부하면 자동으로 채워집니다."
              rows={2}
              disabled={generating}
            />
          </div>

          {/* 레퍼런스 첨부 */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">레퍼런스 이미지 (선택)</Label>
              {refUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setRefUrl(null);
                    setDesignRef(null);
                    setConceptDraft(null);
                  }}
                  className="text-[11px] text-muted-foreground underline"
                >
                  제거
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={refUploading || generating}
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
            {refUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={refUrl}
                  alt="레퍼런스"
                  className="h-16 w-16 rounded-md border object-cover"
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-muted-foreground">활용 방식</span>
                  <div className="flex gap-1.5">
                    {[
                      { v: "style", l: "디자인 참고" },
                      { v: "base", l: "이미지 변형" },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        disabled={generating}
                        onClick={() => setRefMode(o.v as "style" | "base")}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-50",
                          refMode === o.v
                            ? "border-foreground font-medium"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                  {conceptLoading ? (
                    <span className="text-[11px] text-muted-foreground">
                      비주얼 초안 작성 중…
                    </span>
                  ) : (
                    conceptDraft && (
                      <button
                        type="button"
                        disabled={generating}
                        onClick={() => {
                          setConcept(conceptDraft);
                          toast.success("비주얼 초안을 적용했어요 (수정 가능)");
                        }}
                        className="self-start text-[11px] text-primary underline disabled:opacity-50"
                      >
                        비주얼 초안 적용
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 카피 */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">카피 (선택)</Label>
              <button
                type="button"
                onClick={autoCopy}
                disabled={!canSubmit || copyLoading || generating}
                className="text-[11px] text-primary underline disabled:opacity-50"
              >
                {copyLoading ? "작성 중…" : "✨ 카피 자동 작성"}
              </button>
            </div>
            {copyOptions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {copyOptions.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyCopy(opt)}
                    disabled={generating}
                    className="rounded-md border border-border p-2 text-left transition-colors hover:border-foreground disabled:opacity-50"
                  >
                    <Badge variant="outline" className="mb-1 text-[10px]">
                      {ANGLE_LABEL[opt.angle]}
                    </Badge>
                    <div className="text-xs font-medium">{opt.headline}</div>
                    {opt.sub && (
                      <div className="text-[11px] text-muted-foreground">{opt.sub}</div>
                    )}
                    {opt.cta && (
                      <div className="mt-0.5 text-[10px] text-primary">▶ {opt.cta}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="헤드라인"
                disabled={generating}
                className="h-8 text-xs"
              />
              <Input
                value={sub}
                onChange={(e) => setSub(e.target.value)}
                placeholder="서브카피"
                disabled={generating}
                className="h-8 text-xs"
              />
              <Input
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="CTA"
                disabled={generating}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">톤 (선택)</Label>
              <Input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="예: 따뜻하고 감성적인, 프리미엄"
                disabled={generating}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">브랜드 (선택 — 로고·카테고리 반영)</Label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                disabled={generating}
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

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">비율</Label>
              <div className="flex flex-wrap gap-1.5">
                {ASPECTS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    disabled={generating}
                    onClick={() => setAspectRatio(a.value)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50",
                      aspectRatio === a.value
                        ? "border-foreground font-medium"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">후보 수</Label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={generating}
                    onClick={() => setCount(n)}
                    className={cn(
                      "h-8 w-8 rounded-lg border text-xs transition-colors disabled:opacity-50",
                      count === n
                        ? "border-foreground font-medium"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {hasText && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={bakeText}
                onChange={(e) => setBakeText(e.target.checked)}
                disabled={generating}
              />
              AI가 텍스트도 직접 그리기 (끄면 한글 텍스트를 안정적으로 오버레이)
            </label>
          )}

          <Button onClick={generate} disabled={!canSubmit || generating}>
            {generating ? "생성 중… (~40초)" : "이미지 생성 →"}
          </Button>
        </CardContent>
      </Card>

      {variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              생성 결과
              <Badge variant="secondary">{variants.length}장</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {variants.map((v, i) => (
                <div key={v.label} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewIdx(i)}
                    title="클릭하면 크게 보기"
                    className={cn(
                      "group relative block w-full overflow-hidden rounded-md border bg-muted",
                      v.selected ? "border-2 border-foreground" : "border-border",
                    )}
                  >
                    <img
                      src={v.url}
                      alt={v.label}
                      className="w-full aspect-square object-cover transition-opacity group-hover:opacity-90"
                    />
                  </button>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => select(v)}
                      className={cn(
                        "text-[11px] underline",
                        v.selected
                          ? "font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {v.selected ? "✓ 선택됨" : "선택"}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadImage(v.url, `ad_${v.label}.png`)}
                      className="shrink-0 text-xs text-primary underline"
                    >
                      다운로드
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {preview && previewIdx !== null && (
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
          >
            <img
              src={preview.url}
              alt={preview.label}
              className="max-h-[80vh] max-w-[92vw] rounded-lg object-contain"
            />
            <div className="flex items-center gap-4 text-sm text-white">
              {variants.length > 1 && (
                <button type="button" onClick={showPrev} className="hover:underline">
                  ← 이전
                </button>
              )}
              <span className="text-xs tabular-nums text-white/60">
                {previewIdx + 1} / {variants.length}
              </span>
              {variants.length > 1 && (
                <button type="button" onClick={showNext} className="hover:underline">
                  다음 →
                </button>
              )}
              <button
                type="button"
                onClick={() => select(preview)}
                className="rounded-md border border-white/40 px-2 py-1 text-xs hover:bg-white/10"
              >
                {preview.selected ? "✓ 선택됨" : "선택"}
              </button>
              <button
                type="button"
                onClick={() => downloadImage(preview.url, `ad_${preview.label}.png`)}
                className="rounded-md border border-white/40 px-2 py-1 text-xs hover:bg-white/10"
              >
                다운로드
              </button>
            </div>

            {preview.recomposable && previewIdx !== null && (
              <div className="w-full max-w-md space-y-2 rounded-lg border border-white/20 bg-white/5 p-3">
                <div className="text-[11px] text-white/70">
                  카피 수정 후 재합성 (이미지 모델 호출 없이 배경 재사용)
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <input
                    value={preview.copy.headline}
                    onChange={(e) => setVariantCopy(previewIdx, "headline", e.target.value)}
                    placeholder="헤드라인"
                    disabled={reBusy}
                    className="h-8 rounded-md border border-white/20 bg-black/30 px-2 text-xs text-white placeholder:text-white/40 outline-none focus-visible:border-white/50 disabled:opacity-50"
                  />
                  <input
                    value={preview.copy.sub}
                    onChange={(e) => setVariantCopy(previewIdx, "sub", e.target.value)}
                    placeholder="서브카피"
                    disabled={reBusy}
                    className="h-8 rounded-md border border-white/20 bg-black/30 px-2 text-xs text-white placeholder:text-white/40 outline-none focus-visible:border-white/50 disabled:opacity-50"
                  />
                  <input
                    value={preview.copy.cta}
                    onChange={(e) => setVariantCopy(previewIdx, "cta", e.target.value)}
                    placeholder="CTA"
                    disabled={reBusy}
                    className="h-8 rounded-md border border-white/20 bg-black/30 px-2 text-xs text-white placeholder:text-white/40 outline-none focus-visible:border-white/50 disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => recompose(preview)}
                  disabled={
                    reBusy ||
                    !(
                      preview.copy.headline.trim() ||
                      preview.copy.sub.trim() ||
                      preview.copy.cta.trim()
                    )
                  }
                  className="rounded-md border border-white/40 px-3 py-1.5 text-xs text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {reBusy ? "재합성 중…" : "재합성 →"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
