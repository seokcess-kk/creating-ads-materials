export interface ChannelConfig {
  id: string;
  label: string;
  platform: string;
  aspectRatio: string;
  size: string;
  description: string;
}

export const CHANNELS: ChannelConfig[] = [
  { id: "ig_feed_square", label: "Instagram Feed (정사각)", platform: "Instagram", aspectRatio: "1:1", size: "1080x1080", description: "가장 범용적인 피드 소재" },
  { id: "ig_feed_vertical", label: "Instagram Feed (세로)", platform: "Instagram", aspectRatio: "4:5", size: "1080x1350", description: "피드에서 더 큰 영역 차지" },
  { id: "ig_story", label: "Instagram Story / Reels", platform: "Instagram", aspectRatio: "9:16", size: "1080x1920", description: "풀스크린 세로형" },
  { id: "fb_feed_square", label: "Facebook Feed (정사각)", platform: "Facebook", aspectRatio: "1:1", size: "1080x1080", description: "FB 피드 정사각" },
  { id: "fb_feed_landscape", label: "Facebook Feed (가로)", platform: "Facebook", aspectRatio: "16:9", size: "1200x628", description: "FB 피드 가로형" },
  { id: "tiktok", label: "TikTok", platform: "TikTok", aspectRatio: "9:16", size: "1080x1920", description: "풀스크린 세로형" },
  { id: "banner_medium", label: "GDN 배너 (300x250)", platform: "Display", aspectRatio: "4:3", size: "300x250", description: "미디엄 렉탱글" },
  { id: "banner_leaderboard", label: "GDN 배너 (728x90)", platform: "Display", aspectRatio: "16:9", size: "728x90", description: "리더보드" },
];

export function getChannelsByPlatform() {
  const grouped: Record<string, ChannelConfig[]> = {};
  for (const ch of CHANNELS) {
    if (!grouped[ch.platform]) grouped[ch.platform] = [];
    grouped[ch.platform].push(ch);
  }
  return grouped;
}
