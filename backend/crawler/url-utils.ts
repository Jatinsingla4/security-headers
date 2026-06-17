/**
 * URL normalization and classification utilities for the crawler.
 */

/** Normalize a URL by removing trailing slashes, fragments, and lowercasing the host */
export function normalizeUrl(raw: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(raw, baseUrl);

    // Remove fragment
    resolved.hash = "";

    // Remove trailing slash for consistency (except root)
    let href = resolved.href;
    if (href.endsWith("/") && resolved.pathname !== "/") {
      href = href.slice(0, -1);
    }

    return href;
  } catch {
    return null;
  }
}

/** Check whether a URL is internal (same origin as base) */
export function isInternalUrl(url: string, baseUrl: string): boolean {
  try {
    const target = new URL(url);
    const base = new URL(baseUrl);
    return target.origin === base.origin;
  } catch {
    return false;
  }
}

/** Check if a URL matches any of the exclusion patterns */
export function isExcluded(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => new RegExp(pattern, "i").test(url));
}

/** Extract all href values from an HTML string */
export function extractLinks(html: string, pageUrl: string): string[] {
  const links: string[] = [];
  // Match href attributes in anchor tags — handles both single and double quotes
  const hrefRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;

    const normalized = normalizeUrl(raw, pageUrl);
    if (normalized) {
      links.push(normalized);
    }
  }

  return [...new Set(links)]; // Deduplicate
}
