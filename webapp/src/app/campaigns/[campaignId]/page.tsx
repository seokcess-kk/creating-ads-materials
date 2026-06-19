import { notFound } from "next/navigation";
import {
  campaignStatusLabel,
  getCampaign,
  listRuns,
  listStages,
  listVariants,
} from "@/lib/campaigns";
import type {
  CreativeStageName,
  CreativeStageRow,
} from "@/lib/campaigns/types";
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
import {
  RunningOpsSync,
  type RunningStageInfo,
} from "@/components/campaign/RunningOpsSync";
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
import { getCampaignCost } from "@/lib/usage";

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

  // Level 0 — campaign이 다른 모든 호출의 의존성
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  // Level 1 — campaign만 의존하는 호출들을 병렬로
  const [brand, allRuns, memoryForDefaults, campaignFontPairs, campaignCost] =
    await Promise.all([
      getBrand(campaign.brand_id),
      listRuns(campaignId, { includeArchived: true }),
      loadBrandMemory(campaign.brand_id),
      listCampaignFontPairs(campaign.brand_id, campaignId),
      getCampaignCost(campaignId),
    ]);

  const runs = allRuns.filter((r) => r.archived_at == null);
  const archivedRuns = allRuns.filter((r) => r.archived_at != null);
  // 활성 run을 allRuns에서 직접 결정 — resolveRun의 추가 쿼리 회피
  const run = runHint
    ? (runs.find((r) => r.id === runHint) ?? null)
    : (runs[0] ?? null);
  const channel = getChannel(campaign.channel);

  // branch-from-copy 가능한 소재가 있는지 (Strategy+Copy 완료 + Visual 진입 이상)
  const hasBranchableSource = runs.some((r) =>
    ["visual", "retouch", "compose", "ship", "complete"].includes(r.status),
  );

  const isVisible = (status: string | undefined) =>
    status === "ready" || status === "stale";

  // Level 2 — run의 모든 stage를 한 번에 + 폰트 프리셋 추론 병렬
  const [stagesArr, overridePresetId] = await Promise.all([
    run ? listStages(run.id) : Promise.resolve([] as CreativeStageRow[]),
    inferPresetFromCampaignPairs(campaignFontPairs),
  ]);
  const stageByName = stagesArr.reduce<
    Partial<Record<CreativeStageName, CreativeStageRow>>
  >((acc, s) => {
    acc[s.stage] = s;
    return acc;
  }, {});
  const strategyStage = stageByName.strategy ?? null;
  const copyStage = stageByName.copy ?? null;
  const visualStage = stageByName.visual ?? null;
  const retouchStage = stageByName.retouch ?? null;
  const composeStage = stageByName.compose ?? null;
  const shipStage = stageByName.ship ?? null;

  // Level 3 — 각 stage의 active variants를 병렬로
  const [
    strategyVariants,
    copyVariants,
    visualVariants,
    retouchVariants,
    composeVariants,
  ] = await Promise.all([
    strategyStage ? listVariants(strategyStage.id) : Promise.resolve([]),
    copyStage ? listVariants(copyStage.id) : Promise.resolve([]),
    visualStage ? listVariants(visualStage.id) : Promise.resolve([]),
    retouchStage ? listVariants(retouchStage.id) : Promise.resolve([]),
    composeStage ? listVariants(composeStage.id) : Promise.resolve([]),
  ]);

  const strategyReady =
    isVisible(strategyStage?.status) && strategyVariants.some((v) => v.selected);
  const copyReady =
    isVisible(copyStage?.status) && copyVariants.some((v) => v.selected);
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

  const selectedRetouch = retouchVariants.find((v) => v.selected) ?? null;
  const composeReadyGate = Boolean(selectedRetouch) || visualReady;

  const selectedCompose = composeVariants.find((v) => v.selected) ?? null;
  const composeUrl =
    (selectedCompose?.content_json as UrlContent | undefined)?.url ?? null;
  const composeReady =
    Boolean(selectedCompose) && isVisible(composeStage?.status);
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

  // 폰트 프리셋 라벨 (overridePresetId는 Level 2에서 이미 계산됨)
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

  // 새로고침/탭 이동에도 전역 진행바가 유지되도록, 서버 running stage를 op로 복원
  const runningStages: RunningStageInfo[] = stagesArr
    .filter((s) => s.status === "running")
    .map((s) => ({
      stage: s.stage,
      runId: run?.id ?? null,
      startedAt: s.started_at ? Date.parse(s.started_at) : null,
    }));

  return (
    <PageContainer size="wide">
      <RunningOpsSync campaignId={campaignId} running={runningStages} />
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
              {campaignStatusLabel(campaign.status)}
            </Badge>
            <Badge
              variant="outline"
              className="font-normal tabular-nums text-muted-foreground"
              title={`이 캠페인 ${campaignCost.totalCalls}회 호출 누적${
                run && campaignCost.byRun[run.id] != null
                  ? ` · 현재 소재 $${campaignCost.byRun[run.id].toFixed(4)}`
                  : ""
              }`}
            >
              💰 ${campaignCost.totalCost.toFixed(4)}
              {run && campaignCost.byRun[run.id] != null && (
                <span className="ml-1 opacity-60">
                  (소재 ${campaignCost.byRun[run.id].toFixed(4)})
                </span>
              )}
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

      <MaterialSwitcher
        campaignId={campaignId}
        runs={runs}
        archivedRuns={archivedRuns}
        activeRunId={run?.id ?? null}
        hasBranchableSource={hasBranchableSource}
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
          automationLevel={campaign.automation_level}
        />

        <VisualStage
          campaignId={campaignId}
          runId={run?.id ?? null}
          copyReady={copyReady}
          aspectRatio={channel?.aspectRatio ?? "1:1"}
          initialStage={visualStage}
          initialVariants={visualVariants}
          automationLevel={campaign.automation_level}
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
          automationLevel={campaign.automation_level}
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
    </PageContainer>
  );
}
