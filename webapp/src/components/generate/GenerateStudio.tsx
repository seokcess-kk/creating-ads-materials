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

interface ResultVariant {
  id: string | null;
  label: string;
  url: string;
  selected: boolean;
  mode: string;
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
  const fileRef = useRef<HTMLInputElement>(null);

  // 카피 자동작성
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyOptions, setCopyOptions] = useState<CopyOption[]>([]);

  const [generating, setGenerating] = useState(false);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [variants, setVariants] = useState<ResultVariant[]>([]);

  const canSubmit = concept.trim().length >= 4;
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
      toast.success("레퍼런스 첨부됨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 오류");
    } finally {
      setRefUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function autoCopy() {
    if (!canSubmit) {
      toast.error("컨셉을 4자 이상 입력하세요");
      return;
    }
    setCopyLoading(true);
    try {
      const res = await fetch("/api/generate/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: concept.trim(),
          keyMessage: keyMessage.trim() || null,
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
      toast.error("컨셉/프롬프트를 4자 이상 입력하세요");
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
          concept: concept.trim(),
          keyMessage: keyMessage.trim() || null,
          headline: headline.trim() || null,
          sub: sub.trim() || null,
          cta: cta.trim() || null,
          tone: tone.trim() || null,
          aspectRatio,
          referenceImageUrl: refUrl,
          referenceMode: refUrl ? refMode : undefined,
          brandId: brandId || null,
          renderMode: bakeText ? "full" : "overlay",
          count,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setVariants(data.variants as ResultVariant[]);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">이미지 컨셉 *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="만들고 싶은 이미지의 장면·분위기·소재를 한두 문장으로 (예: 따뜻한 햇살이 드는 카페에서 라떼 한 잔)"
            rows={3}
            disabled={generating}
          />
          <div className="space-y-1">
            <Label className="text-xs">핵심 메시지 / 혜택 (선택)</Label>
            <Input
              value={keyMessage}
              onChange={(e) => setKeyMessage(e.target.value)}
              placeholder="이 소재로 알리려는 핵심 (예: 시그니처 라떼 2+1, 이번 주말 한정)"
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
                  onClick={() => setRefUrl(null)}
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
                <div className="flex flex-col gap-1">
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
              <Label className="text-xs">브랜드 (선택 — 컬러·로고 반영)</Label>
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
              {variants.map((v) => (
                <div key={v.label} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => select(v)}
                    className={cn(
                      "block w-full overflow-hidden rounded-md border bg-muted",
                      v.selected ? "border-2 border-foreground" : "border-border",
                    )}
                  >
                    <img
                      src={v.url}
                      alt={v.label}
                      className="w-full aspect-square object-cover"
                    />
                  </button>
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[10px] text-muted-foreground">
                      {v.selected ? "선택됨 · " : ""}
                      {v.label}
                    </span>
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
    </div>
  );
}
