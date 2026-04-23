"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNotifications } from "@/components/notifications/NotificationContext";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function NewBrandPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const { startOp, completeOp, failOp } = useNotifications();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("브랜드명을 입력하세요");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          website_url: websiteUrl.trim() || null,
          category: category.trim() || null,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "브랜드 생성 실패");
      }
      const { brand } = await res.json();
      toast.success("브랜드가 생성되었습니다");

      // 자동 분석 (URL 제공 + 체크박스 on) — Identity/Offer/Audience까지 자동 채움
      if (autoAnalyze && websiteUrl.trim()) {
        const opId = startOp({
          kind: "brand_analyze",
          title: `${brand.name} 홈페이지 분석`,
          subtitle: "Identity · Offer · Audience 자동 추출",
          estimatedSeconds: 60,
          steps: [
            { label: "HTML 페이지 fetch", atSec: 0 },
            { label: "Claude Opus 분석", atSec: 5 },
            { label: "Identity · Offer · Audience 저장", atSec: 50 },
          ],
          href: `/brands/${brand.id}`,
        });
        // router.push 먼저 → 분석은 백그라운드로 notification 시스템이 추적
        router.push(`/brands/${brand.id}`);
        (async () => {
          try {
            const analyzeRes = await fetch(
              `/api/brands/${brand.id}/analyze-website`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  website_url: websiteUrl.trim(),
                  save_brand_fields: true,
                  save_identity: true,
                  save_offers: true,
                  save_audiences: true,
                }),
              },
            );
            const analyzeData = await analyzeRes.json();
            if (analyzeRes.ok) {
              const parts: string[] = [];
              if (analyzeData.identitySaved) parts.push("Identity");
              if ((analyzeData.offersSaved ?? 0) > 0)
                parts.push(`Offer ${analyzeData.offersSaved}개`);
              if ((analyzeData.audiencesSaved ?? 0) > 0)
                parts.push(`Audience ${analyzeData.audiencesSaved}개`);
              completeOp(opId, {
                subtitle:
                  parts.length > 0
                    ? `${parts.join(" · ")} 자동 생성됨`
                    : "추출 가능한 정보 없음",
                href: `/brands/${brand.id}`,
              });
            } else {
              failOp(opId, analyzeData.error ?? "알 수 없는 오류");
            }
          } catch (e) {
            failOp(opId, e instanceof Error ? e.message : "네트워크 오류");
          }
        })();
        return;
      }

      router.push(`/brands/${brand.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer size="slim">
      <PageHeader
        title="새 브랜드"
        description="기본 정보만 먼저 등록하고, 상세 메모리(Identity·Offer·Audience·BP·폰트)는 이후 섹션별로 입력합니다."
      />

      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">브랜드명 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: STUDYCORE"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">홈페이지 URL</Label>
              <Input
                id="website"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={loading}
              />
              {websiteUrl.trim() && (
                <label className="flex items-start gap-2 text-xs text-muted-foreground pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAnalyze}
                    onChange={(e) => setAutoAnalyze(e.target.checked)}
                    disabled={loading}
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="text-foreground">✨ 자동 분석:</strong> 홈페이지를
                    분석해 카테고리·설명 + Identity(voice/taboos/colors) +
                    Offer(가격/혜택) + Audience(페르소나) 초안을 자동 작성합니다.
                    생성 완료까지 최대 60초 대기.
                  </span>
                </label>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">카테고리</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="education, ecommerce, saas, fnb 등"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                폰트 프리셋 추천에 사용됩니다 (선택)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="브랜드·제품에 대한 간단한 설명"
                rows={3}
                disabled={loading}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
                취소
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "생성 중..." : "등록하고 메모리 설정 →"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
