import type { VisionAnalysis } from "@/lib/memory/types";
import { Badge } from "@/components/ui/badge";

interface VisionAnalysisCardProps {
  analysis: VisionAnalysis;
}

function Bar({ value }: { value: number }) {
  const w = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
      <div className="h-full bg-primary" style={{ width: `${w}%` }} />
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {empty ? <p className="text-xs text-muted-foreground italic">—</p> : children}
    </div>
  );
}

export function VisionAnalysisCard({ analysis }: VisionAnalysisCardProps) {
  const a = analysis ?? {};

  return (
    <div className="grid md:grid-cols-2 gap-4 text-sm">
      <Section title="Layout" empty={!a.layout}>
        <div className="flex gap-1.5 flex-wrap">
          {a.layout?.textZone && <Badge variant="outline">zone: {a.layout.textZone}</Badge>}
          {a.layout?.marginRatio !== undefined && (
            <Badge variant="outline">margin {(a.layout.marginRatio * 100).toFixed(0)}%</Badge>
          )}
          {a.layout?.hierarchy !== undefined && (
            <Badge variant="outline">hierarchy {a.layout.hierarchy}</Badge>
          )}
        </div>
      </Section>

      <Section title="Color" empty={!a.color}>
        <div className="space-y-2">
          {a.color?.palette && a.color.palette.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              {a.color.palette.map((hex, i) => (
                <div key={`${hex}-${i}`} className="flex items-center gap-1">
                  <div
                    className="w-5 h-5 rounded border"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                  <code className="text-xs">{hex}</code>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {a.color?.mood && <Badge variant="outline">mood: {a.color.mood}</Badge>}
            {a.color?.contrastRatio !== undefined && (
              <Badge variant="outline">대비 {a.color.contrastRatio.toFixed(1)}</Badge>
            )}
          </div>
        </div>
      </Section>

      <Section title="Typography" empty={!a.typography}>
        <div className="flex gap-1.5 flex-wrap">
          {a.typography?.style && <Badge variant="outline">{a.typography.style}</Badge>}
          {a.typography?.sizeRatio &&
            Object.entries(a.typography.sizeRatio).map(([k, v]) => (
              <Badge key={k} variant="outline">
                {k}: {v.toFixed(2)}
              </Badge>
            ))}
        </div>
      </Section>

      <Section title="Hook Element" empty={!a.hookElement}>
        <div className="flex gap-1.5 flex-wrap">
          {a.hookElement?.type && <Badge variant="outline">type: {a.hookElement.type}</Badge>}
          {a.hookElement?.placement && (
            <Badge variant="outline">pos: {a.hookElement.placement}</Badge>
          )}
        </div>
      </Section>

      <Section title="Copy Structure" empty={!a.copyStructure}>
        <div className="flex gap-1.5 flex-wrap">
          {a.copyStructure?.hookType && <Badge variant="outline">{a.copyStructure.hookType}</Badge>}
          {a.copyStructure?.framework && (
            <Badge variant="outline">framework: {a.copyStructure.framework}</Badge>
          )}
          {a.copyStructure?.headlineLen !== undefined && (
            <Badge variant="outline">headline {a.copyStructure.headlineLen}자</Badge>
          )}
        </div>
      </Section>

      <Section title="Brand Elements" empty={!a.brandElements}>
        <div className="flex gap-1.5 flex-wrap">
          {a.brandElements?.logoPosition && (
            <Badge variant="outline">logo: {a.brandElements.logoPosition}</Badge>
          )}
          {a.brandElements?.logoSizeRatio !== undefined && (
            <Badge variant="outline">
              size {(a.brandElements.logoSizeRatio * 100).toFixed(1)}%
            </Badge>
          )}
          {a.brandElements?.ctaStyle && (
            <Badge variant="outline">cta: {a.brandElements.ctaStyle}</Badge>
          )}
        </div>
      </Section>

      <Section title="Channel Fit" empty={!a.channelFit}>
        <div className="space-y-1">
          {a.channelFit &&
            Object.entries(a.channelFit).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-12 text-xs uppercase">{k}</span>
                <Bar value={v} />
                <span className="w-8 text-xs text-right">{(v * 100).toFixed(0)}%</span>
              </div>
            ))}
        </div>
      </Section>

      <Section title="Funnel Fit" empty={!a.funnelFit}>
        <div className="space-y-1">
          {a.funnelFit &&
            Object.entries(a.funnelFit).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-16 text-xs">{k}</span>
                <Bar value={v} />
                <span className="w-8 text-xs text-right">{(v * 100).toFixed(0)}%</span>
              </div>
            ))}
        </div>
      </Section>

      {a.notes && (
        <div className="md:col-span-2 text-xs text-muted-foreground pt-2 border-t">
          {a.notes}
        </div>
      )}
    </div>
  );
}
