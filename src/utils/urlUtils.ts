import slugifyModule from 'slugify';

// slugify has inconsistent ESM export
const slugify = (slugifyModule as any).default || slugifyModule;
import path from 'node:path';
import { ASSET_EXTENSIONS } from '../config.js';

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash (except for root)
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    // Remove fragment
    parsed.hash = '';
    // Sort search params for consistency
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return url;
  }
}

export function urlToSlug(url: string): string {
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname;

    if (pathname === '/' || pathname === '') {
      return 'index';
    }

    // Remove leading/trailing slashes
    pathname = pathname.replace(/^\/|\/$/g, '');

    // Replace slashes with hyphens for flat slug, or keep structure
    return slugify(pathname.replace(/\//g, '-'), {
      lower: true,
      strict: true,
      replacement: '-',
    }) || 'page';
  } catch {
    return 'unknown';
  }
}

export function urlToPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    return '/';
  }
}

export function urlToPathSegments(url: string): string[] {
  const pathname = urlToPath(url);
  return pathname.split('/').filter(Boolean);
}

export function getUrlDepth(url: string): number {
  return urlToPathSegments(url).length;
}

export function isAssetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).toLowerCase();
    return ext in ASSET_EXTENSIONS;
  } catch {
    return false;
  }
}

export function getAssetCategory(url: string): string {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).toLowerCase();
    return ASSET_EXTENSIONS[ext] || 'other';
  } catch {
    return 'other';
  }
}

export function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const parsedBase = new URL(baseUrl);
    return parsedUrl.hostname === parsedBase.hostname;
  } catch {
    return false;
  }
}

export function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

export function getFileExtension(url: string): string {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).toLowerCase();
    return ext || '';
  } catch {
    return '';
  }
}

export function slugToOutputPath(slug: string, outputDir: string): string {
  // Convert slug back to directory structure for output
  // e.g., "blog-first-post" -> "blog/first-post"
  return path.join(outputDir, 'pages', `${slug}.json`);
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

export function isFontUrl(url: string): boolean {
  return /\.(woff2?|ttf|eot|otf)(\?|$)/i.test(url);
}

export function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?)(\?|$)/i.test(url);
}

export function isCssUrl(url: string): boolean {
  return /\.css(\?|$)/i.test(url);
}

export function isJsUrl(url: string): boolean {
  return /\.(m?js)(\?|$)/i.test(url);
}

export function isDocumentUrl(url: string): boolean {
  return /\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(url);
}
