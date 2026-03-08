// Programmatic API
export { CrawlEngine } from './crawler/CrawlEngine.js';
export { PageProcessor } from './crawler/PageProcessor.js';
export type { ProcessedPage } from './crawler/PageProcessor.js';
export { SitemapParser } from './crawler/SitemapParser.js';
export { AssetInterceptor } from './crawler/AssetInterceptor.js';

// Classification
export { detectTemplatePattern, estimatePageType } from './classification/TemplateDetector.js';
export { classifyPage } from './classification/ContentClassifier.js';
export type { ClassificationResult } from './classification/ContentClassifier.js';

// Extractors
export { extractMetadata } from './extractors/MetadataExtractor.js';
export { extractContent, extractPageSections } from './extractors/ContentExtractor.js';
export { extractHeadings } from './extractors/HeadingExtractor.js';
export { extractLinks } from './extractors/LinkExtractor.js';
export { extractMedia } from './extractors/MediaExtractor.js';
export { extractFonts } from './extractors/FontExtractor.js';
export { extractAnimations } from './extractors/AnimationExtractor.js';
export { extractDocuments } from './extractors/DocumentExtractor.js';

// Design
export { extractDesignTokens, extractElementStyles } from './design/DesignTokenExtractor.js';
export type { ElementComputedStyles } from './design/DesignTokenExtractor.js';
export { captureScreenshots } from './design/ScreenshotCapture.js';

// Downloaders
export { AssetDownloader } from './downloaders/AssetDownloader.js';
export { FontDownloader } from './downloaders/FontDownloader.js';

// Output
export { OutputWriter } from './output/OutputWriter.js';
export { ManifestGenerator } from './output/ManifestGenerator.js';
export { SiteMapGenerator } from './output/SiteMapGenerator.js';

// Types
export type { PageData, PageSection, HeadingNode, PageLink, PageImage, PageVideo, PageDocument, AnimationInfo } from './types/PageData.js';
export type { PageMetadata } from './extractors/MetadataExtractor.js';
export type { CrawlConfig, SiteTreeNode, AssetManifest } from './types/CrawlResult.js';
export type { AssetRecord, InterceptedAsset, FontInfo, AssetCategory } from './types/AssetData.js';
export type { DesignTokens } from './types/DesignTokens.js';

// Config
export { DEFAULT_CONFIG, VIEWPORT_SIZES, CHROME_SELECTORS, MAIN_CONTENT_SELECTORS, ASSET_EXTENSIONS, RESOURCE_TYPE_MAP } from './config.js';

// Utils
export { createLogger } from './utils/logger.js';
export { normalizeUrl, urlToSlug, urlToPath, resolveUrl, isAssetUrl, isDocumentUrl } from './utils/urlUtils.js';
export { readJson, writeJson, ensureDir, fileExists } from './utils/fileUtils.js';
export { sha256, md5, shortHash } from './utils/hashUtils.js';
