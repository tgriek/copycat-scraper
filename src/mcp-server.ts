#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { CrawlEngine } from './crawler/CrawlEngine.js';
import { DEFAULT_CONFIG } from './config.js';
import { createLogger } from './utils/logger.js';
import type { CrawlConfig } from './types/CrawlResult.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function main() {
  // Graceful failure when @modelcontextprotocol/sdk is not installed
  let McpServer: any;
  let StdioServerTransport: any;
  try {
    const mcpModule = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const stdioModule = await import('@modelcontextprotocol/sdk/server/stdio.js');
    McpServer = mcpModule.McpServer;
    StdioServerTransport = stdioModule.StdioServerTransport;
  } catch {
    console.error(
      'MCP server requires @modelcontextprotocol/sdk. Install it with:\n' +
      '  npm install @modelcontextprotocol/sdk'
    );
    process.exit(1);
  }

  const server = new McpServer({
    name: 'copycat-scraper',
    version: '1.0.0',
  });

  /**
   * Convert focus page URLs to includePatterns + maxPages.
   */
  function applyFocusPages(
    focusPages: string[],
    config: { includePatterns: string[]; maxPages: number },
  ): void {
    const focusPaths = focusPages.map((url) => {
      try { return new URL(url).pathname; } catch { return url; }
    });
    config.includePatterns.push('/', ...focusPaths);
    config.maxPages = focusPaths.length + 1;
  }

  // --- crawl tool ---
  server.tool(
    'crawl',
    'Crawl a website and extract all content, assets, design tokens, and structural information. Returns the output directory path.',
    {
      url: z.string().url().describe('The URL of the website to crawl'),
      outputDir: z.string().optional().describe('Output directory (defaults to ./output)'),
      maxDepth: z.number().optional().describe('Maximum crawl depth (default: 10)'),
      maxPages: z.number().optional().describe('Maximum pages to crawl (default: 1000)'),
      maxConcurrency: z.number().optional().describe('Max concurrent pages (default: 5)'),
      includePatterns: z.array(z.string()).optional().describe('URL patterns to include (glob)'),
      excludePatterns: z.array(z.string()).optional().describe('URL patterns to exclude (glob)'),
      focusPages: z.array(z.string()).optional().describe('Focus on specific URLs only. Overrides maxPages and sets includePatterns automatically.'),
      screenshots: z.boolean().optional().describe('Capture screenshots (default: true)'),
      designTokens: z.boolean().optional().describe('Extract design tokens (default: true)'),
      downloadAssets: z.boolean().optional().describe('Download assets (default: true)'),
    },
    async (params: any) => {
      const logger = createLogger(false);

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(params.url);
      } catch {
        return { content: [{ type: 'text' as const, text: `Invalid URL: ${params.url}` }], isError: true };
      }

      const baseOutput = params.outputDir || path.join(PROJECT_ROOT, 'output');
      const siteOutputDir = path.join(baseOutput, parsedUrl.hostname);

      const config: CrawlConfig = {
        ...DEFAULT_CONFIG,
        targetUrl: params.url,
        outputDir: siteOutputDir,
        maxDepth: params.maxDepth ?? DEFAULT_CONFIG.maxDepth,
        maxPages: params.maxPages ?? DEFAULT_CONFIG.maxPages,
        maxConcurrency: params.maxConcurrency ?? DEFAULT_CONFIG.maxConcurrency,
        includePatterns: params.includePatterns ?? [],
        excludePatterns: params.excludePatterns ?? [],
        screenshots: params.screenshots ?? true,
        designTokens: params.designTokens ?? true,
        downloadAssets: params.downloadAssets ?? true,
      };

      if (params.focusPages?.length) {
        applyFocusPages(params.focusPages, config);
      }

      const engine = new CrawlEngine(config, logger);

      try {
        await engine.crawl();
        return {
          content: [{
            type: 'text' as const,
            text: `Crawl completed successfully!\nOutput directory: ${siteOutputDir}\nTarget: ${params.url}`,
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Crawl failed: ${err}` }], isError: true };
      }
    },
  );

  // --- list_crawls tool ---
  server.tool(
    'list_crawls',
    'List all previously crawled sites in the output directory.',
    {
      outputDir: z.string().optional().describe('Output directory to scan (default: ./output)'),
    },
    async (params: any) => {
      const outputDir = params.outputDir
        ? (path.isAbsolute(params.outputDir) ? params.outputDir : path.join(PROJECT_ROOT, params.outputDir))
        : path.join(PROJECT_ROOT, 'output');

      try {
        const entries = await fs.readdir(outputDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

        if (dirs.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No crawled sites found.' }] };
        }

        const lines = ['Previously crawled sites:', ...dirs.map((d) => `  - ${d} (${path.join(outputDir, d)})`)];
        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch {
        return { content: [{ type: 'text' as const, text: `Output directory not found: ${outputDir}` }] };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
