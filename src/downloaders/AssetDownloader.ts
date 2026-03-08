import fs from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'mime-types';
import type { AssetRecord, InterceptedAsset, AssetCategory } from '../types/AssetData.js';
import { ensureDir, fileExists } from '../utils/fileUtils.js';
import { sha256 } from '../utils/hashUtils.js';
import { getAssetCategory, sanitizeFilename, getFileExtension } from '../utils/urlUtils.js';
import { RESOURCE_TYPE_MAP } from '../config.js';
import type winston from 'winston';

export class AssetDownloader {
  private outputDir: string;
  private downloaded: Map<string, AssetRecord> = new Map();
  private hashIndex: Map<string, string> = new Map(); // hash -> localPath
  private logger: winston.Logger;
  private concurrency: number;

  constructor(outputDir: string, logger: winston.Logger, concurrency: number = 5) {
    this.outputDir = outputDir;
    this.logger = logger;
    this.concurrency = concurrency;
  }

  async downloadAll(assets: InterceptedAsset[]): Promise<Map<string, AssetRecord>> {
    // Deduplicate by URL
    const uniqueAssets = new Map<string, InterceptedAsset>();
    for (const asset of assets) {
      if (!uniqueAssets.has(asset.url)) {
        uniqueAssets.set(asset.url, asset);
      }
    }

    const assetList = Array.from(uniqueAssets.values());
    this.logger.info(`Downloading ${assetList.length} unique assets...`);

    // Process in batches
    for (let i = 0; i < assetList.length; i += this.concurrency) {
      const batch = assetList.slice(i, i + this.concurrency);
      await Promise.allSettled(
        batch.map((asset) => this.downloadAsset(asset)),
      );
    }

    return this.downloaded;
  }

  async downloadAsset(asset: InterceptedAsset): Promise<AssetRecord | null> {
    // Skip already downloaded
    if (this.downloaded.has(asset.url)) {
      const existing = this.downloaded.get(asset.url)!;
      if (!existing.referencedBy.includes(asset.pageUrl)) {
        existing.referencedBy.push(asset.pageUrl);
      }
      return existing;
    }

    try {
      const response = await fetchWithRetry(asset.url);
      if (!response.ok) {
        this.logger.debug(`Failed to download: ${asset.url} (${response.status})`);
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const hash = sha256(buffer);

      // Check for duplicate content
      if (this.hashIndex.has(hash)) {
        const existingPath = this.hashIndex.get(hash)!;
        const record: AssetRecord = {
          originalUrl: asset.url,
          localPath: existingPath,
          mimeType: asset.mimeType || response.headers.get('content-type') || lookup(asset.url) || 'application/octet-stream',
          fileSize: buffer.length,
          hash,
          referencedBy: [asset.pageUrl],
        };
        this.downloaded.set(asset.url, record);
        return record;
      }

      // Determine category and local path
      const category = categorizeAsset(asset);
      const filename = generateFilename(asset.url, buffer);
      const localPath = path.join('assets', category, filename);
      const fullPath = path.join(this.outputDir, localPath);

      await ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, buffer);

      const mimeType = asset.mimeType || response.headers.get('content-type') || lookup(asset.url) || 'application/octet-stream';

      const record: AssetRecord = {
        originalUrl: asset.url,
        localPath,
        mimeType,
        fileSize: buffer.length,
        hash,
        referencedBy: [asset.pageUrl],
      };

      this.downloaded.set(asset.url, record);
      this.hashIndex.set(hash, localPath);

      return record;
    } catch (err) {
      this.logger.debug(`Error downloading ${asset.url}: ${err}`);
      return null;
    }
  }

  getRecord(url: string): AssetRecord | undefined {
    return this.downloaded.get(url);
  }

  getAllRecords(): Map<string, AssetRecord> {
    return this.downloaded;
  }

  getRecordsByCategory(): Record<AssetCategory, AssetRecord[]> {
    const result: Record<AssetCategory, AssetRecord[]> = {
      images: [],
      fonts: [],
      stylesheets: [],
      scripts: [],
      documents: [],
      videos: [],
      other: [],
    };

    for (const record of this.downloaded.values()) {
      const category = categorizeByMimeType(record.mimeType, record.originalUrl);
      result[category].push(record);
    }

    return result;
  }
}

function categorizeAsset(asset: InterceptedAsset): string {
  // Try resource type first
  if (asset.resourceType && RESOURCE_TYPE_MAP[asset.resourceType]) {
    return RESOURCE_TYPE_MAP[asset.resourceType];
  }

  // Fall back to URL-based categorization
  return getAssetCategory(asset.url) || 'other';
}

function categorizeByMimeType(mimeType: string, url: string): AssetCategory {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.includes('font') || /\.(woff2?|ttf|eot|otf)/i.test(url)) return 'fonts';
  if (mimeType.includes('css') || mimeType.includes('stylesheet')) return 'stylesheets';
  if (mimeType.includes('javascript') || mimeType.includes('ecmascript')) return 'scripts';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('spreadsheet')) return 'documents';
  if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return 'videos';
  return getAssetCategory(url) as AssetCategory || 'other';
}

function generateFilename(url: string, _buffer: Buffer): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const basename = path.basename(pathname);

    if (basename && basename.includes('.')) {
      return sanitizeFilename(basename);
    }

    // Generate name from URL path
    const ext = getFileExtension(url);
    const name = pathname.split('/').filter(Boolean).pop() || 'asset';
    return sanitizeFilename(name) + (ext || '');
  } catch {
    return `asset_${Date.now()}`;
  }
}

async function fetchWithRetry(
  url: string,
  retries: number = 3,
  delay: number = 1000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SiteCrawler/1.0)',
        },
        signal: AbortSignal.timeout(30000),
      });
      return response;
    } catch (err) {
      lastError = err as Error;
      if (i < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}
