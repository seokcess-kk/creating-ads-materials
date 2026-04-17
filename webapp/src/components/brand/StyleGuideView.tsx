"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface StyleGuideViewProps {
  styleGuide: Record<string, unknown>;
}

export function StyleGuideView({ styleGuide }: StyleGuideViewProps) {
  const industry = styleGuide.industry as string | undefined;
  const serviceSummary = styleGuide.service_summary as string | undefined;
  const keyServices = styleGuide.key_services as string[] | undefined;
  const usp = styleGuide.usp as string[] | undefined;
  const sellingPoints = styleGuide.selling_points as string[] | undefined;
  const slogan = styleGuide.slogan as string | undefined;
  const targetAudience = styleGuide.target_audience as Record<string, unknown> | undefined;
  const ctaPatterns = styleGuide.cta_patterns as string[] | undefined;
  const colors = styleGuide.brand_colors as Record<string, string> | undefined;
  const personality = styleGuide.brand_personality as string[] | undefined;
  const tone = styleGuide.tone_of_voice as string | undefined;
  const doList = styleGuide.do as string[] | undefined;
  const dontList = styleGuide.dont as string[] | undefined;
  const recommendedStyle = styleGuide.recommended_ad_style as string | undefined;
  const adAngles = styleGuide.recommended_ad_angles as string[] | undefined;
  const visualStyle = styleGuide.visual_style as Record<string, string> | undefined;

  return (
    <div className="space-y-4 text-sm">
      {/* 업종/서비스 */}
      {(industry || serviceSummary) && (
        <div>
          <h4 className="font-medium mb-2">Business</h4>
          {industry && (
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{industry}</Badge>
            </div>
          )}
          {serviceSummary && (
            <p className="text-muted-foreground">{serviceSummary}</p>
          )}
        </div>
      )}

      {/* 핵심 서비스 */}
      {keyServices && keyServices.length > 0 && (
        <div>
          <h4 className="font-medium mb-1">Services</h4>
          <div className="flex flex-wrap gap-1">
            {keyServices.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* USP / 소구 포인트 */}
      {usp && usp.length > 0 && (
        <div>
          <h4 className="font-medium mb-1">USP (차별점)</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            {usp.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {sellingPoints && sellingPoints.length > 0 && (
        <div>
          <h4 className="font-medium mb-1">Selling Points (소구 포인트)</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            {sellingPoints.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {/* 슬로건 */}
      {slogan && (
        <div>
          <h4 className="font-medium mb-1">Slogan</h4>
          <p className="text-muted-foreground italic">&ldquo;{slogan}&rdquo;</p>
        </div>
      )}

      {/* 타겟 */}
      {targetAudience && (
        <div>
          <h4 className="font-medium mb-1">Target Audience</h4>
          {targetAudience.primary && (
            <p className="text-muted-foreground">주요: {targetAudience.primary as string}</p>
          )}
          {targetAudience.demographics && (
            <p className="text-muted-foreground">인구통계: {targetAudience.demographics as string}</p>
          )}
          {(targetAudience.pain_points as string[] | undefined)?.length && (
            <div className="mt-1">
              <p className="text-xs text-muted-foreground">Pain Points:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(targetAudience.pain_points as string[]).map((p, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CTA 패턴 */}
      {ctaPatterns && ctaPatterns.length > 0 && (
        <div>
          <h4 className="font-medium mb-1">CTA Patterns</h4>
          <div className="flex flex-wrap gap-1">
            {ctaPatterns.map((c, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* 컬러 */}
      {colors && (
        <div>
          <h4 className="font-medium mb-2">Brand Colors</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(colors).map(([role, hex]) => (
              <div key={role} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border" style={{ backgroundColor: hex }} />
                <span className="text-xs">
                  <span className="text-muted-foreground">{role}:</span> {hex}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 브랜드 성격 + 톤 */}
      {personality && personality.length > 0 && (
        <div>
          <h4 className="font-medium mb-1">Brand Personality</h4>
          <p className="text-muted-foreground">{personality.join(", ")}</p>
        </div>
      )}

      {tone && (
        <div>
          <h4 className="font-medium mb-1">Tone of Voice</h4>
          <p className="text-muted-foreground">{tone}</p>
        </div>
      )}

      {/* 비주얼 스타일 */}
      {visualStyle && (
        <div>
          <h4 className="font-medium mb-1">Visual Style</h4>
          {Object.entries(visualStyle).map(([key, val]) => (
            <p key={key} className="text-muted-foreground">
              <span className="text-foreground">{key}:</span> {val}
            </p>
          ))}
        </div>
      )}

      {/* DO / DON'T */}
      <div className="grid grid-cols-2 gap-4">
        {doList && doList.length > 0 && (
          <div>
            <h4 className="font-medium mb-1 text-green-600">DO</h4>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
              {doList.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
        {dontList && dontList.length > 0 && (
          <div>
            <h4 className="font-medium mb-1 text-red-500">DON&apos;T</h4>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
              {dontList.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* 광고 추천 */}
      {recommendedStyle && (
        <div>
          <h4 className="font-medium mb-1">Recommended Style</h4>
          <p className="text-muted-foreground">{recommendedStyle}</p>
        </div>
      )}

      {adAngles && adAngles.length > 0 && (
        <div>
          <h4 className="font-medium mb-1">Recommended Ad Angles</h4>
          <div className="flex flex-wrap gap-1">
            {adAngles.map((a, i) => (
              <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
