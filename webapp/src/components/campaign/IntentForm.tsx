"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type {
  BrandAudience,
  BrandKeyVisual,
  BrandOffer,
  KeyVisualKind,
} from "@/lib/memory/types";
import { listActiveChannels } from "@/lib/channels";

const CHANNELS = listActiveChannels();

const KIND_LABEL: Record<KeyVisualKind, string> = {
  person: "인물",
  space: "공간",
  product: "제품",
};

interface IntentFormProps {
  brandId: string;
  brandName: string;
  offers: BrandOffer[];
  audiences: BrandAudience[];
  keyVisuals: BrandKeyVisual[];
  usesRealAssets: boolean;
}

export function IntentForm({
  brandId,
  brandName,
  offers,
  audiences,
  keyVisuals,
  usesRealAssets,
}: IntentFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [offerId, setOfferId] = useState<string | null>(
    offers.find((o) => o.is_default)?.id ?? offers[0]?.id ?? null,
  );
  const [audienceId, setAudienceId] = useState<string | null>(
    audiences.find((a) => a.is_default)?.id ?? audiences[0]?.id ?? null,
  );
  const [channelId, setChannelId] = useState<string>("ig_feed_square");
  const [note, setNote] = useState("");
  const [automationLevel, setAutomationLevel] = useState<"manual" | "assist" | "auto">("assist");
  const [keyVisualIntent, setKeyVisualIntent] = useState("");
  const [selectedKvIds, setSelectedKvIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleKv = (id: string) =>
    setSelectedKvIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const selectedChannel = CHANNELS.find((c) => c.id === channelId) ?? CHANNELS[0];

  const canSubmit = offers.length > 0 && audiences.length > 0 && name.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          goal: "BOFU",
          offer_id: offerId,
          audience_id: audienceId,
          channel: channelId,
          constraints: note.trim() ? { note: note.trim() } : {},
          automation_level: automationLevel,
          key_visual_intent: keyVisualIntent.trim() || null,
          selected_key_visual_ids: selectedKvIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "생성 실패");
      }
      const { campaign } = await res.json();
      toast.success("캠페인 생성됨");
      router.push(`/campaigns/${campaign.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-muted/30">
        <CardContent className="pt-6 space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">브랜드:</span>{" "}
            <strong>{brandName}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Goal: BOFU (전환)</Badge>
            <Badge variant="outline">{selectedChannel.label}</Badge>
            <Badge variant="outline">{selectedChannel.size}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">채널 *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                disabled={saving}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} · {c.size}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">
                {selectedChannel.description}
              </p>
            </div>
            <div
              className={`shrink-0 border rounded-md bg-muted/40 ${
                selectedChannel.aspectRatio === "9:16"
                  ? "w-10 h-[71px]"
                  : selectedChannel.aspectRatio === "4:5"
                    ? "w-14 h-[70px]"
                    : selectedChannel.aspectRatio === "16:9"
                      ? "w-20 h-[45px]"
                      : "w-16 h-16"
              } flex items-center justify-center text-[10px] text-muted-foreground`}
              title={`${selectedChannel.aspectRatio} · ${selectedChannel.size}`}
            >
              {selectedChannel.aspectRatio}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">캠페인 이름 *</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 봄 신학기 전환 캠페인 3월"
            disabled={saving}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">오퍼 선택 *</CardTitle>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <div className="text-sm space-y-2">
              <p className="text-destructive">등록된 오퍼가 없습니다.</p>
              <Link href={`/brands/${brandId}/offers`}>
                <Button variant="outline" size="sm">
                  오퍼 등록하러 가기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {offers.map((o) => (
                <label
                  key={o.id}
                  className={`block border rounded-md p-3 cursor-pointer transition-colors ${
                    offerId === o.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="offer"
                      checked={offerId === o.id}
                      onChange={() => setOfferId(o.id)}
                      disabled={saving}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{o.title}</span>
                        {o.is_default && <Badge variant="secondary">default</Badge>}
                      </div>
                      {o.usp && <p className="text-xs text-muted-foreground">{o.usp}</p>}
                      <div className="flex flex-wrap gap-1 text-xs">
                        {o.price && <Badge variant="outline">{o.price}</Badge>}
                        {o.urgency && <Badge variant="outline">⏰ {o.urgency}</Badge>}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">타겟 페르소나 *</CardTitle>
        </CardHeader>
        <CardContent>
          {audiences.length === 0 ? (
            <div className="text-sm space-y-2">
              <p className="text-destructive">등록된 페르소나가 없습니다.</p>
              <Link href={`/brands/${brandId}/audiences`}>
                <Button variant="outline" size="sm">
                  페르소나 등록하러 가기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {audiences.map((a) => (
                <label
                  key={a.id}
                  className={`block border rounded-md p-3 cursor-pointer transition-colors ${
                    audienceId === a.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="audience"
                      checked={audienceId === a.id}
                      onChange={() => setAudienceId(a.id)}
                      disabled={saving}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{a.persona_name}</span>
                        {a.is_default && <Badge variant="secondary">default</Badge>}
                      </div>
                      {a.pains.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Pains: {a.pains.slice(0, 3).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">자동화 수준</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {(
              [
                {
                  id: "manual" as const,
                  icon: "🧑‍💻",
                  title: "Manual",
                  desc: "모든 선택 수동. 대안을 직접 비교하며 결정.",
                },
                {
                  id: "assist" as const,
                  icon: "✨",
                  title: "Assist",
                  desc: "생성 후 최고점 자동 pre-select. 다른 것 클릭도 가능.",
                },
                {
                  id: "auto" as const,
                  icon: "🚀",
                  title: "Auto (beta)",
                  desc: "Assist + 다음 단계 자동 진행. Compose에서 정지.",
                },
              ] as const
            ).map((m) => (
              <label
                key={m.id}
                className={`border rounded-md p-3 cursor-pointer transition-colors ${
                  automationLevel === m.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="automation"
                    checked={automationLevel === m.id}
                    onChange={() => setAutomationLevel(m.id)}
                    disabled={saving}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {m.icon} {m.title}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {(usesRealAssets || keyVisuals.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">실사 자산 (선택)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>주인공·포커스</Label>
              <Input
                value={keyVisualIntent}
                onChange={(e) => setKeyVisualIntent(e.target.value)}
                placeholder="예: 원장님 전문성 어필 / 쾌적한 독서실 공간"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                자연어로 적어두면 카피·전략 수립 시 참조됩니다
              </p>
            </div>

            {keyVisuals.length === 0 ? (
              <div className="text-sm space-y-2">
                <p className="text-muted-foreground">등록된 실사 자산이 없습니다.</p>
                <Link href={`/brands/${brandId}/key-visuals`}>
                  <Button variant="outline" size="sm">
                    실사 자산 업로드
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>사용할 자산 (복수 선택 가능, 비워두면 AI 자유 생성)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {keyVisuals.map((kv) => {
                    const selected = selectedKvIds.includes(kv.id);
                    return (
                      <label
                        key={kv.id}
                        className={`relative block border rounded-md overflow-hidden transition-colors cursor-pointer ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleKv(kv.id)}
                          disabled={saving}
                          className="absolute top-1.5 right-1.5 z-10"
                        />
                        <img
                          src={kv.storage_url}
                          alt={kv.label}
                          className="w-full aspect-square object-cover"
                        />
                        <div className="p-2 space-y-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {KIND_LABEL[kv.kind]}
                            </Badge>
                            {kv.kind === "person" && (
                              <Badge variant="outline" className="text-[10px]">
                                픽셀 보존
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium line-clamp-1">{kv.label}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  인물 자산은 Compositor 트랙으로 사진을 그대로 보존하여 합성됩니다
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">제약사항 (선택)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 가격 노출 필수 / 특정 이미지 금지 / 특정 키워드 포함"
            rows={3}
            disabled={saving}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          취소
        </Button>
        <Button onClick={submit} disabled={!canSubmit || saving}>
          {saving ? "생성 중..." : "캠페인 시작 →"}
        </Button>
      </div>
    </div>
  );
}
