"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BrandKeyVisual, KeyVisualKind } from "@/lib/memory/types";

interface Props {
  campaignId: string;
  intent: string | null;
  selectedIds: string[];
  keyVisuals: BrandKeyVisual[];
}

const KIND_LABEL: Record<KeyVisualKind, string> = {
  person: "인물",
  space: "공간",
  product: "제품",
};

export function CampaignKeyVisualEditor({
  campaignId,
  intent,
  selectedIds,
  keyVisuals,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftIntent, setDraftIntent] = useState(intent ?? "");
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const [saving, setSaving] = useState(false);

  function reset() {
    setDraftIntent(intent ?? "");
    setDraftIds(selectedIds);
  }

  function toggle(id: string) {
    setDraftIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function save() {
    const trimmed = draftIntent.trim();
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_visual_intent: trimmed || null,
          selected_key_visual_ids: draftIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "수정 실패");
      }
      const idsChanged =
        JSON.stringify([...draftIds].sort()) !==
        JSON.stringify([...selectedIds].sort());
      toast.success(
        idsChanged
          ? "실사 자산 변경 — Visual부터 재생성하세요"
          : "실사 의도가 저장되었습니다",
      );
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  const selectedItems = keyVisuals.filter((kv) => selectedIds.includes(kv.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm">실사 자산 (Key Visuals)</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              주인공·포커스 + 사용할 사진을 캠페인에 연결합니다
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              if (!o) reset();
              setOpen(o);
            }}
          >
            <DialogTrigger>
              <span className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent">
                <PencilIcon className="h-3 w-3" />
                수정
              </span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>실사 자산 수정</DialogTitle>
                <DialogDescription>
                  자산 선택을 바꾸면 Visual 이후 단계는 stale 처리됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="kv-intent">주인공·포커스 (자연어)</Label>
                  <Textarea
                    id="kv-intent"
                    value={draftIntent}
                    onChange={(e) => setDraftIntent(e.target.value)}
                    placeholder="예: 원장님 전문성 어필 / 쾌적한 독서실 공간"
                    rows={2}
                    maxLength={500}
                    disabled={saving}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    카피·전략 수립 시 참조됩니다 (최대 500자)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label id="kv-editor-grid-label">
                    사용할 자산 (복수 선택, 비워두면 AI 자유 생성)
                  </Label>
                  {keyVisuals.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                      등록된 실사 자산이 없습니다
                    </p>
                  ) : (
                    <div
                      role="group"
                      aria-labelledby="kv-editor-grid-label"
                      className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1"
                    >
                      {keyVisuals.map((kv) => {
                        const selected = draftIds.includes(kv.id);
                        return (
                          <label
                            key={kv.id}
                            className={cn(
                              "relative block cursor-pointer overflow-hidden rounded-md border transition-colors",
                              selected
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggle(kv.id)}
                              disabled={saving}
                              className="absolute right-1.5 top-1.5 z-10"
                            />
                            <img
                              src={kv.storage_url}
                              alt={kv.label}
                              className="aspect-square w-full object-cover"
                            />
                            <div className="space-y-0.5 p-1.5">
                              <Badge variant="outline" className="text-[9px]">
                                {KIND_LABEL[kv.kind]}
                              </Badge>
                              <p className="line-clamp-1 text-[11px] font-medium">
                                {kv.label}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    reset();
                    setOpen(false);
                  }}
                  disabled={saving}
                >
                  취소
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            주인공·포커스
          </p>
          <p className="text-sm">
            {intent ?? (
              <span className="text-muted-foreground">미설정</span>
            )}
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            선택된 자산 {selectedItems.length}개
          </p>
          {selectedItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              선택된 자산 없음 — AI가 자유 생성합니다
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedItems.map((kv) => (
                <div
                  key={kv.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 p-1.5"
                >
                  <img
                    src={kv.storage_url}
                    alt={kv.label}
                    className="h-10 w-10 rounded object-cover"
                  />
                  <div className="space-y-0.5">
                    <Badge variant="outline" className="text-[9px]">
                      {KIND_LABEL[kv.kind]}
                    </Badge>
                    <p className="line-clamp-1 max-w-[140px] text-[11px] font-medium">
                      {kv.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
