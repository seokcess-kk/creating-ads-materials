export interface OgMeta {
  image: string | null;
  title: string | null;
  description: string | null;
  siteName: string | null;
}

// 흔한 UA로 요청해야 og:* 태그가 SSR에 주입되는 페이지가 많다(SNS 봇용).
const USER_AGENT =
  "Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)";

/**
 * 페이지 HTML을 fetch해 OpenGraph/twitter 메타 태그로 대표 이미지 URL을 추출.
 * Google ATC·Meta Ad Library·TikTok CC 모두 og:* 를 서버에서 주입하는 경우가 많아
 * Playwright 없이 MVP로 충분하다. og:image가 없으면 image=null을 반환한다.
 */
export async function fetchOgMeta(url: string, timeoutMs = 10000): Promise<OgMeta> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return parseOgMeta(html);
  } finally {
    clearTimeout(timer);
  }
}

export function parseOgMeta(html: string): OgMeta {
  const pick = (patterns: RegExp[]): string | null => {
    for (const re of patterns) {
      const m = re.exec(html);
      if (m?.[1]) return decode(m[1].trim());
    }
    return null;
  };
  return {
    image: pick([
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ]),
    title: pick([
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title>([^<]+)<\/title>/i,
    ]),
    description: pick([
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    ]),
    siteName: pick([
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    ]),
  };
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
