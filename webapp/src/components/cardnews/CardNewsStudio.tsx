"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface SlideOut {
  index: number;
  role: string;
  kicker?: string;
  headline: string;
  body?: string;
  url: string;
}

export function CardNewsStudio({ brandId }: { brandId: string }) {
  const [content, setContent] = useState("");
  const [tone, setTone] = useState("");
  const [name, setName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<SlideOut[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const canSubmit = content.trim().length >= 10;

  async function generate() {
    if (!canSubmit) {
      toast.error("원문을 10자 이상 입력하세요");
      return;
    }
    setGenerating(true);
    setSlides([]);
    setTitle("");
    try {
      const res = await fetch(`/api/brands/${brandId}/cardnews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          tone: tone.trim() || null,
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setTitle(data.carousel.title);
      setSlides(data.carousel.slides_json as SlideOut[]);
      setCampaignId(data.campaignId);
      toast.success(`카드뉴스 ${data.carousel.slides_json.length}장 생성됨`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">원문 *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="안내문·공지·소식 원문을 통째로 붙여넣으세요"
            rows={8}
            disabled={generating}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">제목 (선택)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="비우면 자동 생성"
                disabled={generating}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">톤 (선택)</Label>
              <Input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="예: 사무적·간결, 프리미엄 지양"
                disabled={generating}
              />
            </div>
          </div>
          <Button onClick={generate} disabled={!canSubmit || generating}>
            {generating
              ? "생성 중… (아웃라인 → 배경 → 슬라이드 합성, ~30초)"
              : "카드뉴스 생성 →"}
          </Button>
        </CardContent>
      </Card>

      {slides.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {title || "카드뉴스"}
              <Badge variant="secondary">{slides.length}장</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {slides.map((s) => (
                <div key={s.index} className="shrink-0 w-56 space-y-1">
                  <img
                    src={s.url}
                    alt={`슬라이드 ${s.index}`}
                    className="w-56 h-56 object-cover rounded-md border"
                  />
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {s.index} · {s.role}
                    </Badge>
                    <a
                      href={s.url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline"
                    >
                      다운로드
                    </a>
                  </div>
                </div>
              ))}
            </div>
            {campaignId && (
              <p className="text-xs text-muted-foreground">소재 ID: {campaignId}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
