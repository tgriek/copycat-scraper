import type { PageData } from '../types/PageData.js';
import type { AssetRecord, AssetCategory } from '../types/AssetData.js';
import type { AssetManifest, SiteTreeNode } from '../types/CrawlResult.js';
import { writeJson } from '../utils/fileUtils.js';
import { urlToSlug, urlToPath } from '../utils/urlUtils.js';
import { buildPageDataPath } from '../utils/fileUtils.js';
import path from 'node:path';

export class ManifestGenerator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async generateManifest(
    targetUrl: string,
    startedAt: string,
    pages: PageData[],
    assetsByCategory: Record<AssetCategory, AssetRecord[]>,
    siteTree: SiteTreeNode,
    crawlDepth: number,
  ): Promise<AssetManifest> {
    const totalAssets = Object.values(assetsByCategory).reduce(
      (sum, records) => sum + records.length,
      0,
    );

    const manifest: AssetManifest = {
      crawlInfo: {
        targetUrl,
        startedAt,
        completedAt: new Date().toISOString(),
        totalPages: pages.length,
        totalAssets,
        crawlDepth,
      },
      pages: pages.map((p) => ({
        url: p.url,
        path: urlToPath(p.url),
        slug: urlToSlug(p.url),
        templatePattern: p.classification.templatePattern,
        dataFile: path.relative(
          this.outputDir,
          buildPageDataPath(this.outputDir, urlToSlug(p.url), urlToPath(p.url)),
        ),
      })),
      assets: {
        images: assetsByCategory.images || [],
        fonts: assetsByCategory.fonts || [],
        stylesheets: assetsByCategory.stylesheets || [],
        scripts: assetsByCategory.scripts || [],
        documents: assetsByCategory.documents || [],
        videos: assetsByCategory.videos || [],
        other: assetsByCategory.other || [],
      },
      siteTree,
      designTokens: 'design-tokens.json',
    };

    const manifestPath = path.join(this.outputDir, 'manifest.json');
    await writeJson(manifestPath, manifest);

    return manifest;
  }
}
