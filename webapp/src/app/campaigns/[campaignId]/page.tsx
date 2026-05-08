import { notFound } from "next/navigation";
import {
  getCampaign,
  getStage,
  listRuns,
  listVariants,
  resolveRun,
} from "@/lib/campaigns";
import { getBrand, loadBrandMemory } from "@/lib/memory";
import { getChannel } from "@/lib/channels";
import { computeLogoDefaults } from "@/lib/canvas/compose-from-run";
import { Badge } from "@/components/ui/badge";
import { StrategyGate } from "@/components/campaign/StrategyGate";
import { CopyGate } from "@/components/campaign/CopyGate";
import { VisualStage } from "@/components/campaign/VisualStage";
import { RetouchStudio } from "@/components/campaign/RetouchStudio";
import { ComposeStage } from "@/components/campaign/ComposeStage";
import { ShipCard } from "@/components/campaign/ShipCard";
import { CampaignChannelMenu } from "@/components/campaign/CampaignChannelMenu";
import { CampaignAutomationToggle } from "@/components/campaign/CampaignAutomationToggle";
import { CampaignKeyVisualEditor } from "@/components/campaign/CampaignKeyVisualEditor";
import { DeleteCampaignButton } from "@/components/campaign/DeleteCampaignButton";
import { CampaignNameHeader } from "@/components/campaign/CampaignNameHeader";
import { MaterialSwitcher } from "@/components/campaign/MaterialSwitcher";
import { MoreActionsMenu } from "@/components/common/MoreActionsMenu";
import { BrandContextPanel } from "@/components/campaign/BrandContextPanel";
import { CampaignFontPanel } from "@/components/campaign/CampaignFontPanel";
import { listCampaignFontPairs } from "@/lib/memory/fonts";
import { inferPresetFromCampaignPairs } from "@/lib/fonts/infer-preset";
import { getPresetById } from "@/lib/fonts/tone-pairs";
import { CampaignStepper } from "@/components/campaign/CampaignStepper";
import {
  pickInitialStage,
  type StepDef,
} from "@/components/campaign/stepper-utils";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";

export const dynamic = "force-dynamic";

interface UrlContent {
  url?: string;
}
interface VisualScores {
  suggestions?: string[];
  issues?: string[];
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { campaignId } = await params;
  const { run: runHint } = await searchParams;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();
  const brand = await getBrand(campaign.brand_id);
  const allRuns = await listRuns(campaignId, { includeArchived: true });
  const runs = allRuns.filter((r) => r.archived_at == null);
  const archivedRuns = allRuns.filter((r) => r.archived_at != null);
  const run = await resolveRun(campaignId, runHint);
  const channel = getChannel(campaign.channel);

  // branch-from-copy 가능한 소재가 있는지 (Strategy+Copy 완료 + Visual 진입 이상)
  const hasBranchableSource = runs.some((r) =>
    ["visual", "retouch", "compose", "ship", "complete"].includes(r.status),
  );

  const isVisible = (status: string | undefined) =>
    status === "ready" || status === "stale";

  const strategyStage = run ? await getStage(run.id, "strategy") : null;
  const strategyVariants = strategyStage ? await listVariants(strategyStage.id) : [];
  const strategyReady =
    isVisible(strategyStage?.status) && strategyVariants.some((v) => v.selected);

  const copyStage = run ? await getStage(run.id, "copy") : null;
  const copyVariants = copyStage ? await listVariants(copyStage.id) : [];
  const copyReady =
    isVisible(copyStage?.status) && copyVariants.some((v) => v.selected);

  const visualStage = run ? await getStage(run.id, "visual") : null;
  const visualVariants = visualStage ? await listVariants(visualStage.id) : [];
  const selectedVisual = visualVariants.find((v) => v.selected) ?? null;
  const visualReady = isVisible(visualStage?.status) && Boolean(selectedVisual);
  const baseImageUrl =
    (selectedVisual?.content_json as UrlContent | undefined)?.url ?? null;
  const visualSuggestions = (() => {
    const s = selectedVisual?.scores_json as VisualScores | undefined;
    const out: string[] = [];
    if (s?.suggestions) out.push(...s.suggestions);
    if (s?.issues) out.push(...s.issues);
    return out;
  })();

  const retouchStage = run ? await getStage(run.id, "retouch") : null;
  const retouchVariants = retouchStage ? await listVariants(retouchStage.id) : [];
  const selectedRetouch = retouchVariants.find((v) => v.selected) ?? null;

  const composeReadyGate = Boolean(selectedRetouch) || visualReady;

  const composeStage = run ? await getStage(run.id, "compose") : null;
  const composeVariants = composeStage ? await listVariants(composeStage.id) : [];
  const selectedCompose = composeVariants.find((v) => v.selected) ?? null;
  const composeUrl =
    (selectedCompose?.content_json as UrlContent | undefined)?.url ?? null;
  const composeReady =
    Boolean(selectedCompose) && isVisible(composeStage?.status);

  const shipStage = run ? await getStage(run.id, "ship") : null;

  const memoryForDefaults = await loadBrandMemory(campaign.brand_id);
  const logoDefaults = memoryForDefaults
    ? (() => {
        const d = computeLogoDefaults(memoryForDefaults, {
          goal: campaign.goal,
          channel: campaign.channel.split("_")[0],
        });
        const logos = memoryForDefaults.identity?.logos_json ?? [];
        const primary = logos.find((l) => l.is_primary) ?? logos[0] ?? null;
        return {
          ...d,
          hasLogo: Boolean(primary),
          logoUrl: primary?.url ?? null,
          logos,
        };
      })()
    : {
        position: "top-left" as const,
        widthRatio: 0.14,
        source: "fallback" as const,
        hasLogo: false,
        logoUrl: null,
        logos: [],
      };

  const composeBaseUrl =
    ((selectedRetouch ?? selectedVisual)?.content_json as UrlContent | undefined)?.url ?? null;

  // 캠페인 폰트 오버라이드 현재 상태 추론
  const campaignFontPairs = await listCampaignFontPairs(
    campaign.brand_id,
    campaignId,
  );
  const overridePresetId = await inferPresetFromCampaignPairs(campaignFontPairs);
  const overridePresetLabel = overridePresetId
    ? (getPresetById(overridePresetId)?.label ?? null)
    : null;

  const steps: StepDef[] = [
    {
      key: "strategy",
      label: "Strategy",
      status: strategyStage?.status,
      locked: false,
    },
    {
      key: "copy",
      label: "Copy",
      status: copyStage?.status,
      locked: !strategyReady,
    },
    {
      key: "visual",
      label: "Visual",
      status: visualStage?.status,
      locked: !copyReady,
    },
    {
      key: "retouch",
      label: "Retouch",
      status: retouchStage?.status,
      locked: !visualReady,
      optional: true,
    },
    {
      key: "compose",
      label: "Compose",
      status: composeStage?.status,
      locked: !composeReadyGate,
    },
    {
      key: "ship",
      label: "Ship",
      status: shipStage?.status,
      locked: !composeReady,
    },
  ];
  const initialStage = pickInitialStage(steps);

  return (
    <PageContainer size="wide">
      <Breadcrumb
        items={[
          { label: "Brands", href: "/brands" },
          ...(brand ? [{ label: brand.name, href: `/brands/${brand.id}` }] : []),
          {
            label: "Campaigns",
            href: brand ? `/brands/${brand.id}/campaigns` : undefined,
          },
          { label: campaign.name },
        ]}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <CampaignNameHeader campaignId={campaignId} name={campaign.name} />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary">{campaign.goal}</Badge>
            <CampaignChannelMenu
              campaignId={campaignId}
              currentChannel={campaign.channel}
            />
            <CampaignAutomationToggle
              campaignId={campaignId}
              level={campaign.automation_level}
            />
            <Badge variant={campaign.status === "completed" ? "secondary" : "outline"}>
              {campaign.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <MoreActionsMenu ariaLabel="캠페인 더보기">
            <DeleteCampaignButton
              campaignId={campaignId}
              campaignName={campaign.name}
              redirectTo={
                brand ? `/brands/${brand.id}/campaigns` : "/campaigns"
              }
              variant="menu"
            />
          </MoreActionsMenu>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="space-y-3 lg:w-80 lg:shrink-0">
          <MaterialSwitcher
            campaignId={campaignId}
            runs={runs}
            archivedRuns={archivedRuns}
            activeRunId={run?.id ?? null}
            hasBranchableSource={hasBranchableSource}
            orientation="vertical"
          />

          {memoryForDefaults && (
            <BrandContextPanel
              brandId={campaign.brand_id}
              identity={memoryForDefaults.identity}
              offer={
                memoryForDefaults.offers.find((o) => o.id === campaign.offer_id) ?? null
              }
              audience={
                memoryForDefaults.audiences.find((a) => a.id === campaign.audience_id) ??
                null
              }
            />
          )}

          <CampaignKeyVisualEditor
            campaignId={campaignId}
            intent={campaign.key_visual_intent}
            selectedIds={campaign.selected_key_visual_ids}
            keyVisuals={memoryForDefaults?.keyVisuals ?? []}
          />

          <CampaignFontPanel
            campaignId={campaignId}
            initialPresetId={overridePresetId}
            initialPresetLabel={overridePresetLabel}
            visualReady={visualReady}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <CampaignStepper
            key={run?.id ?? "no-run"}
            steps={steps}
            initialStage={initialStage}
          >
        <StrategyGate
          campaignId={campaignId}
          runId={run?.id ?? null}
          initialRun={run}
          initialStage={strategyStage}
          initialVariants={strategyVariants}
        />

        <CopyGate
          campaignId={campaignId}
          runId={run?.id ?? null}
          strategyReady={strategyReady}
          initialStage={copyStage}
          initialVariants={copyVariants}
        />

        <VisualStage
          campaignId={campaignId}
          runId={run?.id ?? null}
          copyReady={copyReady}
          aspectRatio={channel?.aspectRatio ?? "1:1"}
          initialStage={visualStage}
          initialVariants={visualVariants}
        />

        <RetouchStudio
          campaignId={campaignId}
          runId={run?.id ?? null}
          visualReady={visualReady}
          baseImageUrl={baseImageUrl}
          visualSuggestions={visualSuggestions}
          aspectRatio={channel?.aspectRatio ?? "1:1"}
          initialStage={retouchStage}
          initialVariants={retouchVariants}
        />

        <ComposeStage
          campaignId={campaignId}
          runId={run?.id ?? null}
          previousReady={composeReadyGate}
          baseImageUrl={composeBaseUrl}
          logoDefaults={logoDefaults}
          aspectRatio={channel?.aspectRatio ?? "1:1"}
          initialStage={composeStage}
          initialVariants={composeVariants}
        />

        <ShipCard
          campaignId={campaignId}
          runId={run?.id ?? null}
          campaignName={campaign.name}
          campaignStatus={campaign.status}
          composeReady={composeReady}
          composeUrl={composeUrl}
          aspectRatio={channel?.aspectRatio ?? "1:1"}
          initialRun={run}
          initialStage={shipStage}
        />
          </CampaignStepper>
        </main>
      </div>
    </PageContainer>
  );
}
