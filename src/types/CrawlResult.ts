import { AssetRecord } from './AssetData.js';

export interface SiteTreeNode {
  path: string;
  url: string;
  title: string;
  children: SiteTreeNode[];
  templatePattern?: string;
  pageDataFile?: string;
}

export interface AssetManifest {
  crawlInfo: {
    targetUrl: string;
    startedAt: string;
    completedAt: string;
    totalPages: number;
    totalAssets: number;
    crawlDepth: number;
  };

  pages: {
    url: string;
    path: string;
    slug: string;
    templatePattern: string;
    dataFile: string;
  }[];

  assets: {
    images: AssetRecord[];
    fonts: AssetRecord[];
    stylesheets: AssetRecord[];
    scripts: AssetRecord[];
    documents: AssetRecord[];
    videos: AssetRecord[];
    other: AssetRecord[];
  };

  siteTree: SiteTreeNode;
  designTokens: string;
}

export interface CrawlConfig {
  targetUrl: string;
  outputDir: string;
  maxDepth: number;
  maxConcurrency: number;
  maxPages: number;
  navigationTimeout: number;
  screenshots: boolean;
  designTokens: boolean;
  viewports: string[];
  includePatterns: string[];
  excludePatterns: string[];
  downloadAssets: boolean;
  followExternal: boolean;
  respectRobots: boolean;
  userAgent?: string;
  delay: number;
  verbose: boolean;
  headless: boolean;
  maxDocuments?: number;
  documentTypes?: string[];
}
