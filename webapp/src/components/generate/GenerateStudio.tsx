"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";
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
import { copyLimitsForTypography, countCopyChars, layerCopySpecs } from "@/lib/generate/copy-limits";
import type { ReferenceTextLayer, ReferenceTypographyProfile } from "@/lib/generate/types";

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
  /** 디자인 인지 카피 — 레퍼런스 실측 레이어 역할 전체를 채운 확장 카피. */
  layers?: Record<string, string>;
}

/** 실측 레이어의 headline/sub 외 역할 입력란 라벨. */
const ROLE_LABELS: Record<string, string> = {
  eyebrow: "상단 예고",
  price: "가격·수치",
  badge: "뱃지",
  legal: "고지 문구",
  footer: "하단 안내",
};
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

const COPY_POS_PRESETS: Array<{ v: "" | "top" | "center" | "bottom"; l: string }> = [
  { v: "", l: "자동" },
  { v: "top", l: "상단" },
  { v: "center", l: "중앙" },
  { v: "bottom", l: "하단" },
];

const REFERENCE_FONTS = [
  ["pretendard", "Pretendard"], ["suit", "SUIT"], ["spoqa-han-sans-neo", "스포카 한 산스"],
  ["scdream", "에스코어 드림"], ["gmarket-sans", "G마켓 산스"], ["jalnan-gothic", "잘난 고딕"],
  ["jalnan2", "잘난체"], ["nanum-square-round", "나눔스퀘어라운드"],
  ["nanum-myeongjo", "나눔명조"], ["nanum-barunpen", "나눔바른펜"],
  ["cafe24-danjunghae", "카페24 단정해"],
] as const;

// 선택 이미지 편집 op(결과 이미지를 base로 editImage — "바꿀 것 하나 + 나머지 유지").
type EditOp = "localize" | "recolor" | "background" | "add" | "remove";
const EDIT_OPS: { v: EditOp; l: string }[] = [
  { v: "localize", l: "문구 교체/번역" },
  { v: "background", l: "배경만 변경" },
  { v: "recolor", l: "색만 변경" },
  { v: "add", l: "요소 추가" },
  { v: "remove", l: "요소 제거" },
];
const EDIT_INPUT_CLS =
  "h-8 rounded-md border border-white/20 bg-black/30 px-2 text-xs text-white placeholder:text-white/40 outline-none focus-visible:border-white/50 disabled:opacity-50";

// 응답을 JSON으로 안전하게 파싱. 비-JSON(타임아웃 시 플랫폼이 내는 "An error o..." 평문/HTML 등)이면
// 'Unexpected token' 대신 사람이 읽을 수 있는 메시지로 변환한다. 응답 실패(!ok)도 함께 처리.
async function readJson(res: Response, failMsg: string) {
  let text: string;
  try {
    text = await res.text();
  } catch {
    throw new Error(failMsg);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      res.status === 504 || res.status === 408 || res.status === 503
        ? "생성이 시간 내 완료되지 않았어요(타임아웃). 후보 수를 줄이거나 잠시 후 다시 시도해 주세요."
        : `서버 오류(${res.status || "네트워크"}). 잠시 후 다시 시도해 주세요.`,
    );
  }
  if (!res.ok) throw new Error(data?.error ?? failMsg);
  return data;
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
  // 용도 — ad(기본): 매체가 CTA 버튼 제공 → 이미지에 CTA 안 넣음 / organic: CTA 합성.
  const [placement, setPlacement] = useState<"ad" | "organic">("ad");
  // 생성 시점의 용도 스냅샷 — 결과 라이트박스의 CTA 편집 노출 기준(생성 후 토글 변경과 무관).
  const [genPlacement, setGenPlacement] = useState<"ad" | "organic">("ad");
  // 구조화 스타일 노브(프리셋 칩) — 빈 값이면 아트디렉터 자율.
  const [lighting, setLighting] = useState("");
  const [palette, setPalette] = useState("");
  const [mood, setMood] = useState("");
  const [copyPosition, setCopyPosition] = useState<"" | "top" | "center" | "bottom">("");

  // 레퍼런스 — 반영 강도: mood(무드만) / style(강반영, 기본) / layout(레이아웃까지) / reuse(그대로 재사용)
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [refStrength, setRefStrength] = useState<"mood" | "style" | "layout" | "reuse">("style");
  // 분석 결과 텍스트 레이어가 많으면 layout을 '추천'(배지)하고, 사용자가 아직 안 골랐을 때만 기본값을 바꾼다.
  const [layoutSuggested, setLayoutSuggested] = useState(false);
  const strengthTouched = useRef(false);
  // headline/sub 외 실측 레이어 역할(eyebrow·price·badge…)의 카피 — 디자인 인지 카피 적용/편집.
  const [extraCopy, setExtraCopy] = useState<Record<string, string>>({});
  const [refUploading, setRefUploading] = useState(false);
  const [designRef, setDesignRef] = useState<Record<string, unknown> | null>(null);
  const [conceptDraft, setConceptDraft] = useState<string | null>(null);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [refAnalysisError, setRefAnalysisError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 카피 자동작성
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyOptions, setCopyOptions] = useState<CopyOption[]>([]);

  const [generating, setGenerating] = useState(false);
  const [genCount, setGenCount] = useState(3); // 생성 시작 시점의 후보 수(스켈레톤 슬롯 수)
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [variants, setVariants] = useState<ResultVariant[]>([]);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  const { startOp, completeOp, failOp } = useNotifications();

  // 라이트박스 내 카피 수정 → 재합성(이미지 모델 호출 없음). 카피는 후보별(variant.copy)로 보관.
  const [reBusy, setReBusy] = useState(false);

  // 선택 이미지 편집(editImage 기반) — 디자인 보존하며 한 곳만 변경.
  const [editOp, setEditOp] = useState<"" | EditOp>("");
  const [editFields, setEditFields] = useState({
    from: "", to: "", target: "", color: "", scene: "", element: "", position: "",
  });
  const [editBusy, setEditBusy] = useState(false);

  // 분석 중에만 잠시 잠근다. 분석 실패는 차단 사유가 아님 — 픽셀 스타일만으로도 생성 가능(서버 graceful degrade).
  const referenceReady = !refUrl || !conceptLoading;
  // 광고용이면 CTA는 이미지에 들어가지 않으므로 텍스트 존재 판정에서 제외.
  const hasText = Boolean(
    headline.trim() || sub.trim() || (placement === "organic" && cta.trim()),
  );
  // 실측 텍스트 레이어 — 디자인 인지 카피(역할 전체 채움)와 자수 안내의 근거.
  const measuredTextLayers =
    designRef?.textLayersMeasured === true && Array.isArray(designRef.textLayers)
      ? (designRef.textLayers as ReferenceTextLayer[])
      : [];
  const layerSpecs = measuredTextLayers.length ? layerCopySpecs(measuredTextLayers) : [];
  const extraRoles = [...new Set(layerSpecs.map((s) => s.role))].filter(
    (r) => r !== "headline" && r !== "sub",
  );
  const reuseAvailable = measuredTextLayers.length > 0;
  const reuseMode = Boolean(refUrl) && refStrength === "reuse" && reuseAvailable;

  // 레퍼런스 실측 타이포가 있으면 overlay 카피 자수 한도를 입력 단계에서 안내(서버 assert의 사전 노출).
  const typo =
    (!bakeText || Boolean(refUrl)) && designRef?.textLayersMeasured === true && designRef.typography
      ? (designRef.typography as ReferenceTypographyProfile)
      : null;
  const copyLimits = typo ? copyLimitsForTypography(typo) : null;
  const headlineOver = copyLimits ? countCopyChars(headline) > copyLimits.headline : false;
  const subOver = copyLimits?.sub != null ? countCopyChars(sub) > copyLimits.sub : false;
  const canSubmit =
    keyMessage.trim().length >= 4 && referenceReady && !headlineOver && !subOver;

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
      strengthTouched.current = false;
      setRefStrength("style");
      setExtraCopy({});
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
    setRefAnalysisError(null);
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
      const data = await readJson(res, "비주얼 초안 실패");
      const analyzed = (data.designRef ?? null) as Record<string, unknown> | null;
      setDesignRef(analyzed);
      // 텍스트 레이어가 많은 완성형 광고는 '레이아웃까지'가 유리 — 추천 배지를 달고,
      // 사용자가 아직 강도를 직접 고르지 않았을 때만 기본값을 바꾼다(선택을 덮지 않음).
      const denseLayout = Array.isArray(analyzed?.textLayers) && analyzed.textLayers.length >= 4;
      setLayoutSuggested(denseLayout);
      if (denseLayout && !strengthTouched.current) {
        setRefStrength("layout");
        toast.info("텍스트 구조가 많은 레퍼런스예요 — '레이아웃까지'로 설정했어요 (변경 가능)");
      }
      setConceptDraft(data.conceptDraft ?? null);
      if (!concept.trim() && data.conceptDraft) {
        setConcept(data.conceptDraft);
        toast.success("레퍼런스로 비주얼·장면을 채웠어요 (수정 가능)");
      } else {
        toast.success("레퍼런스 디자인 반영 준비됨 · '비주얼 초안 적용'으로 바꿀 수 있어요");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "비주얼 초안 오류";
      setDesignRef(null);
      setRefAnalysisError(message);
      toast.error(message);
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
          placement,
          // 실측 레이어가 있으면 역할 전체(eyebrow·price…)를 자수 한도 내로 채운 디자인 인지 카피 요청.
          layerSpec: layerSpecs.length ? layerSpecs : undefined,
        }),
      });
      const data = await readJson(res, "카피 생성 실패");
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
    setCta(placement === "organic" ? (opt.cta ?? "") : "");
    // 확장 레이어 카피(가격·뱃지 등)도 함께 적용 — 해당 역할 입력란에 채워져 수정 가능.
    const next: Record<string, string> = {};
    for (const role of extraRoles) {
      const text = opt.layers?.[role]?.trim();
      if (text) next[role] = text;
    }
    setExtraCopy(next);
    toast.success("카피를 입력란에 채웠습니다 (수정 가능)");
  }

  async function generate() {
    if (!canSubmit) {
      toast.error(
        headlineOver || subOver
          ? "카피가 레퍼런스 영역보다 깁니다 — 표시된 자수 이내로 줄여 주세요"
          : conceptLoading
            ? "레퍼런스 분석이 끝나면 생성할 수 있어요"
            : "메시지를 4자 이상 입력하세요",
      );
      return;
    }
    // 레퍼런스 흐름은 항상 후합성(overlay) — 베이킹 토글은 레퍼런스 없는 생성에서만 유효.
    const effBake = !refUrl && bakeText;
    // 역할별 확장 카피(빈 값 제외). 서버가 headline/sub를 병합한다.
    const extraClean = Object.fromEntries(
      Object.entries(extraCopy).filter(([, v]) => v.trim()),
    );
    // reuse + 자동 카피 옵션이 있으면 후보 축을 '카피'로 — 배경 1장에 옵션별 재합성(모델 호출 1회).
    const ctaOf = (v?: string | null) => (placement === "organic" ? v?.trim() || null : null);
    const copyVariants =
      reuseMode && copyOptions.length
        ? [
            { headline: headline.trim() || null, sub: sub.trim() || null, cta: ctaOf(cta), layers: extraClean },
            ...copyOptions
              .filter((o) => o.headline.trim() !== headline.trim())
              .slice(0, Math.max(0, count - 1))
              .map((o) => ({
                headline: o.headline,
                sub: o.sub ?? null,
                cta: ctaOf(o.cta),
                layers: o.layers ?? null,
              })),
          ]
        : undefined;
    const effCount = copyVariants?.length ?? (reuseMode ? 1 : count);

    setGenerating(true);
    setGenCount(effCount);
    setVariants([]);
    setGenerationId(null);
    const opId = startOp({
      kind: "visual",
      title: "이미지 생성",
      subtitle: `${effCount}장 · ${aspectRatio}${effBake ? " · AI 일체형" : ""}${reuseMode ? " · 레퍼런스 재사용" : ""}`,
      estimatedSeconds: reuseMode ? 30 : effBake ? 55 : 40,
      steps: [
        { label: "프롬프트·브랜드 구성", atSec: 0 },
        { label: reuseMode ? "레퍼런스 텍스트 제거" : "이미지 생성", atSec: 6 },
        { label: "한글 텍스트 합성", atSec: reuseMode ? 22 : effBake ? 40 : 28 },
      ],
      celebrate: false, // 결과가 화면에 바로 뜨므로 완료 배너는 생략(진행바만 추적)
    });
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyMessage: keyMessage.trim(),
          concept: concept.trim() || null,
          headline: headline.trim() || null,
          sub: sub.trim() || null,
          cta: placement === "organic" ? cta.trim() || null : null,
          placement,
          tone: tone.trim() || null,
          lighting: lighting || null,
          palette: palette || null,
          mood: mood || null,
          copyPosition: copyPosition || null,
          aspectRatio,
          referenceImageUrl: refUrl,
          referenceStrength: refUrl ? refStrength : undefined,
          designRef: refUrl ? designRef : undefined,
          layerCopy: Object.keys(extraClean).length ? extraClean : undefined,
          copyVariants,
          brandId: brandId || null,
          renderMode: effBake ? "full" : "overlay",
          count,
        }),
      });
      const data = await readJson(res, "생성 실패");
      setGenPlacement(placement);
      // 각 후보의 초기 카피 = 생성에 쓰인 카피(카피 변형이면 후보별, 아니면 폼 카피). 이후 독립 편집.
      const formCopy: VariantCopy = {
        headline: headline.trim(),
        sub: sub.trim(),
        cta: placement === "organic" ? cta.trim() : "",
      };
      setVariants(
        (data.variants as ResultVariant[]).map((v, i) => ({
          ...v,
          copy: copyVariants?.[i]
            ? {
                headline: copyVariants[i].headline ?? "",
                sub: copyVariants[i].sub ?? "",
                cta: copyVariants[i].cta ?? "",
              }
            : { ...formCopy },
        })),
      );
      setGenerationId(data.generationId ?? null);
      const failed = (data.failures ?? []).length;
      completeOp(opId, {
        subtitle: `${data.variants.length}장 생성됨${failed ? ` · ${failed}장 실패` : ""}`,
      });
      toast.success(
        `이미지 ${data.variants.length}장 생성됨${failed ? ` (${failed}장 실패)` : ""}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      failOp(opId, msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function select(v: ResultVariant) {
    // 편집본은 op별 라벨이 중복될 수 있으므로 id로 선택 매칭(없을 때만 라벨 폴백).
    setVariants((prev) =>
      prev.map((x) => ({ ...x, selected: v.id ? x.id === v.id : x.label === v.label })),
    );
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
      const data = await readJson(res, "재합성 실패");
      const newUrl = data.variant.url as string;
      setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, url: newUrl } : x)));
      toast.success("재합성 완료 (이미지 모델 호출 없음)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setReBusy(false);
    }
  }

  const setEF = (k: keyof typeof editFields, val: string) =>
    setEditFields((p) => ({ ...p, [k]: val }));

  // op별 필수 입력 충족 여부.
  const editReady =
    editOp === "localize"
      ? Boolean(editFields.from.trim() && editFields.to.trim())
      : editOp === "background"
        ? Boolean(editFields.scene.trim())
        : editOp === "recolor"
          ? Boolean(editFields.color.trim())
          : editOp === "add"
            ? Boolean(editFields.element.trim())
            : editOp === "remove"
              ? Boolean(editFields.target.trim())
              : false;

  // 선택 이미지 편집 — 결과 이미지를 base로 editImage("바꿀 것 하나 + 나머지 유지"). 새 후보로 추가.
  async function applyEdit(v: ResultVariant) {
    if (!generationId) {
      toast.error("저장된 생성이 없어 편집할 수 없어요");
      return;
    }
    if (!editOp || !editReady) return;
    setEditBusy(true);
    try {
      const res = await fetch(`/api/generate/image/${generationId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: v.url, op: editOp, ...editFields, aspectRatio }),
      });
      const data = await readJson(res, "편집 실패");
      const nv = data.variant as Omit<ResultVariant, "copy">;
      const newIdx = variants.length;
      setVariants((prev) => [...prev, { ...nv, copy: { headline: "", sub: "", cta: "" } }]);
      setPreviewIdx(newIdx);
      setEditOp("");
      setEditFields({ from: "", to: "", target: "", color: "", scene: "", element: "", position: "" });
      toast.success("편집본이 추가되었습니다");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setEditBusy(false);
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
                    setRefAnalysisError(null);
                    setLayoutSuggested(false);
                    setExtraCopy({});
                    strengthTouched.current = false;
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
                  <span className="text-[11px] text-muted-foreground">반영 강도</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { v: "mood", l: "무드만 참고" },
                      { v: "style", l: "스타일 강반영" },
                      { v: "layout", l: "레이아웃까지" },
                      ...(reuseAvailable ? [{ v: "reuse", l: "그대로 재사용" }] : []),
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        disabled={generating}
                        onClick={() => {
                          strengthTouched.current = true;
                          setRefStrength(o.v as typeof refStrength);
                        }}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-50",
                          refStrength === o.v
                            ? "border-foreground font-medium"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {o.l}
                        {o.v === "layout" && layoutSuggested && (
                          <span className="ml-1 text-[10px] text-primary">추천</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {refStrength === "mood"
                      ? "색·무드를 요약해 말로만 참고해요 (가장 느슨)"
                      : refStrength === "style"
                        ? "색·구도·무드를 그대로 따라가되 장면은 새로 만들어요"
                        : refStrength === "layout"
                          ? "배치·타이포까지 템플릿처럼 유지하고 내용만 바꿔요"
                          : "텍스트만 지우고 새 카피로 교체해요 — 내 소재·사용권 있는 템플릿 전용"}
                  </span>
                  {refStrength === "reuse" && !hasText && (
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">
                      재사용은 교체할 카피가 필요해요 — 카피를 입력하거나 자동 작성하세요
                    </span>
                  )}
                  {designRef && (
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      후합성 폰트
                      <select
                        value={String(designRef.fontFamily ?? "pretendard")}
                        disabled={generating}
                        onChange={(e) =>
                          setDesignRef((prev) => prev ? { ...prev, fontFamily: e.target.value } : prev)
                        }
                        className="h-7 rounded-md border bg-background px-2 text-[11px] text-foreground"
                      >
                        {REFERENCE_FONTS.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <span>자동 추천 · 변경 가능</span>
                    </label>
                  )}
                  {conceptLoading ? (
                    <span className="text-[11px] text-muted-foreground">
                      비주얼 초안 작성 중…
                    </span>
                  ) : (
                    refAnalysisError ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-destructive">
                          분석 실패 · 이대로 생성하면 색·구도(픽셀)만 반영돼요
                        </span>
                        <button
                          type="button"
                          disabled={generating}
                          onClick={() => void draftConcept(refUrl)}
                          className="text-[11px] text-primary underline disabled:opacity-50"
                        >
                          분석 재시도
                        </button>
                      </div>
                    ) : conceptDraft && (
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
                className="inline-flex items-center gap-1 text-[11px] text-primary transition-transform hover:underline active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {copyLoading ? (
                  <Loader2Icon className="size-3 animate-spin" aria-hidden />
                ) : (
                  <SparklesIcon className="size-3" aria-hidden />
                )}
                {copyLoading ? "작성 중…" : "카피 자동 작성"}
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
                    {opt.layers && (
                      <div className="mt-0.5 flex flex-wrap gap-x-2">
                        {extraRoles.map((role) =>
                          opt.layers?.[role] ? (
                            <span key={role} className="text-[10px] text-muted-foreground">
                              {ROLE_LABELS[role] ?? role}: {opt.layers[role]}
                            </span>
                          ) : null,
                        )}
                      </div>
                    )}
                    {opt.cta && (
                      <div className="mt-0.5 text-[10px] text-primary">▶ {opt.cta}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div
              className={cn(
                "grid grid-cols-1 gap-2",
                placement === "organic" ? "md:grid-cols-3" : "md:grid-cols-2",
              )}
            >
              <div className="space-y-0.5">
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="헤드라인"
                  disabled={generating}
                  className={cn("h-8 text-xs", headlineOver && "border-destructive")}
                />
                {copyLimits && (
                  <p className={cn("text-[10px]", headlineOver ? "text-destructive" : "text-muted-foreground")}>
                    레퍼런스 영역 기준 공백 제외 {countCopyChars(headline)}/{copyLimits.headline}자
                  </p>
                )}
              </div>
              <div className="space-y-0.5">
                <Input
                  value={sub}
                  onChange={(e) => setSub(e.target.value)}
                  placeholder="서브카피"
                  disabled={generating}
                  className={cn("h-8 text-xs", subOver && "border-destructive")}
                />
                {copyLimits?.sub != null && (
                  <p className={cn("text-[10px]", subOver ? "text-destructive" : "text-muted-foreground")}>
                    레퍼런스 영역 기준 공백 제외 {countCopyChars(sub)}/{copyLimits.sub}자
                  </p>
                )}
              </div>
              {placement === "organic" && (
                <Input
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="CTA"
                  disabled={generating}
                  className="h-8 text-xs"
                />
              )}
            </div>

            {/* 레퍼런스 실측 레이어의 확장 역할(가격·뱃지·고지…) — 디자인 인지 카피 편집란 */}
            {extraRoles.length > 0 && (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {extraRoles.map((role) => {
                  const spec = layerSpecs.find((s) => s.role === role);
                  return (
                    <div key={role} className="space-y-0.5">
                      <Input
                        value={extraCopy[role] ?? ""}
                        onChange={(e) =>
                          setExtraCopy((prev) => ({ ...prev, [role]: e.target.value }))
                        }
                        placeholder={ROLE_LABELS[role] ?? role}
                        disabled={generating}
                        className="h-8 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {ROLE_LABELS[role] ?? role}
                        {spec ? ` · 공백 제외 ${spec.maxChars}자 이내` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
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

          <div className="flex flex-wrap items-start gap-4">
            <div className="space-y-1">
              <Label className="text-xs">용도</Label>
              <div className="flex gap-1.5">
                {[
                  { v: "ad", l: "광고용" },
                  { v: "organic", l: "게시물용" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    disabled={generating}
                    onClick={() => setPlacement(o.v as "ad" | "organic")}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50",
                      placement === o.v
                        ? "border-foreground font-medium"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {placement === "ad"
                  ? "매체가 CTA 버튼을 제공 — 이미지엔 CTA를 넣지 않아요"
                  : "버튼 없는 지면(게시물·카톡·출력물) — CTA를 이미지에 합성해요"}
              </p>
            </div>

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

          {/* 레퍼런스가 있으면 색·조명·무드·카피 위치는 레퍼런스가 결정 — 모순 입력을 막기 위해 숨김 */}
          {!refUrl && (
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
                      disabled={generating}
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
            {!bakeText && (
              <div className="space-y-1">
                <Label className="text-[11px]">카피 위치</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COPY_POS_PRESETS.map((o) => (
                    <button
                      key={o.l}
                      type="button"
                      disabled={generating}
                      onClick={() => setCopyPosition(o.v)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
                        copyPosition === o.v
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
          )}

          {/* 레퍼런스 흐름은 항상 후합성(정확한 카피) — 베이킹 선택은 레퍼런스 없을 때만 의미 */}
          {hasText && !refUrl && (
            <div className="space-y-1.5">
              <Label className="text-xs">텍스트 제작 방식</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    full: false,
                    title: "정확한 광고 소재",
                    desc: "배경은 AI로 만들고 글자는 정확하게 합성 · 집행용 권장",
                  },
                  {
                    full: true,
                    title: "레퍼런스 유사 시안",
                    desc: "글자까지 AI가 그려 타이포 분위기 우선 · 오탈자 확인 필요",
                  },
                ].map((option) => (
                  <button
                    key={option.title}
                    type="button"
                    disabled={generating}
                    onClick={() => setBakeText(option.full)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors disabled:opacity-50",
                      bakeText === option.full ? "border-foreground" : "border-border",
                    )}
                  >
                    <span className="block text-xs font-medium">{option.title}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{option.desc}</span>
                  </button>
                ))}
              </div>
              {bakeText && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  날짜·금액·연락처나 긴 문구는 정확성을 위해 자동으로 후합성됩니다.
                </p>
              )}
            </div>
          )}

          <Button onClick={generate} disabled={!canSubmit} pending={generating}>
            {generating ? "생성 중…" : "이미지 생성 →"}
          </Button>
        </CardContent>
      </Card>

      {(generating || variants.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              생성 결과
              {generating ? (
                <Badge variant="outline" className="gap-1">
                  <Loader2Icon className="size-3 animate-spin" aria-hidden />
                  생성 중
                </Badge>
              ) : (
                <Badge variant="secondary">{variants.length}장</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {generating && (
              <GenerationProgress
                estimatedSeconds={!refUrl && bakeText ? 55 : 40}
                label={`이미지 ${genCount}장 만드는 중…`}
              />
            )}
            {!generating && variants.length > 0 && (
              <div className="space-y-1.5">
                {!refUrl && bakeText && (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                    ⚠ AI가 글자를 직접 그렸어요 — 확대해 철자·줄바꿈을 확인하세요. 정확한 숫자·날짜는 ‘AI 일체형’을 끄거나 ‘이 이미지 편집’으로 고치는 걸 권장합니다.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  비율({aspectRatio})은 유도값이에요 — 정확한 픽셀 규격은 크롭/확장으로 맞추세요.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {generating &&
                Array.from({ length: genCount }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="aspect-square animate-pulse rounded-md border border-border bg-muted"
                    aria-hidden
                  />
                ))}
              {!generating &&
                variants.map((v, i) => (
                <div key={v.id ?? `${v.label}-${i}`} className="space-y-1.5">
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
                    <DownloadButton
                      url={v.url}
                      filename={`ad_${i + 1}_${v.label}.png`}
                      className="shrink-0 text-xs text-primary hover:underline"
                    />
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
              <DownloadButton
                url={preview.url}
                filename={`ad_${(previewIdx ?? 0) + 1}_${preview.label}.png`}
                className="rounded-md border border-white/40 px-2 py-1 text-xs text-white hover:bg-white/10"
              />
            </div>

            {preview.recomposable && previewIdx !== null && (
              <div className="w-full max-w-md space-y-2 rounded-lg border border-white/20 bg-white/5 p-3">
                <div className="text-[11px] text-white/70">
                  카피 수정 후 재합성 (이미지 모델 호출 없이 배경 재사용)
                </div>
                <div
                  className={cn(
                    "grid grid-cols-1 gap-1.5",
                    genPlacement === "organic" ? "sm:grid-cols-3" : "sm:grid-cols-2",
                  )}
                >
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
                  {genPlacement === "organic" && (
                    <input
                      value={preview.copy.cta}
                      onChange={(e) => setVariantCopy(previewIdx, "cta", e.target.value)}
                      placeholder="CTA"
                      disabled={reBusy}
                      className="h-8 rounded-md border border-white/20 bg-black/30 px-2 text-xs text-white placeholder:text-white/40 outline-none focus-visible:border-white/50 disabled:opacity-50"
                    />
                  )}
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/40 px-3 py-1.5 text-xs text-white transition-transform hover:bg-white/10 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                >
                  {reBusy && <Loader2Icon className="size-3 animate-spin" aria-hidden />}
                  {reBusy ? "재합성 중…" : "재합성 →"}
                </button>
              </div>
            )}

            {previewIdx !== null && generationId && (
              <div className="w-full max-w-md space-y-2 rounded-lg border border-white/20 bg-white/5 p-3">
                <div className="text-[11px] text-white/70">
                  이 이미지 편집 — 디자인은 그대로 두고 한 곳만 바꿔요(문구·배경·색…)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EDIT_OPS.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      disabled={editBusy}
                      onClick={() => setEditOp(editOp === o.v ? "" : o.v)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50",
                        editOp === o.v
                          ? "border-white bg-white/15 text-white"
                          : "border-white/30 text-white/70 hover:bg-white/10",
                      )}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
                {editOp && (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {editOp === "localize" && (
                      <>
                        <input value={editFields.from} onChange={(e) => setEF("from", e.target.value)} placeholder="바꿀 문구(원본)" disabled={editBusy} className={EDIT_INPUT_CLS} />
                        <input value={editFields.to} onChange={(e) => setEF("to", e.target.value)} placeholder="새 문구" disabled={editBusy} className={EDIT_INPUT_CLS} />
                      </>
                    )}
                    {editOp === "background" && (
                      <input value={editFields.scene} onChange={(e) => setEF("scene", e.target.value)} placeholder="새 배경(예: 따뜻한 카페 창가)" disabled={editBusy} className={cn(EDIT_INPUT_CLS, "sm:col-span-2")} />
                    )}
                    {editOp === "recolor" && (
                      <>
                        <input value={editFields.target} onChange={(e) => setEF("target", e.target.value)} placeholder="대상(예: 배경·버튼)" disabled={editBusy} className={EDIT_INPUT_CLS} />
                        <input value={editFields.color} onChange={(e) => setEF("color", e.target.value)} placeholder="색(예: 딥네이비)" disabled={editBusy} className={EDIT_INPUT_CLS} />
                      </>
                    )}
                    {editOp === "add" && (
                      <>
                        <input value={editFields.element} onChange={(e) => setEF("element", e.target.value)} placeholder="추가할 요소" disabled={editBusy} className={EDIT_INPUT_CLS} />
                        <input value={editFields.position} onChange={(e) => setEF("position", e.target.value)} placeholder="위치(예: 왼쪽 아래)" disabled={editBusy} className={EDIT_INPUT_CLS} />
                      </>
                    )}
                    {editOp === "remove" && (
                      <input value={editFields.target} onChange={(e) => setEF("target", e.target.value)} placeholder="제거할 요소" disabled={editBusy} className={cn(EDIT_INPUT_CLS, "sm:col-span-2")} />
                    )}
                  </div>
                )}
                {editOp && (
                  <button
                    type="button"
                    onClick={() => applyEdit(preview)}
                    disabled={editBusy || !editReady}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/40 px-3 py-1.5 text-xs text-white transition-transform hover:bg-white/10 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {editBusy && <Loader2Icon className="size-3 animate-spin" aria-hidden />}
                    {editBusy ? "편집 중…(~20초)" : "편집 적용 →"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
