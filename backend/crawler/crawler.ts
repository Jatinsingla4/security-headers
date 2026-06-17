import type { CrawlResult, CrawlReport, LinkStatus } from "../../types" ;
import type { CrawlerConfig } from "./config";
import { extractLinks, isInternalUrl, isExcluded, normalizeUrl } from "./url-utils";

/** Semaphore for concurrency control */
class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      this.active++;
      next();
    }
  }
}

/** Rate limiter — enforces minimum delay between requests to the same host */
class HostRateLimiter {
  private lastRequestTime = new Map<string, number>();

  constructor(private readonly minDelayMs: number) {}

  async waitForHost(url: string): Promise<void> {
    const host = new URL(url).host;
    const last = this.lastRequestTime.get(host) ?? 0;
    const elapsed = Date.now() - last;

    if (elapsed < this.minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minDelayMs - elapsed));
    }

    this.lastRequestTime.set(host, Date.now());
  }
}

export class LinkCrawler {
  private visited = new Set<string>();
  private results: CrawlResult[] = [];
  private semaphore: Semaphore;
  private rateLimiter: HostRateLimiter;

  constructor(private readonly config: CrawlerConfig) {
    this.semaphore = new Semaphore(config.concurrency);
    this.rateLimiter = new HostRateLimiter(config.rateLimitMs);
  }

  /** Run the full crawl and return a report */
  async crawl(): Promise<CrawlReport> {
    const startedAt = new Date().toISOString();

    // Normalize base URL
    const baseUrl = normalizeUrl(this.config.baseUrl, this.config.baseUrl);
    if (!baseUrl) {
      throw new Error(`Invalid base URL: ${this.config.baseUrl}`);
    }

    // Start recursive crawl
    await this.processUrl(baseUrl, null, 0);

    const completedAt = new Date().toISOString();

    const summary: Record<LinkStatus, number> = {
      healthy: 0,
      broken: 0,
      redirected: 0,
      timeout: 0,
      error: 0,
    };

    for (const result of this.results) {
      summary[result.status]++;
    }

    return {
      baseUrl,
      startedAt,
      completedAt,
      totalLinks: this.results.length,
      summary,
      results: this.results,
    };
  }

  private async processUrl(
    url: string,
    parentUrl: string | null,
    depth: number
  ): Promise<void> {
    // Guard: already visited, max URLs reached, or excluded pattern
    if (this.visited.has(url)) return;
    if (this.visited.size >= this.config.maxUrls) return;
    if (isExcluded(url, this.config.excludePatterns)) return;

    this.visited.add(url);

    const isInternal = isInternalUrl(url, this.config.baseUrl);

    // External links: check status only, don't recurse
    if (!isInternal && !this.config.checkExternalLinks) return;

    await this.semaphore.acquire();
    try {
      const result = await this.fetchWithRetry(url, parentUrl, depth);
      this.results.push(result);

      // Only recurse into internal pages that returned HTML
      if (
        isInternal &&
        depth < this.config.maxDepth &&
        result.status === "healthy" &&
        result.statusCode === 200
      ) {
        const html = await this.fetchHtml(url);
        if (html) {
          const links = extractLinks(html, url);
          const tasks = links.map((link) => this.processUrl(link, url, depth + 1));
          await Promise.all(tasks);
        }
      }
    } finally {
      this.semaphore.release();
    }
  }

  /** Fetch a URL with retries and track redirect chains */
  private async fetchWithRetry(
    url: string,
    parentUrl: string | null,
    depth: number
  ): Promise<CrawlResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelayMs * attempt)
        );
      }

      try {
        await this.rateLimiter.waitForHost(url);

        const redirectChain: string[] = [];
        const start = Date.now();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": this.config.userAgent },
          redirect: "follow",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const responseTimeMs = Date.now() - start;

        // Detect redirect chain: if the final URL differs from the request URL
        if (response.redirected && response.url !== url) {
          redirectChain.push(url, response.url);
        }

        const status = this.classifyStatus(response.status, redirectChain.length > 0);

        return {
          url,
          status,
          statusCode: response.status,
          parentUrl,
          redirectChain,
          responseTimeMs,
          depth,
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        const error = err as Error;
        if (error.name === "AbortError") {
          return {
            url,
            status: "timeout",
            statusCode: null,
            parentUrl,
            redirectChain: [],
            responseTimeMs: this.config.timeoutMs,
            error: `Request timed out after ${this.config.timeoutMs}ms`,
            depth,
            timestamp: new Date().toISOString(),
          };
        }
        lastError = error.message;
      }
    }

    return {
      url,
      status: "error",
      statusCode: null,
      parentUrl,
      redirectChain: [],
      responseTimeMs: 0,
      error: lastError ?? "Unknown error after retries",
      depth,
      timestamp: new Date().toISOString(),
    };
  }

  private classifyStatus(code: number, wasRedirected: boolean): LinkStatus {
    if (wasRedirected) return "redirected";
    if (code >= 200 && code < 300) return "healthy";
    if (code === 404 || code === 410) return "broken";
    if (code >= 500) return "broken";
    return "error";
  }

  /** Fetch raw HTML body for link extraction (separate from status check) */
  private async fetchHtml(url: string): Promise<string | null> {
    try {
      await this.rateLimiter.waitForHost(url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(url, {
        headers: {
          "User-Agent": this.config.userAgent,
          Accept: "text/html",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) return null;

      return await response.text();
    } catch {
      return null;
    }
  }
}
