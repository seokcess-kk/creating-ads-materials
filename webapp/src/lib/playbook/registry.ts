import type { Playbook } from "./types";
import { INSTAGRAM_FEED_BOFU } from "./instagram-feed";

const REGISTRY: Record<string, Playbook> = {
  [INSTAGRAM_FEED_BOFU.version]: INSTAGRAM_FEED_BOFU,
  [`${INSTAGRAM_FEED_BOFU.channel}@latest`]: INSTAGRAM_FEED_BOFU,
};

export function getPlaybook(
  channel: string,
  funnelStage: "TOFU" | "MOFU" | "BOFU",
  version?: string,
): Playbook {
  if (version) {
    const key = version.includes("@") ? version : `${channel}.${funnelStage.toLowerCase()}@${version}`;
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
  return Object.values(REGISTRY)
    .filter((p, i, arr) => arr.findIndex((x) => x.version === p.version) === i)
    .map((p) => ({ version: p.version, channel: p.channel, funnelStage: p.funnelStage }));
}
