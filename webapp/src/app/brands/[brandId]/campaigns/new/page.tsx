"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CHANNELS, getChannelsByPlatform, type ChannelConfig } from "@/lib/channels";

interface CopyVariation {
  angle: string;
  headline: string;
  sub_copy: string;
  cta: string;
  body: string;
}

interface ChannelCopies {
  channel: string;
  variations: CopyVariation[];
}

interface GeneratedImage {
  channelId: string;
  variation: number;
  imageUrl: string;
  creativeId: string;
}

const STEPS = [
  { label: "캠페인 정보" },
  { label: "채널 선택" },
  { label: "카피 선택" },
  { label: "이미지 선택" },
  { label: "조합 + 합성" },
];

export default function NewCampaignPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = use(params);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: 캠페인 정보
  const [sellingPoint, setSellingPoint] = useState("");
  const [campaignGoal, setCampaignGoal] = useState("consultation");
  const [additionalInfo, setAdditionalInfo] = useState("");

  // Step 2: 채널 선택
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["ig_feed_square"]);
  const [countPerChannel, setCountPerChannel] = useState(3);

  // 캠페인 ID (Step 1 완료 후 생성)
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Step 3: 카피 선택
  const [allCopies, setAllCopies] = useState<ChannelCopies[]>([]);
  const [selectedCopyIndices, setSelectedCopyIndices] = useState<Record<string, number[]>>({});

  // Step 4: 이미지 선택
  const [allImages, setAllImages] = useState<GeneratedImage[]>([]);
  const [selectedImageIndices, setSelectedImageIndices] = useState<Record<string, number[]>>({});

  // Step 5: 합성 진행
  const [composing, setComposing] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  const channelsByPlatform = getChannelsByPlatform();
  const selectedChannelConfigs = CHANNELS.filter((c) => selectedChannels.includes(c.id));

  function toggleChannel(id: string) {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function toggleCopy(channel: string, index: number) {
    setSelectedCopyIndices((prev) => {
      const current = prev[channel] || [];
      return {
        ...prev,
        [channel]: current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index],
      };
    });
  }

  function toggleImage(channel: string, index: number) {
    setSelectedImageIndices((prev) => {
      const current = prev[channel] || [];
      return {
        ...prev,
        [channel]: current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index],
      };
    });
  }

  // === Step 1 → 2 ===
  function handleStep1Next() {
    if (!sellingPoint.trim()) { toast.error("소구포인트를 입력하세요"); return; }
    setStep(1);
  }

  // === Step 2 → 3: 캠페인 생성 + 브리프 + 카피 생성 ===
  async function handleStep2Next() {
    if (selectedChannels.length === 0) { toast.error("채널을 선택하세요"); return; }
    setLoading(true);

    try {
      // 캠페인 생성
      const campRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          name: sellingPoint.slice(0, 50),
          description: `소구포인트: ${sellingPoint}\n목표: ${campaignGoal}\n${additionalInfo}`,
          targetChannels: selectedChannels,
        }),
      });
      if (!campRes.ok) throw new Error("캠페인 생성 실패");
      const campaign = await campRes.json();
      setCampaignId(campaign.id);

      // 브리프 생성
      toast.info("브리프 생성 중...");
      const briefRes = await fetch(`/api/campaigns/${campaign.id}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellingPoint, campaignGoal, additionalInfo }),
      });
      if (!briefRes.ok) throw new Error("브리프 생성 실패");

      // 카피 생성
      toast.info("카피 생성 중...");
      const copyRes = await fetch(`/api/campaigns/${campaign.id}/copy`, { method: "POST" });
      if (!copyRes.ok) throw new Error("카피 생성 실패");
      const copyData = await copyRes.json();

      setAllCopies(copyData.copies || []);

      // 기본 선택: 각 채널의 첫 2개
      const defaults: Record<string, number[]> = {};
      for (const cc of (copyData.copies || []) as ChannelCopies[]) {
        defaults[cc.channel] = [0, 1];
      }
      setSelectedCopyIndices(defaults);

      toast.success("카피 생성 완료!");
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  // === Step 3 → 4: 이미지 생성 ===
  async function handleStep3Next() {
    const hasSelection = Object.values(selectedCopyIndices).some((arr) => arr.length > 0);
    if (!hasSelection) { toast.error("카피를 최소 1개 선택하세요"); return; }
    if (!campaignId) return;

    setLoading(true);
    try {
      toast.info(`이미지 생성 중... (채널당 ${countPerChannel}개)`);
      const imgRes = await fetch(`/api/campaigns/${campaignId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countPerChannel }),
      });
      if (!imgRes.ok) throw new Error("이미지 생성 실패");
      const imgData = await imgRes.json();

      const images = (imgData.images || []).filter((img: GeneratedImage) => img.imageUrl);
      setAllImages(images);

      // 기본 선택: 각 채널의 첫 2개
      const defaults: Record<string, number[]> = {};
      for (let i = 0; i < images.length; i++) {
        const ch = images[i].channelId;
        if (!defaults[ch]) defaults[ch] = [];
        if (defaults[ch].length < 2) defaults[ch].push(i);
      }
      setSelectedImageIndices(defaults);

      toast.success("이미지 생성 완료!");
      setStep(3);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  // === Step 4 → 5 ===
  function handleStep4Next() {
    const hasSelection = Object.values(selectedImageIndices).some((arr) => arr.length > 0);
    if (!hasSelection) { toast.error("이미지를 최소 1개 선택하세요"); return; }
    setStep(4);
  }

  // === Step 5: 조합 합성 ===
  function getCombinations() {
    const combos: { channel: string; channelLabel: string; copy: CopyVariation; imageUrl: string; creativeId: string }[] = [];

    for (const channel of selectedChannels) {
      const channelConfig = CHANNELS.find((c) => c.id === channel);
      const channelCopies = allCopies.find((c) => c.channel === channel);
      const copyIndices = selectedCopyIndices[channel] || [];
      const imgIndices = selectedImageIndices[channel] || [];
      const channelImages = allImages.filter((_, i) => imgIndices.includes(i) && allImages[i]?.channelId === channel);

      // 실제 선택된 이미지 필터
      const selImages = allImages.filter((img) => img.channelId === channel && imgIndices.includes(allImages.indexOf(img)));

      for (const ci of copyIndices) {
        const copy = channelCopies?.variations[ci];
        if (!copy) continue;
        for (const img of selImages) {
          combos.push({
            channel,
            channelLabel: channelConfig?.label || channel,
            copy,
            imageUrl: img.imageUrl,
            creativeId: img.creativeId,
          });
        }
      }
    }
    return combos;
  }

  async function handleCompose() {
    if (!campaignId) return;
    setComposing(true);
    setProgress([]);

    const combos = getCombinations();
    addProgress(`${combos.length}개 조합 합성 시작...`);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/compose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combinations: combos.map((c) => ({
            creativeId: c.creativeId,
            copy: c.copy,
            backgroundImageUrl: c.imageUrl,
            channel: c.channel,
          })),
        }),
      });

      if (!res.ok) throw new Error("합성 실패");

      addProgress(`✅ ${combos.length}개 소재 합성 완료!`);
      toast.success("소재 생성 완료!");

      setTimeout(() => {
        router.push(`/brands/${brandId}/campaigns/${campaignId}`);
      }, 2000);
    } catch (err) {
      addProgress(`❌ ${err instanceof Error ? err.message : "오류"}`);
      toast.error("합성 실패");
    } finally {
      setComposing(false);
    }
  }

  function addProgress(msg: string) {
    setProgress((prev) => [...prev, msg]);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">새 캠페인</h1>
        <p className="text-muted-foreground">단계별로 소재를 선택하고 생성합니다</p>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-1 text-xs">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-medium ${
              i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground ring-2 ring-primary/30" : "bg-muted text-muted-foreground"
            }`}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={i === step ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* === Step 1: 캠페인 정보 === */}
      {step === 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>무엇을 홍보하나요? *</Label>
              <Textarea placeholder="예: 재원생 추천으로 신규 등록 시 할인가 제공" value={sellingPoint} onChange={(e) => setSellingPoint(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>캠페인 목표</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "consultation", label: "상담 신청" },
                  { value: "purchase", label: "구매/결제" },
                  { value: "awareness", label: "브랜드 인지도" },
                  { value: "traffic", label: "웹사이트 방문" },
                ].map((g) => (
                  <Badge key={g.value} variant={campaignGoal === g.value ? "default" : "outline"} className="cursor-pointer" onClick={() => setCampaignGoal(g.value)}>{g.label}</Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>추가 정보 (선택)</Label>
              <Textarea placeholder="타겟, 기간, 특별 조건 등" value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} rows={2} />
            </div>
            <Button onClick={handleStep1Next} className="w-full">다음 →</Button>
          </CardContent>
        </Card>
      )}

      {/* === Step 2: 채널 선택 === */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {Object.entries(channelsByPlatform).map(([platform, channels]) => (
              <div key={platform} className="space-y-2">
                <h4 className="text-sm font-medium">{platform}</h4>
                {channels.map((ch: ChannelConfig) => (
                  <label key={ch.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedChannels.includes(ch.id) ? "border-primary bg-primary/5" : "border-muted"}`}>
                    <input type="checkbox" checked={selectedChannels.includes(ch.id)} onChange={() => toggleChannel(ch.id)} className="rounded" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{ch.label}</p>
                      <p className="text-xs text-muted-foreground">{ch.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{ch.aspectRatio}</Badge>
                  </label>
                ))}
              </div>
            ))}
            <div className="space-y-2">
              <Label>채널당 이미지 생성 개수</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 5].map((n) => (
                  <Badge key={n} variant={countPerChannel === n ? "default" : "outline"} className="cursor-pointer px-3 py-1" onClick={() => setCountPerChannel(n)}>{n}개</Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>← 이전</Button>
              <Button onClick={handleStep2Next} className="flex-1" disabled={loading}>
                {loading ? "카피 생성 중..." : "카피 생성 →"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === Step 3: 카피 선택 === */}
      {step === 2 && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <p className="text-sm text-muted-foreground">사용할 카피를 선택하세요. 선택한 카피 × 이미지의 모든 조합이 생성됩니다.</p>

            {allCopies.map((cc) => {
              const channelConfig = CHANNELS.find((c) => c.id === cc.channel);
              const selected = selectedCopyIndices[cc.channel] || [];

              return (
                <div key={cc.channel} className="space-y-2">
                  <h4 className="text-sm font-medium">{channelConfig?.label || cc.channel}</h4>
                  {cc.variations.map((v, i) => (
                    <label key={i} className={`block p-3 rounded-lg border cursor-pointer transition-colors ${selected.includes(i) ? "border-primary bg-primary/5" : "border-muted"}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={selected.includes(i)} onChange={() => toggleCopy(cc.channel, i)} className="rounded mt-1" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{v.angle}</Badge>
                          </div>
                          <p className="text-sm font-bold">{v.headline}</p>
                          <p className="text-xs text-muted-foreground">{v.sub_copy}</p>
                          <Badge variant="secondary" className="text-xs">{v.cta}</Badge>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              );
            })}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>← 이전</Button>
              <Button onClick={handleStep3Next} className="flex-1" disabled={loading}>
                {loading ? "이미지 생성 중..." : "이미지 생성 →"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === Step 4: 이미지 선택 === */}
      {step === 3 && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <p className="text-sm text-muted-foreground">사용할 배경 이미지를 선택하세요.</p>

            {selectedChannels.map((channelId) => {
              const channelConfig = CHANNELS.find((c) => c.id === channelId);
              const channelImages = allImages.filter((img) => img.channelId === channelId);
              const selected = selectedImageIndices[channelId] || [];

              return (
                <div key={channelId} className="space-y-2">
                  <h4 className="text-sm font-medium">{channelConfig?.label || channelId}</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {channelImages.map((img) => {
                      const globalIndex = allImages.indexOf(img);
                      const isSelected = selected.includes(globalIndex);
                      return (
                        <label key={globalIndex} className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${isSelected ? "border-primary" : "border-transparent"}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleImage(channelId, globalIndex)} className="hidden" />
                          <img src={img.imageUrl} alt={`이미지 ${img.variation}`} className="w-full aspect-square object-cover" />
                          <div className="p-1 text-center">
                            <span className="text-xs text-muted-foreground">v{img.variation}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>← 이전</Button>
              <Button onClick={handleStep4Next} className="flex-1">조합 확인 →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === Step 5: 조합 확인 + 합성 === */}
      {step === 4 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {!composing ? (
              <>
                <div className="space-y-3">
                  <p className="text-sm font-medium">생성될 조합 ({getCombinations().length}개)</p>
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {getCombinations().map((combo, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded border text-sm">
                        <img src={combo.imageUrl} alt="" className="w-12 h-12 rounded object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{combo.copy.headline}</p>
                          <p className="text-xs text-muted-foreground truncate">{combo.copy.sub_copy}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{combo.channelLabel}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(3)}>← 이전</Button>
                  <Button onClick={handleCompose} className="flex-1">
                    {getCombinations().length}개 소재 합성 시작
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <h3 className="font-medium">합성 중...</h3>
                {progress.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={msg.startsWith("✅") ? "text-green-500" : msg.startsWith("❌") ? "text-red-500" : "text-yellow-500 animate-pulse"}>●</span>
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
