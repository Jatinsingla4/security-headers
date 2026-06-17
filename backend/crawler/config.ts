export interface CrawlerConfig {
  /** Starting URL to crawl */
  baseUrl: string;
  /** Maximum recursion depth (0 = only base URL) */
  maxDepth: number;
  /** Maximum concurrent requests */
  concurrency: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Maximum number of retries per URL */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelayMs: number;
  /** Minimum delay between requests to same host (rate limiting) */
  rateLimitMs: number;
  /** Maximum total URLs to crawl (safety limit) */
  maxUrls: number;
  /** User-Agent string for requests */
  userAgent: string;
  /** Patterns to exclude from crawling (regex strings) */
  excludePatterns: string[];
  /** Whether to follow external links (for status checks only, not recursion) */
  checkExternalLinks: boolean;
  /** Output file path for JSON report */
  outputPath: string;
  /** Fail process if broken links found (for CI mode) */
  failOnBrokenLinks: boolean;
}

export const DEFAULT_CONFIG: CrawlerConfig = {
  baseUrl: "http://localhost:3000",
  maxDepth: 5,
  concurrency: 10,
  timeoutMs: 10_000,
  maxRetries: 2,
  retryDelayMs: 1_000,
  rateLimitMs: 100,
  maxUrls: 5_000,
  userAgent: "SecurityHeaders-LinkChecker/1.0",
  excludePatterns: [
    "\\.pdf$",
    "\\.zip$",
    "\\.png$",
    "\\.jpg$",
    "\\.jpeg$",
    "\\.gif$",
    "\\.svg$",
    "\\.mp4$",
    "\\.webp$",
    "#",           // Fragment-only links
    "mailto:",
    "tel:",
    "javascript:",
  ],
  checkExternalLinks: true,
  outputPath: "reports/crawl-report.json",
  failOnBrokenLinks: false,
};

/** Parse CLI args and merge with defaults */
export function parseConfig(args: string[]): CrawlerConfig {
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--url":
        config.baseUrl = next;
        i++;
        break;
      case "--depth":
        config.maxDepth = parseInt(next, 10);
        i++;
        break;
      case "--concurrency":
        config.concurrency = parseInt(next, 10);
        i++;
        break;
      case "--timeout":
        config.timeoutMs = parseInt(next, 10);
        i++;
        break;
      case "--max-urls":
        config.maxUrls = parseInt(next, 10);
        i++;
        break;
      case "--output":
        config.outputPath = next;
        i++;
        break;
      case "--ci":
        config.failOnBrokenLinks = true;
        break;
      case "--no-external":
        config.checkExternalLinks = false;
        break;
    }
  }

  return config;
}
