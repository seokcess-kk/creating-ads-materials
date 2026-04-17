"use client";

interface StyleGuideViewProps {
  styleGuide: Record<string, unknown>;
}

export function StyleGuideView({ styleGuide }: StyleGuideViewProps) {
  const colors = styleGuide.brand_colors as Record<string, string> | undefined;
  const personality = styleGuide.brand_personality as string[] | undefined;
  const tone = styleGuide.tone_of_voice as string | undefined;
  const doList = styleGuide.do as string[] | undefined;
  const dontList = styleGuide.dont as string[] | undefined;
  const recommendedStyle = styleGuide.recommended_ad_style as string | undefined;

  return (
    <div className="space-y-4 text-sm">
      {colors && (
        <div>
          <h4 className="font-medium mb-2">Brand Colors</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(colors).map(([role, hex]) => (
              <div key={role} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-xs">
                  <span className="text-muted-foreground">{role}:</span> {hex}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {doList && doList.length > 0 && (
        <div>
          <h4 className="font-medium mb-1 text-green-600">DO</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            {doList.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {dontList && dontList.length > 0 && (
        <div>
          <h4 className="font-medium mb-1 text-red-500">DON&apos;T</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            {dontList.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {recommendedStyle && (
        <div>
          <h4 className="font-medium mb-1">Recommended Ad Style</h4>
          <p className="text-muted-foreground">{recommendedStyle}</p>
        </div>
      )}
    </div>
  );
}
