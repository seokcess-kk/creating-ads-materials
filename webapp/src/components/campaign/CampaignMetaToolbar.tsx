"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BrandContextPanel } from "./BrandContextPanel";
import { CampaignKeyVisualEditor } from "./CampaignKeyVisualEditor";
import { CampaignFontPanel } from "./CampaignFontPanel";
import type {
  BrandAudience,
  BrandIdentity,
  BrandKeyVisual,
  BrandOffer,
} from "@/lib/memory/types";
import type { TonePresetId } from "@/lib/fonts/tone-pairs";

type ActivePanel = "brand" | "kv" | "font" | null;

interface Props {
  campaignId: string;
  brandId: string;
  // 브랜드 컨텍스트
  identity: BrandIdentity | null;
  offer: BrandOffer | null;
  audience: BrandAudience | null;
  // 실사 자산
  intent: string | null;
  selectedKvIds: string[];
  keyVisuals: BrandKeyVisual[];
  // 폰트
  initialPresetId: TonePresetId | null;
  initialPresetLabel: string | null;
  visualReady: boolean;
}

export function CampaignMetaToolbar({
  campaignId,
  brandId,
  identity,
  offer,
  audience,
  intent,
  selectedKvIds,
  keyVisuals,
  initialPresetId,
  initialPresetLabel,
  visualReady,
}: Props) {
  const [active, setActive] = useState<ActivePanel>(null);

  const brandSummary = [
    offer?.title ?? "오퍼 미선택",
    audience?.persona_name ?? "페르소나 미선택",
  ].join(" · ");

  const kvSelectedCount = selectedKvIds.length;
  const kvSummary =
    kvSelectedCount > 0
      ? `${kvSelectedCount}개 자산 선택`
      : intent
        ? "AI 자유 + 의도 있음"
        : "AI 자유";

  const fontSummary = initialPresetLabel ?? "브랜드 기본";

  return (
    <>
      <div
        role="toolbar"
        aria-label="캠페인 메타 설정"
        className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2"
      >
        <ChipButton
          icon="📋"
          label="브랜드"
          summary={brandSummary}
          onClick={() => setActive("brand")}
        />
        <ChipButton
          icon="🖼️"
          label="실사 자산"
          summary={kvSummary}
          onClick={() => setActive("kv")}
        />
        <ChipButton
          icon="Aa"
          label="폰트"
          summary={fontSummary}
          onClick={() => setActive("font")}
        />
      </div>

      <Dialog
        open={active === "brand"}
        onOpenChange={(o) => setActive(o ? "brand" : null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>📋 브랜드 컨텍스트</DialogTitle>
            <DialogDescription>
              현재 캠페인이 참조하는 Identity·Offer·Audience 요약
            </DialogDescription>
          </DialogHeader>
          <BrandContextPanel
            brandId={brandId}
            identity={identity}
            offer={offer}
            audience={audience}
            defaultOpen
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={active === "kv"}
        onOpenChange={(o) => setActive(o ? "kv" : null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>🖼️ 실사 자산</DialogTitle>
            <DialogDescription>
              주인공·포커스 의도와 선택된 사진을 캠페인에 연결합니다
            </DialogDescription>
          </DialogHeader>
          <CampaignKeyVisualEditor
            campaignId={campaignId}
            intent={intent}
            selectedIds={selectedKvIds}
            keyVisuals={keyVisuals}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={active === "font"}
        onOpenChange={(o) => setActive(o ? "font" : null)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>🔤 폰트 프리셋</DialogTitle>
            <DialogDescription>
              현재 캠페인에 적용된 폰트 프리셋과 추천
            </DialogDescription>
          </DialogHeader>
          <CampaignFontPanel
            campaignId={campaignId}
            initialPresetId={initialPresetId}
            initialPresetLabel={initialPresetLabel}
            visualReady={visualReady}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ChipButtonProps {
  icon: string;
  label: string;
  summary: string;
  onClick: () => void;
}

function ChipButton({ icon, label, summary, onClick }: ChipButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="shrink-0 text-sm leading-none" aria-hidden>
        {icon}
      </span>
      <span className="shrink-0 font-medium">{label}</span>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <span className="truncate text-muted-foreground">{summary}</span>
    </button>
  );
}
