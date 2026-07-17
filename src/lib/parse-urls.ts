/**
 * Parse, normalize, and dedupe URLs from raw pasted text.
 * Supports: bare URL lists (primary), title+URL pairs, and JSON arrays.
 */

const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "gclsrc", "dclid", "msclkid",
  "mc_cid", "mc_eid", "ref", "referrer",
];

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;

    // Strip tracking params
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }

    // Remove trailing slashes for consistent dedup
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (url.pathname === "/") {
      return `${url.origin}${url.search}${url.hash}`;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function extractUrlFromLine(line: string): string | null {
  // Match URLs anywhere in the line
  const urlMatch = line.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/i);
  return urlMatch ? urlMatch[0] : null;
}

export interface ParsedTab {
  url: string;
  title: string;
}

export function parseUrls(input: string): ParsedTab[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // Try JSON parse first (Firefox export format)
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const tabs: ParsedTab[] = [];
      for (const item of parsed) {
        const url = typeof item === "string" ? item : item?.url;
        const title = typeof item === "string" ? "" : (item?.title || "");
        if (url) {
          const normalized = normalizeUrl(url);
          if (normalized) tabs.push({ url: normalized, title });
        }
      }
      return dedupeByUrl(tabs);
    }
  } catch {
    // Not JSON, continue to line-based parsing
  }

  // Line-based parsing
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const tabs: ParsedTab[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rawUrl = extractUrlFromLine(line);

    if (rawUrl) {
      const normalized = normalizeUrl(rawUrl);
      if (!normalized) continue;

      // Check if previous line was a title (non-URL text)
      const prevLine = i > 0 ? lines[i - 1] : null;
      const prevIsTitle = prevLine && !extractUrlFromLine(prevLine);
      const title = prevIsTitle ? prevLine : "";

      tabs.push({ url: normalized, title });
    }
  }

  return dedupeByUrl(tabs);
}

function dedupeByUrl(tabs: ParsedTab[]): ParsedTab[] {
  const seen = new Set<string>();
  return tabs.filter(tab => {
    if (seen.has(tab.url)) return false;
    seen.add(tab.url);
    return true;
  });
}
