"use client";

import { Button } from "@/components/ui/button";

interface StaleBannerProps {
  stage: string;
  upstreamStage: string;
  onRegenerate: () => void;
  running: boolean;
}

export function StaleBanner({
  stage,
  upstreamStage,
  onRegenerate,
  running,
}: StaleBannerProps) {
  return (
    <div className="border border-amber-500/60 bg-amber-500/5 rounded-md p-3 flex items-center gap-3">
      <span className="text-lg" aria-hidden>
        ⚠️
      </span>
      <div className="flex-1 text-sm">
        <p className="font-medium">
          {upstreamStage}이(가) 변경되어 현재 {stage}이(가) 오래되었습니다
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          아래 결과물은 이전 {upstreamStage} 기반입니다. 최신 결과를 원하면 재생성하세요.
        </p>
      </div>
      <Button size="sm" onClick={onRegenerate} disabled={running}>
        {running ? "재생성 중..." : "🔄 재생성"}
      </Button>
    </div>
  );
}
