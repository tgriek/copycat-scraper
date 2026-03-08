import type { CheerioAPI } from 'cheerio';
import type { PageFavicon, TwitterCard } from '../types/PageData.js';

export interface PageMetadata {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  ogSiteName?: string;
  canonical?: string;
  language?: string;
  author?: string;
  publishDate?: string;
  modifiedDate?: string;
  keywords?: string[];
  robots?: string;
  viewport?: string;
  themeColor?: string;
  twitter?: TwitterCard;
  structuredData?: Record<string, unknown>[];
  favicons?: PageFavicon[];
}

export function extractMetadata($: CheerioAPI, url: string): PageMetadata {
  const title =
    $('title').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text().trim() ||
    '';

  const description =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    '';

  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDescription = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const ogType = $('meta[property="og:type"]').attr('content');
  const ogSiteName = $('meta[property="og:site_name"]').attr('content');

  const canonical =
    $('link[rel="canonical"]').attr('href') ||
    $('meta[property="og:url"]').attr('content');

  const language =
    $('html').attr('lang') ||
    $('meta[http-equiv="content-language"]').attr('content');

  const author =
    $('meta[name="author"]').attr('content') ||
    $('[rel="author"]').first().text().trim() ||
    $('[class*="author"]').first().text().trim();

  const publishDate =
    $('meta[property="article:published_time"]').attr('content') ||
    $('time[datetime]').first().attr('datetime') ||
    $('meta[name="date"]').attr('content');

  const modifiedDate =
    $('meta[property="article:modified_time"]').attr('content') ||
    $('meta[name="last-modified"]').attr('content');

  const keywordsStr = $('meta[name="keywords"]').attr('content');
  const keywords = keywordsStr
    ? keywordsStr.split(',').map((k) => k.trim()).filter(Boolean)
    : undefined;

  const robots = $('meta[name="robots"]').attr('content');
  const viewport = $('meta[name="viewport"]').attr('content');
  const themeColor = $('meta[name="theme-color"]').attr('content');

  // Twitter Card metadata
  const twitter = extractTwitterCard($);

  // JSON-LD structured data
  const structuredData = extractStructuredData($);

  // Favicons
  const favicons = extractFavicons($, url);

  return {
    title,
    description,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    ogSiteName,
    canonical,
    language,
    author: author || undefined,
    publishDate,
    modifiedDate,
    keywords,
    robots,
    viewport,
    themeColor,
    twitter: twitter || undefined,
    structuredData: structuredData.length > 0 ? structuredData : undefined,
    favicons: favicons.length > 0 ? favicons : undefined,
  };
}

function extractTwitterCard($: CheerioAPI): TwitterCard | null {
  const card = $('meta[name="twitter:card"]').attr('content');
  const site = $('meta[name="twitter:site"]').attr('content');
  const creator = $('meta[name="twitter:creator"]').attr('content');
  const title = $('meta[name="twitter:title"]').attr('content');
  const description = $('meta[name="twitter:description"]').attr('content');
  const image = $('meta[name="twitter:image"]').attr('content');

  if (!card && !site && !title && !image) return null;

  return { card, site, creator, title, description, image };
}

function extractStructuredData($: CheerioAPI): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text().trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          results.push(...parsed);
        } else {
          results.push(parsed);
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  return results;
}

function extractFavicons($: CheerioAPI, pageUrl: string): PageFavicon[] {
  const favicons: PageFavicon[] = [];
  const seen = new Set<string>();

  const faviconSelectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomputed"]',
    'link[rel="mask-icon"]',
    'link[rel="manifest"]',
  ];

  for (const selector of faviconSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      const resolvedHref = resolveUrl(href, pageUrl);
      if (seen.has(resolvedHref)) return;
      seen.add(resolvedHref);

      favicons.push({
        href: resolvedHref,
        rel: $el.attr('rel') || '',
        type: $el.attr('type') || undefined,
        sizes: $el.attr('sizes') || undefined,
        localPath: '',
      });
    });
  }

  // Always check for /favicon.ico as fallback
  try {
    const faviconIco = new URL('/favicon.ico', pageUrl).href;
    if (!seen.has(faviconIco)) {
      favicons.push({
        href: faviconIco,
        rel: 'icon',
        localPath: '',
      });
    }
  } catch { /* invalid URL */ }

  return favicons;
}

function resolveUrl(href: string, pageUrl: string): string {
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return href;
  }
}
