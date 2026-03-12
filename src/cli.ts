#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs/promises';
import { Command } from 'commander';
import { CrawlEngine } from './crawler/CrawlEngine.js';
import { DEFAULT_CONFIG } from './config.js';
import { createLogger } from './utils/logger.js';
import type { CrawlConfig } from './types/CrawlResult.js';

const program = new Command();

program
  .name('copycat-scraper')
  .description('Website scraper that extracts content, assets, design tokens, and structure from any site')
  .version('1.0.0');

// --- crawl subcommand ---
program
  .command('crawl')
  .description('Crawl a website and extract all content, assets, and structure')
  .argument('<url>', 'The URL of the website to crawl')
  .option('-o, --output <dir>', 'Output directory', DEFAULT_CONFIG.outputDir)
  .option('-d, --depth <number>', 'Maximum crawl depth', String(DEFAULT_CONFIG.maxDepth))
  .option('-c, --concurrency <number>', 'Max concurrent pages', String(DEFAULT_CONFIG.maxConcurrency))
  .option('--max-pages <number>', 'Maximum pages to crawl', String(DEFAULT_CONFIG.maxPages))
  .option('--timeout <number>', 'Navigation timeout in ms', String(DEFAULT_CONFIG.navigationTimeout))
  .option('--no-screenshots', 'Disable page screenshots')
  .option('--no-design-tokens', 'Disable design token extraction')
  .option('--viewports <viewports>', 'Screenshot viewports (comma-separated)', DEFAULT_CONFIG.viewports.join(','))
  .option('--include <patterns>', 'URL patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'URL patterns to exclude (comma-separated)')
  .option('--no-download-assets', 'Disable asset downloading')
  .option('--follow-external', 'Follow external links', DEFAULT_CONFIG.followExternal)
  .option('--no-respect-robots', 'Ignore robots.txt')
  .option('--user-agent <ua>', 'Custom user agent string')
  .option('--delay <ms>', 'Delay between requests in ms', String(DEFAULT_CONFIG.delay))
  .option('-v, --verbose', 'Verbose logging', DEFAULT_CONFIG.verbose)
  .option('--max-documents <number>', 'Maximum number of documents to download')
  .option('--document-types <types>', 'Document types to download (comma-separated, e.g. pdf,docx)')
  .option('--no-headless', 'Run browser in headed mode')
  .action(async (url: string, options: Record<string, any>) => {
    const logger = createLogger(options.verbose || false);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      logger.error(`Invalid URL: ${url}`);
      process.exit(1);
    }

    const siteOutputDir = path.join(options.output, parsedUrl.hostname);

    const config: CrawlConfig = {
      targetUrl: url,
      outputDir: siteOutputDir,
      maxDepth: parseInt(options.depth, 10),
      maxConcurrency: parseInt(options.concurrency, 10),
      maxPages: parseInt(options.maxPages, 10),
      navigationTimeout: parseInt(options.timeout, 10),
      screenshots: options.screenshots !== false,
      designTokens: options.designTokens !== false,
      viewports: options.viewports.split(',').map((v: string) => v.trim()),
      includePatterns: options.include ? options.include.split(',').map((p: string) => p.trim()) : [],
      excludePatterns: options.exclude ? options.exclude.split(',').map((p: string) => p.trim()) : [],
      downloadAssets: options.downloadAssets !== false,
      followExternal: options.followExternal || false,
      respectRobots: options.respectRobots !== false,
      userAgent: options.userAgent,
      delay: parseInt(options.delay, 10),
      verbose: options.verbose || false,
      headless: options.headless !== false,
      maxDocuments: options.maxDocuments ? parseInt(options.maxDocuments, 10) : undefined,
      documentTypes: options.documentTypes ? options.documentTypes.split(',').map((t: string) => t.trim()) : undefined,
    };

    logger.info('copycat-scraper v1.0.0');
    logger.info(`Target: ${config.targetUrl}`);
    logger.info(`Output: ${config.outputDir}`);
    logger.info(`Max pages: ${config.maxPages}`);
    logger.info(`Concurrency: ${config.maxConcurrency}`);

    if (config.screenshots) {
      logger.info(`Screenshots: ${config.viewports.join(', ')}`);
    }

    const engine = new CrawlEngine(config, logger);

    try {
      await engine.crawl();
      logger.info('Crawl completed successfully!');
    } catch (err) {
      logger.error(`Crawl failed: ${err}`);
      process.exit(1);
    }
  });

// --- list subcommand ---
program
  .command('list')
  .description('List previously crawled sites')
  .argument('[dir]', 'Output directory to scan', './output')
  .action(async (dir: string) => {
    const outputDir = path.resolve(dir);

    try {
      const entries = await fs.readdir(outputDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      if (dirs.length === 0) {
        console.log('No crawled sites found.');
        return;
      }

      console.log('Previously crawled sites:');
      for (const d of dirs) {
        console.log(`  - ${d} (${path.join(outputDir, d)})`);
      }
    } catch {
      console.log(`Output directory not found: ${outputDir}`);
    }
  });

program.parse();
