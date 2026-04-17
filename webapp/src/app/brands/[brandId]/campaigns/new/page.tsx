"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CHANNELS, getChannelsByPlatform } from "@/lib/channels";

const STEPS = [
  { label: "캠페인 정보", description: "소구포인트, 목표" },
  { label: "채널 선택", description: "광고 노출 채널" },
  { label: "확인 + 생성", description: "소재 생성 시작" },
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
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  // Step 1
  const [sellingPoint, setSellingPoint] = useState("");
  const [campaignGoal, setCampaignGoal] = useState("consultation");
  const [additionalInfo, setAdditionalInfo] = useState("");

  // Step 2
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["ig_feed_square"]);

  const channelsByPlatform = getChannelsByPlatform();

  function toggleChannel(channelId: string) {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((c) => c !== channelId) : [...prev, channelId]
    );
  }

  // Step 1 → 2
  function handleStep1Next() {
    if (!sellingPoint.trim()) {
      toast.error("소구포인트를 입력하세요");
      return;
    }
    setStep(1);
  }

  // Step 2 → 3
  function handleStep2Next() {
    if (selectedChannels.length === 0) {
      toast.error("채널을 최소 1개 선택하세요");
      return;
    }
    setStep(2);
  }

  // 생성 시작
  async function handleGenerate() {
    setLoading(true);
    setGenerating(true);
    setProgress([]);

    try {
      // 1. 캠페인 생성
      addProgress("캠페인 생성 중...");
      const campaignRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          name: sellingPoint.slice(0, 50),
          description: `소구포인트: ${sellingPoint}\n목표: ${campaignGoal}\n${additionalInfo}`,
          targetChannels: selectedChannels,
        }),
      });
      if (!campaignRes.ok) throw new Error("캠페인 생성 실패");
      const campaign = await campaignRes.json();
      addProgress("✅ 캠페인 생성 완료");

      // 2. 브리프 생성 (Claude)
      addProgress("크리에이티브 브리프 생성 중... (Claude)");
      const briefRes = await fetch(`/api/campaigns/${campaign.id}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellingPoint, campaignGoal, additionalInfo }),
      });
      if (!briefRes.ok) throw new Error("브리프 생성 실패");
      addProgress("✅ 브리프 생성 완료");

      // 3. 카피 생성 (Claude)
      addProgress("광고 카피 생성 중... (Claude)");
      const copyRes = await fetch(`/api/campaigns/${campaign.id}/copy`, {
        method: "POST",
      });
      if (!copyRes.ok) throw new Error("카피 생성 실패");
      addProgress("✅ 카피 생성 완료");

      // 4. 이미지 생성 (Gemini)
      addProgress("배경 이미지 생성 중... (Gemini) — 1~2분 소요");
      const imageRes = await fetch(`/api/campaigns/${campaign.id}/images`, {
        method: "POST",
      });
      if (!imageRes.ok) throw new Error("이미지 생성 실패");
      addProgress("✅ 이미지 생성 완료");

      // 5. 소재 합성
      addProgress("소재 합성 중... (카피 + 이미지 + 로고)");
      const composeRes = await fetch(`/api/campaigns/${campaign.id}/compose`, {
        method: "POST",
      });
      if (!composeRes.ok) throw new Error("소재 합성 실패");
      addProgress("✅ 소재 합성 완료");

      // 6. 완료
      addProgress("🎉 소재 생성 완료!");
      toast.success("광고 소재가 생성되었습니다!");

      setTimeout(() => {
        router.push(`/brands/${brandId}/campaigns/${campaign.id}`);
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "오류 발생";
      addProgress(`❌ 오류: ${message}`);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function addProgress(msg: string) {
    setProgress((prev) => [...prev, msg]);
  }

  const selectedChannelConfigs = CHANNELS.filter((c) => selectedChannels.includes(c.id));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">새 캠페인</h1>
        <p className="text-muted-foreground">광고 소재를 자동 생성합니다</p>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <div className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: 캠페인 정보 */}
      {step === 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>무엇을 홍보하나요? *</Label>
              <Textarea
                placeholder="예: 재원생 추천으로 신규 등록 시 할인가 제공"
                value={sellingPoint}
                onChange={(e) => setSellingPoint(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                핵심 소구포인트를 자유롭게 적어주세요. AI가 이를 기반으로 카피와 비주얼을 제작합니다.
              </p>
            </div>

            <div className="space-y-2">
              <Label>캠페인 목표</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "consultation", label: "상담 신청" },
                  { value: "purchase", label: "구매/결제" },
                  { value: "awareness", label: "브랜드 인지도" },
                  { value: "traffic", label: "웹사이트 방문" },
                  { value: "app_install", label: "앱 설치" },
                ].map((goal) => (
                  <Badge
                    key={goal.value}
                    variant={campaignGoal === goal.value ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setCampaignGoal(goal.value)}
                  >
                    {goal.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>추가 정보 (선택)</Label>
              <Textarea
                placeholder="타겟, 프로모션 기간, 특별 조건 등 추가 정보가 있으면 적어주세요"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={2}
              />
            </div>

            <Button onClick={handleStep1Next} className="w-full">
              다음 →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: 채널 선택 */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              광고를 노출할 채널을 선택하세요. 비율은 자동으로 매핑됩니다.
            </p>

            {Object.entries(channelsByPlatform).map(([platform, channels]) => (
              <div key={platform} className="space-y-2">
                <h4 className="text-sm font-medium">{platform}</h4>
                <div className="grid grid-cols-1 gap-2">
                  {channels.map((ch) => (
                    <label
                      key={ch.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedChannels.includes(ch.id)
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannels.includes(ch.id)}
                        onChange={() => toggleChannel(ch.id)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{ch.label}</p>
                        <p className="text-xs text-muted-foreground">{ch.description}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {ch.aspectRatio} · {ch.size}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>← 이전</Button>
              <Button onClick={handleStep2Next} className="flex-1">
                다음 →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: 확인 + 생성 */}
      {step === 2 && !generating && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">소구포인트</p>
                <p className="font-medium">{sellingPoint}</p>
              </div>
              <div>
                <p className="text-muted-foreground">목표</p>
                <p className="font-medium">{campaignGoal}</p>
              </div>
              <div>
                <p className="text-muted-foreground">채널 ({selectedChannelConfigs.length}개)</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedChannelConfigs.map((ch) => (
                    <Badge key={ch.id} variant="secondary" className="text-xs">
                      {ch.label} ({ch.aspectRatio})
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-muted-foreground">
                <p>폰트: AI 자동 선택</p>
                <p>컬러: 브랜드 기본값</p>
                <p>로고: 자동 배치</p>
                <p>리뷰: 2단계 자동</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>← 이전</Button>
              <Button onClick={handleGenerate} className="flex-1" disabled={loading}>
                소재 생성 시작
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 생성 진행 상태 */}
      {generating && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-medium">소재 생성 중...</h3>
            <div className="space-y-2">
              {progress.map((msg, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {msg.startsWith("✅") || msg.startsWith("🎉") ? (
                    <span className="text-green-500">●</span>
                  ) : msg.startsWith("❌") ? (
                    <span className="text-red-500">●</span>
                  ) : (
                    <span className="text-yellow-500 animate-pulse">●</span>
                  )}
                  <span className={msg.startsWith("❌") ? "text-red-500" : ""}>{msg}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
