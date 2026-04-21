export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface ChannelConfig {
  id: string;
  label: string;
  platform: string;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  size: string;
  description: string;
}

export const CHANNELS: Record<string, ChannelConfig> = {
  ig_feed_square: {
    id: "ig_feed_square",
    label: "Instagram Feed (정사각 1:1)",
    platform: "Instagram",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    size: "1080x1080",
    description: "가장 범용적인 피드 소재",
  },
  ig_feed_vertical: {
    id: "ig_feed_vertical",
    label: "Instagram Feed (세로 4:5)",
    platform: "Instagram",
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
    size: "1080x1350",
    description: "피드에서 세로 영역 극대화",
  },
  ig_story: {
    id: "ig_story",
    label: "Instagram Story / Reels (9:16)",
    platform: "Instagram",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    size: "1080x1920",
    description: "풀스크린 세로형, 몰입 광고",
  },
  fb_feed_square: {
    id: "fb_feed_square",
    label: "Facebook Feed (정사각 1:1)",
    platform: "Facebook",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    size: "1080x1080",
    description: "FB 피드 1:1, 대화형 톤",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok (9:16)",
    platform: "TikTok",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    size: "1080x1920",
    description: "풀스크린 세로, 트렌드·캐주얼 톤",
  },
};

export const ACTIVE_CHANNELS = [
  "ig_feed_square",
  "ig_feed_vertical",
  "ig_story",
  "fb_feed_square",
  "tiktok",
] as const;

export function getChannel(id: string): ChannelConfig | null {
  return CHANNELS[id] ?? null;
}

export function isActive(id: string): boolean {
  return (ACTIVE_CHANNELS as readonly string[]).includes(id);
}

export function listActiveChannels(): ChannelConfig[] {
  return ACTIVE_CHANNELS.map((id) => CHANNELS[id]).filter(Boolean);
}
