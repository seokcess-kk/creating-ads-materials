"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CreativeStageRow, CreativeVariant } from "@/lib/campaigns/types";
import type { LogoPosition } from "@/lib/canvas/compositor";
import {
  composeGridCols,
  previewContainerMaxVh,
  previewLayoutClass,
} from "./aspect-layout";

const LOGO_POSITION_LABELS: Array<{ id: LogoPosition; label: string }> = [
  { id: "top-left", label: "좌상" },
  { id: "top-center", label: "상중앙" },
  { id: "top-right", label: "우상" },
  { id: "bottom-left", label: "좌하" },
  { id: "bottom-center", label: "하중앙" },
  { id: "bottom-right", label: "우하" },
];

export interface LogoDefaultsProp {
  position: LogoPosition;
  widthRatio: number;
  source: "bp" | "fallback";
  hasLogo: boolean;
  logoUrl?: string | null;
}

interface ComposeStageProps {
  campaignId: string;
  previousReady: boolean;
  baseImageUrl: string | null;
  logoDefaults: LogoDefaultsProp;
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
  initialStage: CreativeStageRow | null;
  initialVariants: CreativeVariant[];
}

interface ComposeContent {
  url: string;
  path: string;
  baseSource: "retouch" | "visual";
  logoApplied?: boolean;
  logoPosition?: LogoPosition | null;
  logoSizeRatio?: number | null;
  logoXRatio?: number | null;
  logoYRatio?: number | null;
  logoSource?: "bp" | "fallback" | "user";
}

function presetToCoords(
  position: LogoPosition,
  widthRatio: number,
  logoAspect: number,
  baseRatio: number,
  marginRatio: number = 0.04,
): { x: number; y: number } {
  const logoHRatio = widthRatio * baseRatio * logoAspect;
  let x: number;
  if (position.endsWith("center")) x = 0.5 - widthRatio / 2;
  else if (position.endsWith("right")) x = 1 - widthRatio - marginRatio;
  else x = marginRatio;
  const y = position.startsWith("bottom")
    ? 1 - logoHRatio - marginRatio
    : marginRatio;
  return { x: clamp01(x), y: clamp01(y) };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function isCloseToPreset(
  x: number,
  y: number,
  width: number,
  logoAspect: number,
  baseRatio: number,
): LogoPosition | null {
  for (const p of LOGO_POSITION_LABELS) {
    const c = presetToCoords(p.id, width, logoAspect, baseRatio);
    if (Math.abs(c.x - x) < 0.01 && Math.abs(c.y - y) < 0.01) return p.id;
  }
  return null;
}

function parseBaseRatio(baseAspectRatio: string | null): number {
  if (!baseAspectRatio) return 1;
  const parts = baseAspectRatio.split("/").map((s) => parseFloat(s.trim()));
  const w = parts[0];
  const h = parts[1];
  return w && h ? w / h : 1;
}

export function ComposeStage({
  campaignId,
  previousReady,
  baseImageUrl,
  logoDefaults,
  aspectRatio = "1:1",
  initialStage,
  initialVariants,
}: ComposeStageProps) {
  const previewAspectClass =
    aspectRatio === "9:16"
      ? "aspect-[9/16]"
      : aspectRatio === "4:5"
        ? "aspect-[4/5]"
        : aspectRatio === "16:9"
          ? "aspect-[16/9]"
          : "aspect-square";
  const router = useRouter();
  const [stage, setStage] = useState<CreativeStageRow | null>(initialStage);
  const [variants, setVariants] = useState<CreativeVariant[]>(initialVariants);
  const [running, setRunning] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  const [logoAspect, setLogoAspect] = useState<number>(1);
  const [widthRatio, setWidthRatio] = useState<number>(logoDefaults.widthRatio);
  const [xRatio, setXRatio] = useState<number>(0);
  const [yRatio, setYRatio] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);
  const [baseAspectRatio, setBaseAspectRatio] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    rectW: number;
    rectH: number;
  } | null>(null);

  useEffect(() => setStage(initialStage), [initialStage]);
  useEffect(() => setVariants(initialVariants), [initialVariants]);

  useEffect(() => {
    if (!logoDefaults.logoUrl) return;
    const img = new Image();
    img.onload = () => {
      const aspect = img.naturalHeight / img.naturalWidth || 1;
      setLogoAspect(aspect);
      if (!initialized && baseAspectRatio) {
        const br = parseBaseRatio(baseAspectRatio);
        const coords = presetToCoords(
          logoDefaults.position,
          logoDefaults.widthRatio,
          aspect,
          br,
        );
        setXRatio(coords.x);
        setYRatio(coords.y);
        setInitialized(true);
      }
    };
    img.src = logoDefaults.logoUrl;
  }, [
    logoDefaults.logoUrl,
    logoDefaults.position,
    logoDefaults.widthRatio,
    baseAspectRatio,
    initialized,
  ]);

  useEffect(() => {
    if (!baseImageUrl) {
      setBaseAspectRatio(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setBaseAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
      }
    };
    img.src = baseImageUrl;
  }, [baseImageUrl]);

  const baseRatio = parseBaseRatio(baseAspectRatio);

  function snapToPreset(position: LogoPosition) {
    const c = presetToCoords(position, widthRatio, logoAspect, baseRatio);
    setXRatio(c.x);
    setYRatio(c.y);
  }

  function onSizeChange(newWidth: number) {
    setWidthRatio(newWidth);
    const currentPreset = isCloseToPreset(
      xRatio,
      yRatio,
      widthRatio,
      logoAspect,
      baseRatio,
    );
    if (currentPreset) {
      const c = presetToCoords(currentPreset, newWidth, logoAspect, baseRatio);
      setXRatio(c.x);
      setYRatio(c.y);
    } else {
      const logoHRatio = newWidth * baseRatio * logoAspect;
      setXRatio((prev) => clamp01(Math.min(prev, 1 - newWidth)));
      setYRatio((prev) => clamp01(Math.min(prev, 1 - logoHRatio)));
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    draggingRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: xRatio,
      origY: yRatio,
      rectW: rect.width,
      rectH: rect.height,
    };
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = draggingRef.current;
    if (!d) return;
    const logoHRatio = widthRatio * baseRatio * logoAspect;
    const dx = (e.clientX - d.startClientX) / d.rectW;
    const dy = (e.clientY - d.startClientY) / d.rectH;
    setXRatio(clamp01(Math.min(d.origX + dx, 1 - widthRatio)));
    setYRatio(clamp01(Math.min(d.origY + dy, 1 - logoHRatio)));
  }
  function onPointerUp() {
    draggingRef.current = null;
  }

  const logoHRatio = widthRatio * baseRatio * logoAspect;
  const currentPreset = isCloseToPreset(
    xRatio,
    yRatio,
    widthRatio,
    logoAspect,
    baseRatio,
  );
  const defaultCoords = presetToCoords(
    logoDefaults.position,
    logoDefaults.widthRatio,
    logoAspect,
    baseRatio,
  );
  const isDefault =
    Math.abs(xRatio - defaultCoords.x) < 0.005 &&
    Math.abs(yRatio - defaultCoords.y) < 0.005 &&
    Math.abs(widthRatio - logoDefaults.widthRatio) < 0.005;

  async function generate() {
    setRunning(true);
    toast.info("서버 합성 중 (10~20초)");
    try {
      const body = logoDefaults.hasLogo
        ? {
            logoSizeRatio: widthRatio,
            logoXRatio: xRatio,
            logoYRatio: yRatio,
          }
        : {};
      const res = await fetch(`/api/campaigns/${campaignId}/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "합성 실패");
      setStage(data.stage);
      setVariants((prev) => [...prev, data.variant]);
      toast.success("합성 완료");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setRunning(false);
    }
  }

  async function select(variantId: string) {
    setSelecting(variantId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/compose/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "확정 실패");
      setVariants((prev) => prev.map((v) => ({ ...v, selected: v.id === variantId })));
      toast.success("Compose 확정 — Ship 단계로");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSelecting(null);
    }
  }

  if (!previousReady) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>⑤ Compose</span>
          <Badge variant="outline">로고 배치 · 최종 확정</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {logoDefaults.hasLogo && baseImageUrl ? (
          <div className={`grid ${previewLayoutClass(aspectRatio)}`}>
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                미리보기 (드래그로 위치 이동 · 프리셋 클릭 · 슬라이더로 크기)
              </p>
              <div
                ref={previewRef}
                style={(() => {
                  const maxVh = previewContainerMaxVh(aspectRatio);
                  if (!baseAspectRatio) return undefined;
                  const parts = baseAspectRatio.split("/").map((s) => parseFloat(s.trim()));
                  const w = parts[0];
                  const h = parts[1];
                  if (!w || !h) return { aspectRatio: baseAspectRatio };
                  const ratio = w / h;
                  return {
                    aspectRatio: baseAspectRatio,
                    maxHeight: maxVh,
                    maxWidth: `calc(${maxVh} * ${ratio})`,
                  };
                })()}
                className={`relative w-full ${
                  baseAspectRatio ? "" : `${previewAspectClass}`
                } mx-auto rounded-md border bg-muted/30 overflow-hidden select-none`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={baseImageUrl}
                  alt="base"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
                {logoDefaults.logoUrl && (
                  <div
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className="absolute border border-primary/60 bg-white/5 cursor-move touch-none"
                    style={{
                      left: `${xRatio * 100}%`,
                      top: `${yRatio * 100}%`,
                      width: `${widthRatio * 100}%`,
                      height: `${logoHRatio * 100}%`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoDefaults.logoUrl}
                      alt="logo"
                      draggable={false}
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">프리셋</span>
                  {currentPreset ? (
                    <Badge variant="outline" className="text-[10px]">
                      {currentPreset}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      자유
                    </Badge>
                  )}
                  {logoDefaults.source === "bp" && isDefault && (
                    <Badge variant="outline" className="text-[10px]">
                      BP 자동
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {LOGO_POSITION_LABELS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant={currentPreset === p.id ? "default" : "outline"}
                      onClick={() => snapToPreset(p.id)}
                      disabled={running}
                      className="text-xs"
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">크기</span>
                  <span className="text-xs text-muted-foreground">
                    {(widthRatio * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.08}
                  max={0.25}
                  step={0.01}
                  value={widthRatio}
                  onChange={(e) => onSizeChange(Number(e.target.value))}
                  disabled={running}
                  className="w-full"
                />
              </div>

              <div className="text-[11px] text-muted-foreground">
                좌표 x:{xRatio.toFixed(3)} · y:{yRatio.toFixed(3)} · 크기{" "}
                {(widthRatio * 100).toFixed(1)}% × {(logoHRatio * 100).toFixed(1)}%
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">미세 조정</span>
                <button
                  type="button"
                  onClick={() => setXRatio((v) => clamp01(v - 0.005))}
                  disabled={running}
                  className="rounded border px-1.5 py-0.5 hover:bg-muted"
                  aria-label="왼쪽"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setXRatio((v) => clamp01(Math.min(v + 0.005, 1 - widthRatio)))
                  }
                  disabled={running}
                  className="rounded border px-1.5 py-0.5 hover:bg-muted"
                  aria-label="오른쪽"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => setYRatio((v) => clamp01(v - 0.005))}
                  disabled={running}
                  className="rounded border px-1.5 py-0.5 hover:bg-muted"
                  aria-label="위"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setYRatio((v) => clamp01(Math.min(v + 0.005, 1 - logoHRatio)))
                  }
                  disabled={running}
                  className="rounded border px-1.5 py-0.5 hover:bg-muted"
                  aria-label="아래"
                >
                  ↓
                </button>
              </div>

              {!isDefault && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const c = presetToCoords(
                      logoDefaults.position,
                      logoDefaults.widthRatio,
                      logoAspect,
                      baseRatio,
                    );
                    setXRatio(c.x);
                    setYRatio(c.y);
                    setWidthRatio(logoDefaults.widthRatio);
                  }}
                  disabled={running}
                  className="text-xs"
                >
                  기본값으로 되돌리기
                </Button>
              )}
            </div>
          </div>
        ) : !logoDefaults.hasLogo ? (
          <p className="text-xs text-muted-foreground">
            Identity에 로고가 없어 원본 비주얼이 그대로 최종본이 됩니다. Identity 페이지에서 로고를 업로드하면 배치 시뮬레이션이 가능합니다.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">base 이미지 없음</p>
        )}

        {stage?.status === "failed" && (
          <p className="text-sm text-destructive">{stage.error}</p>
        )}

        <div className="flex gap-2 items-center">
          <Button onClick={generate} disabled={running}>
            {running
              ? "합성 중..."
              : variants.length === 0
                ? "이 배치로 생성"
                : "이 배치로 재생성"}
          </Button>
          {variants.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {variants.length}개 생성됨
            </span>
          )}
        </div>

        {variants.length > 0 && (
          <div className={`grid gap-3 pt-2 ${composeGridCols(aspectRatio)}`}>
            {[...variants].reverse().map((v) => {
              const c = v.content_json as unknown as ComposeContent;
              const isSelected = v.selected;
              return (
                <Card
                  key={v.id}
                  className={
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40 transition-colors"
                  }
                >
                  <div
                    className={`${previewAspectClass} overflow-hidden rounded-t-md border-b bg-muted/20 flex items-center justify-center`}
                  >
                    <a href={c.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.url} alt="composed" className="w-full h-full object-contain" />
                    </a>
                  </div>
                  <CardContent className="pt-3 space-y-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline">base: {c.baseSource}</Badge>
                      {c.logoApplied ? (
                        <>
                          {c.logoPosition && <Badge variant="outline">{c.logoPosition}</Badge>}
                          {c.logoXRatio != null && c.logoYRatio != null && (
                            <Badge variant="outline">자유 배치</Badge>
                          )}
                          {c.logoSizeRatio != null && (
                            <Badge variant="outline">
                              {(c.logoSizeRatio * 100).toFixed(0)}%
                            </Badge>
                          )}
                          {c.logoSource === "user" && (
                            <Badge variant="outline" className="text-[10px]">
                              수동
                            </Badge>
                          )}
                          {c.logoSource === "bp" && (
                            <Badge variant="outline" className="text-[10px]">
                              BP
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline">원본 유지</Badge>
                      )}
                      {isSelected && <Badge variant="secondary">final</Badge>}
                    </div>
                    <Button
                      size="sm"
                      variant={isSelected ? "outline" : "default"}
                      className="w-full"
                      onClick={() => select(v.id)}
                      disabled={selecting !== null || (isSelected && variants.some((x) => x.selected))}
                    >
                      {selecting === v.id
                        ? "확정 중..."
                        : isSelected
                          ? "확정됨 (Ship)"
                          : "최종 확정"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
