import type { Page } from 'playwright';
import * as cheerio from 'cheerio';
import type { PageData } from '../types/PageData.js';
import { extractMetadata } from '../extractors/MetadataExtractor.js';
import { extractHeadings } from '../extractors/HeadingExtractor.js';
import { extractContent, extractPageSections, extractSectionRects } from '../extractors/ContentExtractor.js';
import { extractLinks } from '../extractors/LinkExtractor.js';
import { extractMedia } from '../extractors/MediaExtractor.js';
import { extractFonts } from '../extractors/FontExtractor.js';
import { extractElementStyles } from '../design/DesignTokenExtractor.js';
import { extractAnimations } from '../extractors/AnimationExtractor.js';
import { detectTemplatePattern } from '../classification/TemplateDetector.js';
import { classifyPage } from '../classification/ContentClassifier.js';
import { captureScreenshots } from '../design/ScreenshotCapture.js';
import { urlToSlug, urlToPath } from '../utils/urlUtils.js';
import type { FontInfo, InterceptedAsset } from '../types/AssetData.js';
import type { CrawlConfig } from '../types/CrawlResult.js';
import type winston from 'winston';

export interface ProcessedPage {
  pageData: PageData;
  fonts: FontInfo[];
  interceptedAssets: InterceptedAsset[];
}

export class PageProcessor {
  private config: CrawlConfig;
  private logger: winston.Logger;

  constructor(config: CrawlConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
  }

  async processPage(
    page: Page,
    url: string,
    interceptedUrls: string[],
  ): Promise<ProcessedPage> {
    this.logger.debug(`Processing page: ${url}`);

    // Get rendered HTML from the page
    const rawHtml = await page.content();
    const $ = cheerio.load(rawHtml);

    // Extract metadata
    const metadata = extractMetadata($, url);

    // Extract content (chrome-stripped)
    const contentResult = extractContent($);

    // Extract page sections for structural analysis
    const sections = extractPageSections($);

    // Extract bounding rects for sections from the live page
    try {
      const sectionRects = await extractSectionRects(page);
      for (const sr of sectionRects) {
        if (sr.order < sections.length) {
          sections[sr.order].rect = sr.rect;
        }
      }
    } catch (err) {
      this.logger.debug(`Section rect extraction failed for ${url}: ${err}`);
    }

    // Extract headings
    const headings = extractHeadings($);

    // Extract links
    const links = extractLinks($, url);

    // Extract media
    const media = extractMedia($, url);

    // Extract per-element computed styles
    const elementStyles = await extractElementStyles(page);

    // Extract animations (CSS animations, transitions, slideshows, autoplay videos)
    let animations: Awaited<ReturnType<typeof extractAnimations>> = [];
    try {
      animations = await extractAnimations(page);
    } catch (err) {
      this.logger.debug(`Animation extraction failed for ${url}: ${err}`);
    }

    // Extract fonts
    const fonts = await extractFonts($, page, url, interceptedUrls);

    // Detect template pattern
    const templatePattern = detectTemplatePattern(url, $);

    // Classify page
    const classification = classifyPage(url, templatePattern);

    // Capture screenshots
    let screenshots = { desktop: '' };
    if (this.config.screenshots) {
      try {
        screenshots = await captureScreenshots(
          page,
          urlToSlug(url),
          this.config.outputDir,
          this.config.viewports,
        );
      } catch (err) {
        this.logger.debug(`Screenshot capture failed for ${url}: ${err}`);
      }
    }

    const pageData: PageData = {
      url,
      path: urlToPath(url),
      slug: urlToSlug(url),
      crawledAt: new Date().toISOString(),
      metadata,
      content: {
        rawHtml: contentResult.rawHtml,
        fullPageHtml: contentResult.fullPageHtml,
        markdown: contentResult.markdown,
        wordCount: contentResult.wordCount,
      },
      headings,
      sections,
      classification,
      links,
      media,
      screenshots,
      animations: animations.length > 0 ? animations : undefined,
      elementStyles,
    };

    return {
      pageData,
      fonts,
      interceptedAssets: [], // Will be populated from AssetInterceptor
    };
  }
}
