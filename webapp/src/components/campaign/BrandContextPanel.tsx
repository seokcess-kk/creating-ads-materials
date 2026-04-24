"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BrandAudience, BrandIdentity, BrandOffer } from "@/lib/memory/types";

interface BrandContextPanelProps {
  brandId: string;
  identity: BrandIdentity | null;
  offer: BrandOffer | null;
  audience: BrandAudience | null;
}

export function BrandContextPanel({
  brandId,
  identity,
  offer,
  audience,
}: BrandContextPanelProps) {
  const [open, setOpen] = useState(false);
  const voice = identity?.voice_json as
    | { tone?: string; personality?: string[] }
    | undefined;

  return (
    <Card className="bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">📋 브랜드 컨텍스트</span>
          {offer && (
            <Badge variant="outline" className="text-xs">
              {offer.title}
            </Badge>
          )}
          {audience && (
            <Badge variant="outline" className="text-xs">
              {audience.persona_name}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {open ? "접기 ▲" : "펼치기 ▼"}
        </span>
      </button>
      {open && (
        <CardContent className="space-y-4 pt-0 border-t">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">Identity</span>
                <Link
                  href={`/brands/${brandId}/identity`}
                  className="text-[11px] text-primary hover:underline"
                >
                  편집 →
                </Link>
              </div>
              {identity ? (
                <div className="space-y-1 text-muted-foreground">
                  {voice?.tone && (
                    <p>Tone: {voice.tone}</p>
                  )}
                  {voice?.personality && voice.personality.length > 0 && (
                    <p>Personality: {voice.personality.slice(0, 3).join(", ")}</p>
                  )}
                  {identity.taboos?.length ? (
                    <p className="text-destructive">
                      금지어: {identity.taboos.slice(0, 3).join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-destructive">미설정</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">Offer</span>
                <Link
                  href={`/brands/${brandId}/offers`}
                  className="text-[11px] text-primary hover:underline"
                >
                  편집 →
                </Link>
              </div>
              {offer ? (
                <div className="space-y-1 text-muted-foreground">
                  {offer.usp && <p className="line-clamp-2">{offer.usp}</p>}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {offer.price && (
                      <Badge variant="outline" className="text-[10px]">
                        {offer.price}
                      </Badge>
                    )}
                    {offer.urgency && (
                      <Badge variant="outline" className="text-[10px]">
                        ⏰ {offer.urgency}
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">선택 안 됨</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">Audience</span>
                <Link
                  href={`/brands/${brandId}/audiences`}
                  className="text-[11px] text-primary hover:underline"
                >
                  편집 →
                </Link>
              </div>
              {audience ? (
                <div className="space-y-1 text-muted-foreground">
                  {audience.pains?.length > 0 && (
                    <p className="line-clamp-2">
                      Pains: {audience.pains.slice(0, 3).join(", ")}
                    </p>
                  )}
                  {audience.desires?.length > 0 && (
                    <p className="line-clamp-2">
                      Desires: {audience.desires.slice(0, 2).join(", ")}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">선택 안 됨</p>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground border-t pt-2">
            💡 여기 값 변경 후 재생성하면 새 컨텍스트 반영. 기존 결과는 자동으로
            stale로 마킹됩니다.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
