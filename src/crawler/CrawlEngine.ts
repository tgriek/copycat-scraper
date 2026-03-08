import { PlaywrightCrawler, Configuration, MemoryStorage } from 'crawlee';
import type { PlaywrightCrawlingContext } from 'crawlee';
import type { CrawlConfig } from '../types/CrawlResult.js';
import type { PageData } from '../types/PageData.js';
import type { FontInfo, InterceptedAsset } from '../types/AssetData.js';
import type { DesignTokens } from '../types/DesignTokens.js';
import { AssetInterceptor } from './AssetInterceptor.js';
import { PageProcessor } from './PageProcessor.js';
import { SitemapParser } from './SitemapParser.js';
import { AssetDownloader } from '../downloaders/AssetDownloader.js';
import { FontDownloader } from '../downloaders/FontDownloader.js';
import { OutputWriter } from '../output/OutputWriter.js';
import { ManifestGenerator } from '../output/ManifestGenerator.js';
import { SiteMapGenerator } from '../output/SiteMapGenerator.js';
import { extractDesignTokens } from '../design/DesignTokenExtractor.js';
import { writeJson } from '../utils/fileUtils.js';
import { isAssetUrl, normalizeUrl } from '../utils/urlUtils.js';
import path from 'node:path';
import type winston from 'winston';

/** File extensions that should never be crawled as pages */
const NON_PAGE_EXTENSIONS = new Set(['.xml', '.pdf', '.json', '.txt', '.rss', '.atom']);

export class CrawlEngine {
  private config: CrawlConfig;
  private logger: winston.Logger;
  private pages: PageData[] = [];
  private allFonts: FontInfo[] = [];
  private allInterceptedAssets: InterceptedAsset[] = [];
  private designTokens: DesignTokens | null = null;
  private designTokenPages: Set<string> = new Set(); // Track which template patterns we've extracted tokens from
  private startedAt: string = '';
  private pageCount: number = 0;

  constructor(config: CrawlConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
  }

  async crawl(): Promise<void> {
    this.startedAt = new Date().toISOString();
    this.logger.info(`Starting crawl of ${this.config.targetUrl}`);

    // Initialize output
    const outputWriter = new OutputWriter(this.config.outputDir, this.logger);
    await outputWriter.initialize();

    // Parse sitemap for seed URLs
    const sitemapParser = new SitemapParser(this.logger);
    let seedUrls: string[] = [];

    if (this.config.respectRobots) {
      const robots = await sitemapParser.parseRobotsTxt(this.config.targetUrl);
      // TODO: Could filter disallowed paths
      if (robots.sitemapUrls.length > 0) {
        this.logger.info(`Found ${robots.sitemapUrls.length} sitemap URLs in robots.txt`);
      }
    }

    const sitemapUrls = await sitemapParser.parseSitemap(this.config.targetUrl);
    seedUrls = sitemapUrls.map((s) => s.loc);

    const pageProcessor = new PageProcessor(this.config, this.logger);

    // Use a fresh MemoryStorage per crawl so the in-memory request queue is clean on re-runs
    const freshStorage = new MemoryStorage();
    Configuration.getGlobalConfig().useStorageClient(freshStorage);

    const crawler = new PlaywrightCrawler({
      launchContext: {
        launchOptions: {
          headless: this.config.headless,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
        },
      },
      maxConcurrency: this.config.maxConcurrency,
      maxRequestsPerMinute: 60,
      navigationTimeoutSecs: this.config.navigationTimeout / 1000,
      maxRequestsPerCrawl: this.config.maxPages,
      requestHandlerTimeoutSecs: 120,

      preNavigationHooks: [
        async ({ page, request }) => {
          // Shim esbuild's __name decorator so page.evaluate callbacks work in the browser.
          // tsx/esbuild wraps function declarations and arrow-function assignments with
          // __name(fn, "name") which doesn't exist in the browser context.
          await page.addInitScript('window.__name = function(fn) { return fn; };');

          // Set up asset interception
          const interceptor = new AssetInterceptor();
          await interceptor.setup(page, request.url);

          // Store interceptor on the request for later use
          request.userData['interceptor'] = interceptor;
        },
      ],

      requestHandler: async (context: PlaywrightCrawlingContext) => {
        const { request, page, enqueueLinks, log } = context;
        const url = request.url;

        if (this.pageCount >= this.config.maxPages) {
          return;
        }

        log.info(`Processing: ${url}`);

        try {
          // Wait for page to be fully loaded
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
            // networkidle might timeout, that's okay
          });

          // Auto-scroll to trigger lazy-loaded content (waits for lazy images to load)
          await this.autoScroll(page);

          // Get intercepted URLs
          const interceptor = request.userData['interceptor'] as AssetInterceptor | undefined;
          const interceptedUrls = interceptor?.getInterceptedUrls() || [];
          const interceptedAssets = interceptor?.getInterceptedAssets() || [];

          // Process the page
          const result = await pageProcessor.processPage(page, url, interceptedUrls);

          // Collect intercepted assets
          for (const asset of interceptedAssets) {
            this.allInterceptedAssets.push(asset);
          }

          // Collect fonts
          this.allFonts.push(...result.fonts);

          // Extract design tokens from representative pages
          if (this.config.designTokens && !this.designTokenPages.has(result.pageData.classification.templatePattern)) {
            if (this.designTokenPages.size < 5) {
              try {
                this.designTokens = await extractDesignTokens(page);
                this.designTokenPages.add(result.pageData.classification.templatePattern);
              } catch (err) {
                this.logger.debug(`Design token extraction failed for ${url}: ${err}`);
              }
            }
          }

          // Save page data
          await outputWriter.writePageData(result.pageData);

          this.pages.push(result.pageData);
          this.pageCount++;

          this.logger.info(`[${this.pageCount}/${this.config.maxPages}] Processed: ${url} (${result.pageData.classification.templatePattern})`);

          // Enqueue discovered links (same domain only)
          await enqueueLinks({
            strategy: 'same-domain',
            transformRequestFunction: (req) => {
              // Skip asset URLs
              if (isAssetUrl(req.url)) return false;

              // Skip non-HTML resources (sitemaps, feeds, etc.)
              try {
                const ext = path.extname(new URL(req.url).pathname).toLowerCase();
                if (NON_PAGE_EXTENSIONS.has(ext)) return false;
              } catch { /* invalid URL — let it fail later */ }

              // Check include/exclude patterns
              if (this.config.excludePatterns.length > 0) {
                const urlPath = new URL(req.url).pathname;
                for (const pattern of this.config.excludePatterns) {
                  if (matchGlob(urlPath, pattern)) return false;
                }
              }

              if (this.config.includePatterns.length > 0) {
                const urlPath = new URL(req.url).pathname;
                let matches = false;
                for (const pattern of this.config.includePatterns) {
                  if (matchGlob(urlPath, pattern)) {
                    matches = true;
                    break;
                  }
                }
                if (!matches) return false;
              }

              return req;
            },
          });

          // Delay between requests if configured
          if (this.config.delay > 0) {
            await page.waitForTimeout(this.config.delay);
          }
        } catch (err) {
          this.logger.error(`Error processing ${url}: ${err}`);
        }
      },

      failedRequestHandler: async ({ request, log }) => {
        log.error(`Failed to process ${request.url} after retries`);
      },
    });

    // Build initial URL list
    const startUrls = [this.config.targetUrl];

    // Add sitemap URLs — but filter against includePatterns (respects focus-only scope)
    // and skip non-HTML resources (.xml, .pdf, etc.)
    const maxSeedUrls = Math.min(seedUrls.length, this.config.maxPages - 1);
    for (let i = 0; i < maxSeedUrls; i++) {
      const seedUrl = seedUrls[i];
      if (startUrls.includes(seedUrl)) continue;

      // Skip non-HTML resources
      try {
        const ext = path.extname(new URL(seedUrl).pathname).toLowerCase();
        if (NON_PAGE_EXTENSIONS.has(ext)) continue;
      } catch { continue; }

      // Apply include patterns (same logic as enqueueLinks)
      if (this.config.includePatterns.length > 0) {
        const urlPath = new URL(seedUrl).pathname;
        let matches = false;
        for (const pattern of this.config.includePatterns) {
          if (matchGlob(urlPath, pattern)) {
            matches = true;
            break;
          }
        }
        if (!matches) continue;
      }

      // Apply exclude patterns
      if (this.config.excludePatterns.length > 0) {
        const urlPath = new URL(seedUrl).pathname;
        let excluded = false;
        for (const pattern of this.config.excludePatterns) {
          if (matchGlob(urlPath, pattern)) {
            excluded = true;
            break;
          }
        }
        if (excluded) continue;
      }

      startUrls.push(seedUrl);
    }

    this.logger.info(`Starting crawl with ${startUrls.length} seed URLs`);

    // Run the crawler
    await crawler.run(startUrls);

    this.logger.info(`Crawl complete. ${this.pages.length} pages processed.`);

    // Post-crawl processing
    await this.postProcess(outputWriter);
  }

  private async postProcess(outputWriter: OutputWriter): Promise<void> {
    this.logger.info('Starting post-processing...');

    // Download assets
    if (this.config.downloadAssets) {
      // Add favicons to the asset list for download
      for (const pageData of this.pages) {
        if (pageData.metadata.favicons) {
          for (const fav of pageData.metadata.favicons) {
            this.allInterceptedAssets.push({
              url: fav.href,
              resourceType: 'image',
              pageUrl: pageData.url,
              mimeType: fav.type,
            });
          }
        }
      }

      const assetDownloader = new AssetDownloader(
        this.config.outputDir,
        this.logger,
        this.config.maxConcurrency,
      );

      await assetDownloader.downloadAll(this.allInterceptedAssets);

      // Download fonts
      const fontDownloader = new FontDownloader(this.config.outputDir, this.logger);
      await fontDownloader.downloadFonts(this.allFonts);

      // Update page data with local asset paths
      const assetRecords = assetDownloader.getAllRecords();
      for (const pageData of this.pages) {
        for (const img of pageData.media.images) {
          const record = assetRecords.get(img.src);
          if (record) {
            img.localPath = record.localPath;
          }
        }
        for (const vid of pageData.media.videos) {
          const record = assetRecords.get(vid.src);
          if (record) {
            vid.localPath = record.localPath;
          }
        }
        for (const doc of pageData.media.documents) {
          const record = assetRecords.get(doc.src);
          if (record) {
            doc.localPath = record.localPath;
          }
        }
        // Update favicon local paths
        if (pageData.metadata.favicons) {
          for (const fav of pageData.metadata.favicons) {
            const record = assetRecords.get(fav.href);
            if (record) {
              fav.localPath = record.localPath;
            }
          }
        }

        // Re-save updated page data
        await outputWriter.writePageData(pageData);
      }

      // Generate manifest
      const manifestGenerator = new ManifestGenerator(this.config.outputDir);
      const siteMapGenerator = new SiteMapGenerator(this.config.outputDir);

      const siteTree = await siteMapGenerator.generateSiteMap(this.pages);
      const assetsByCategory = assetDownloader.getRecordsByCategory();

      await manifestGenerator.generateManifest(
        this.config.targetUrl,
        this.startedAt,
        this.pages,
        assetsByCategory,
        siteTree,
        this.config.maxDepth,
      );
    }

    // Save design tokens
    if (this.config.designTokens && this.designTokens) {
      const tokensPath = path.join(this.config.outputDir, 'design-tokens.json');
      await writeJson(tokensPath, this.designTokens);
      this.logger.info('Design tokens saved');
    }

    this.logger.info('Post-processing complete.');
    this.logger.info(`Results saved to: ${this.config.outputDir}`);
    this.logger.info(`  Pages: ${this.pages.length}`);
    this.logger.info(`  Assets intercepted: ${this.allInterceptedAssets.length}`);
    this.logger.info(`  Fonts found: ${this.allFonts.length}`);
  }

  private async autoScroll(page: import('playwright').Page): Promise<void> {
    // Scroll incrementally to trigger lazy-loaded images and intersection observers
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const maxScrolls = 100;
        let scrollCount = 0;

        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrollCount++;

          if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
            clearInterval(timer);
            resolve();
          }
        }, 250);
      });
    });

    // Wait for lazy-loaded images triggered by scrolling to finish loading
    await page.waitForTimeout(3000);

    // Wait for any remaining network requests (images still loading)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Scroll back to top for screenshots
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  }
}

/**
 * Simple glob matching for include/exclude patterns
 */
function matchGlob(path: string, pattern: string): boolean {
  // Convert glob to regex
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars (except * and ?)
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regex}$`).test(path);
}
