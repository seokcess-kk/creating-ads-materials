export type AdPlatform =
  | "google_atc"
  | "meta_ad_library"
  | "tiktok_cc"
  | "unknown";

export interface ParsedAdUrl {
  platform: AdPlatform;
  canonical: string;
  id: string | null;
}

export function parseAdUrl(raw: string): ParsedAdUrl {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("URL 형식이 올바르지 않습니다");
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "adstransparency.google.com") {
    const id =
      /\/creative\/(CR[A-Za-z0-9]+)/.exec(u.pathname)?.[1] ??
      /\/advertiser\/(AR[A-Za-z0-9]+)/.exec(u.pathname)?.[1] ??
      null;
    return { platform: "google_atc", canonical: u.toString(), id };
  }
  if (host === "facebook.com" && u.pathname.startsWith("/ads/library")) {
    const id = u.searchParams.get("id");
    const c = new URL("https://www.facebook.com/ads/library/");
    if (id) c.searchParams.set("id", id);
    return { platform: "meta_ad_library", canonical: c.toString(), id };
  }
  if (host === "ads.tiktok.com" && u.pathname.includes("/creativecenter")) {
    const id =
      /\/topads\/(\d+)/.exec(u.pathname)?.[1] ??
      /\/inspiration\/(\w+)/.exec(u.pathname)?.[1] ??
      null;
    return { platform: "tiktok_cc", canonical: u.toString(), id };
  }
  return { platform: "unknown", canonical: u.toString(), id: null };
}

export function platformLabel(p: AdPlatform): string {
  switch (p) {
    case "google_atc":
      return "Google Ads Transparency";
    case "meta_ad_library":
      return "Meta Ad Library";
    case "tiktok_cc":
      return "TikTok Creative Center";
    default:
      return "기타";
  }
}
