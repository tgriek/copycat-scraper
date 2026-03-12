import { CrawlConfig } from './types/CrawlResult.js';

export const DEFAULT_CONFIG: CrawlConfig = {
  targetUrl: '',
  outputDir: './output',
  maxDepth: 10,
  maxConcurrency: 5,
  maxPages: 1000,
  navigationTimeout: 30000,
  screenshots: true,
  designTokens: true,
  viewports: ['desktop', 'tablet', 'mobile'],
  includePatterns: [],
  excludePatterns: [],
  downloadAssets: true,
  followExternal: false,
  respectRobots: true,
  delay: 0,
  verbose: false,
  headless: true,
  maxDocuments: undefined,
  documentTypes: undefined,
};

export const VIEWPORT_SIZES: Record<string, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

export const CHROME_SELECTORS = [
  'nav',
  'header',
  'footer',
  '.cookie-banner',
  '.cookie-consent',
  '.popup',
  '.modal',
  '.overlay',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '.navbar',
  '.nav',
  '.menu',
  '.site-header',
  '.site-footer',
  '.breadcrumb',
  '.breadcrumbs',
  '.social-share',
  '.share-buttons',
  '.comments',
  '.comment-section',
  '#cookie-notice',
  '#gdpr',
  '.gdpr',
];

export const MAIN_CONTENT_SELECTORS = [
  'main',
  'article',
  '[role="main"]',
  '.content',
  '.post-body',
  '.article-content',
  '.page-content',
  '.entry-content',
  '#content',
  '#main-content',
  '.main-content',
];

export const ASSET_EXTENSIONS: Record<string, string> = {
  // Images
  '.jpg': 'images',
  '.jpeg': 'images',
  '.png': 'images',
  '.gif': 'images',
  '.webp': 'images',
  '.avif': 'images',
  '.svg': 'images',
  '.ico': 'images',
  '.bmp': 'images',
  '.tiff': 'images',
  // Fonts
  '.woff': 'fonts',
  '.woff2': 'fonts',
  '.ttf': 'fonts',
  '.eot': 'fonts',
  '.otf': 'fonts',
  // Stylesheets
  '.css': 'stylesheets',
  // Scripts
  '.js': 'scripts',
  '.mjs': 'scripts',
  // Documents
  '.pdf': 'documents',
  '.doc': 'documents',
  '.docx': 'documents',
  '.xls': 'documents',
  '.xlsx': 'documents',
  '.ppt': 'documents',
  '.pptx': 'documents',
  // Videos
  '.mp4': 'videos',
  '.webm': 'videos',
  '.ogg': 'videos',
  '.avi': 'videos',
  '.mov': 'videos',
  // Audio
  '.mp3': 'videos',
  '.wav': 'videos',
  '.flac': 'videos',
};

export const RESOURCE_TYPE_MAP: Record<string, string> = {
  image: 'images',
  font: 'fonts',
  stylesheet: 'stylesheets',
  script: 'scripts',
  media: 'videos',
  document: 'documents',
};
