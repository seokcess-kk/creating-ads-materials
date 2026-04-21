import type { Playbook } from "./types";
import { INSTAGRAM_FEED_BOFU } from "./instagram-feed";
import { INSTAGRAM_STORY_BOFU } from "./ig-story";
import { INSTAGRAM_FEED_VERTICAL_BOFU } from "./ig-feed-vertical";
import { FACEBOOK_FEED_BOFU } from "./fb-feed-square";
import { TIKTOK_BOFU } from "./tiktok";

const ALL_PLAYBOOKS: Playbook[] = [
  INSTAGRAM_FEED_BOFU,
  INSTAGRAM_FEED_VERTICAL_BOFU,
  INSTAGRAM_STORY_BOFU,
  FACEBOOK_FEED_BOFU,
  TIKTOK_BOFU,
];

const REGISTRY: Record<string, Playbook> = {};
for (const pb of ALL_PLAYBOOKS) {
  REGISTRY[pb.version] = pb;
  REGISTRY[`${pb.channel}@latest`] = pb;
}

export function getPlaybook(
  channel: string,
  funnelStage: "TOFU" | "MOFU" | "BOFU",
  version?: string,
): Playbook {
  if (version) {
    const key = version.includes("@")
      ? version
      : `${channel}.${funnelStage.toLowerCase()}@${version}`;
    const found = REGISTRY[key];
    if (found) return found;
  }
  const latestKey = `${channel}@latest`;
  const latest = REGISTRY[latestKey];
  if (latest && latest.funnelStage === funnelStage) return latest;
  throw new Error(`플레이북 없음: channel=${channel}, stage=${funnelStage}`);
}

export function listPlaybookVersions(): Array<{
  version: string;
  channel: string;
  funnelStage: string;
}> {
  return ALL_PLAYBOOKS.map((p) => ({
    version: p.version,
    channel: p.channel,
    funnelStage: p.funnelStage,
  }));
}

export function listSupportedChannels(): string[] {
  return ALL_PLAYBOOKS.map((p) => p.channel);
}
