import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCampaign,
  getLatestRun,
  getStage,
  listStages,
  listVariants,
} from "@/lib/campaigns";
import { getBrand } from "@/lib/memory";
import { getChannel } from "@/lib/channels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StrategyGate } from "@/components/campaign/StrategyGate";
import { CopyGate } from "@/components/campaign/CopyGate";
import { VisualStage } from "@/components/campaign/VisualStage";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();
  const brand = await getBrand(campaign.brand_id);
  const run = await getLatestRun(campaignId);
  const stages = run ? await listStages(run.id) : [];
  const channel = getChannel(campaign.channel);

  const strategyStage = run ? await getStage(run.id, "strategy") : null;
  const strategyVariants = strategyStage ? await listVariants(strategyStage.id) : [];
  const strategyReady =
    strategyStage?.status === "ready" && strategyVariants.some((v) => v.selected);

  const copyStage = run ? await getStage(run.id, "copy") : null;
  const copyVariants = copyStage ? await listVariants(copyStage.id) : [];
  const copyReady = copyStage?.status === "ready" && copyVariants.some((v) => v.selected);

  const visualStage = run ? await getStage(run.id, "visual") : null;
  const visualVariants = visualStage ? await listVariants(visualStage.id) : [];

  const stageRows = ["strategy", "copy", "visual", "retouch", "compose", "ship"] as const;
  const stageMap = Object.fromEntries(stages.map((s) => [s.stage, s]));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {brand && (
            <p className="text-xs text-muted-foreground">
              <Link href={`/brands/${brand.id}`} className="hover:underline">
                {brand.name}
              </Link>
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{campaign.goal}</Badge>
            {channel && <Badge variant="outline">{channel.label}</Badge>}
            <Badge variant={campaign.status === "completed" ? "secondary" : "outline"}>
              {campaign.status}
            </Badge>
            {run && <Badge variant="outline">run: {run.status}</Badge>}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">파이프라인</CardTitle>
          <CardDescription>M2는 Strategy → Copy → Visual까지 활성</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {stageRows.map((stage, i) => {
            const row = stageMap[stage];
            const active = i <= 2;
            return (
              <div
                key={stage}
                className="flex items-center justify-between border rounded-md p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                      row?.status === "ready"
                        ? "bg-primary text-primary-foreground"
                        : row?.status === "running"
                          ? "bg-primary/50 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="text-sm capitalize">{stage}</span>
                  {!active && <Badge variant="outline">M3</Badge>}
                </div>
                {row && (
                  <Badge
                    variant={
                      row.status === "ready"
                        ? "secondary"
                        : row.status === "failed"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {row.status}
                  </Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <StrategyGate
        campaignId={campaignId}
        initialRun={run}
        initialStage={strategyStage}
        initialVariants={strategyVariants}
      />

      <CopyGate
        campaignId={campaignId}
        strategyReady={strategyReady}
        initialStage={copyStage}
        initialVariants={copyVariants}
      />

      <VisualStage
        campaignId={campaignId}
        copyReady={copyReady}
        initialStage={visualStage}
        initialVariants={visualVariants}
      />
    </div>
  );
}
