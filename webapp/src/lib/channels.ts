export interface ChannelConfig {
  id: string;
  label: string;
  platform: string;
  aspectRatio: string;
  size: string;
  description: string;
}

export const CHANNELS: Record<string, ChannelConfig> = {
  ig_feed_square: {
    id: "ig_feed_square",
    label: "Instagram Feed (정사각)",
    platform: "Instagram",
    aspectRatio: "1:1",
    size: "1080x1080",
    description: "가장 범용적인 피드 소재",
  },
  ig_feed_vertical: {
    id: "ig_feed_vertical",
    label: "Instagram Feed (세로)",
    platform: "Instagram",
    aspectRatio: "4:5",
    size: "1080x1350",
    description: "피드에서 더 큰 영역 차지",
  },
  ig_story: {
    id: "ig_story",
    label: "Instagram Story / Reels",
    platform: "Instagram",
    aspectRatio: "9:16",
    size: "1080x1920",
    description: "풀스크린 세로형",
  },
  fb_feed_square: {
    id: "fb_feed_square",
    label: "Facebook Feed (정사각)",
    platform: "Facebook",
    aspectRatio: "1:1",
    size: "1080x1080",
    description: "FB 피드 정사각",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    platform: "TikTok",
    aspectRatio: "9:16",
    size: "1080x1920",
    description: "풀스크린 세로형",
  },
};

export const M2_ACTIVE_CHANNELS = ["ig_feed_square"] as const;

export function getChannel(id: string): ChannelConfig | null {
  return CHANNELS[id] ?? null;
}

export function isActiveInM2(id: string): boolean {
  return (M2_ACTIVE_CHANNELS as readonly string[]).includes(id);
}
