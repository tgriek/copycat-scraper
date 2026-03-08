import type { CheerioAPI } from 'cheerio';
import type { PageImage, PageVideo, PageDocument } from '../types/PageData.js';
import { resolveUrl, isDocumentUrl, sanitizeFilename } from '../utils/urlUtils.js';

export interface ExtractedMedia {
  images: PageImage[];
  videos: PageVideo[];
  documents: PageDocument[];
}

export function extractMedia($: CheerioAPI, pageUrl: string): ExtractedMedia {
  const images = extractImages($, pageUrl);
  const videos = extractVideos($, pageUrl);
  const documents = extractDocuments($, pageUrl);

  return { images, videos, documents };
}

function extractImages($: CheerioAPI, pageUrl: string): PageImage[] {
  const images: PageImage[] = [];
  const seen = new Set<string>();

  // Standard img tags
  $('img[src]').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src');
    if (!src) return;

    const resolvedSrc = resolveUrl(src, pageUrl);
    if (seen.has(resolvedSrc)) return;
    seen.add(resolvedSrc);

    images.push({
      src: resolvedSrc,
      alt: $el.attr('alt'),
      width: parseIntOrUndef($el.attr('width')),
      height: parseIntOrUndef($el.attr('height')),
      srcset: $el.attr('srcset'),
      localPath: '', // Filled in by downloader
    });
  });

  // Lazy-loaded images (data-src, data-lazy-src)
  $('img[data-src], img[data-lazy-src], img[data-original]').each((_, el) => {
    const $el = $(el);
    const src =
      $el.attr('data-src') ||
      $el.attr('data-lazy-src') ||
      $el.attr('data-original');
    if (!src) return;

    const resolvedSrc = resolveUrl(src, pageUrl);
    if (seen.has(resolvedSrc)) return;
    seen.add(resolvedSrc);

    images.push({
      src: resolvedSrc,
      alt: $el.attr('alt'),
      localPath: '',
    });
  });

  // Picture source elements
  $('picture source[srcset]').each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr('srcset');
    if (!srcset) return;

    // Parse srcset and extract URLs
    const urls = parseSrcset(srcset);
    for (const url of urls) {
      const resolvedSrc = resolveUrl(url, pageUrl);
      if (seen.has(resolvedSrc)) continue;
      seen.add(resolvedSrc);

      images.push({
        src: resolvedSrc,
        localPath: '',
      });
    }
  });

  // CSS background images from inline styles
  $('[style*="background"]').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style') || '';
    const urlMatch = style.match(/url\(['"]?([^'"()]+)['"]?\)/);
    if (urlMatch && urlMatch[1]) {
      const resolvedSrc = resolveUrl(urlMatch[1], pageUrl);
      if (!seen.has(resolvedSrc)) {
        seen.add(resolvedSrc);
        images.push({
          src: resolvedSrc,
          localPath: '',
        });
      }
    }
  });

  return images;
}

function extractVideos($: CheerioAPI, pageUrl: string): PageVideo[] {
  const videos: PageVideo[] = [];
  const seen = new Set<string>();

  // Video tags
  $('video source[src], video[src]').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src');
    if (!src) return;

    const resolvedSrc = resolveUrl(src, pageUrl);
    if (seen.has(resolvedSrc)) return;
    seen.add(resolvedSrc);

    // Check parent video element for autoplay/loop/muted
    const $video = $el.is('video') ? $el : $el.closest('video');
    const autoplay = $video.length > 0 && ($video.attr('autoplay') !== undefined);
    const loop = $video.length > 0 && ($video.attr('loop') !== undefined);
    const muted = $video.length > 0 && ($video.attr('muted') !== undefined);

    videos.push({
      src: resolvedSrc,
      type: $el.attr('type'),
      localPath: '',
      autoplay: autoplay || undefined,
      loop: loop || undefined,
      muted: muted || undefined,
    });
  });

  // iframes (YouTube, Vimeo, etc.)
  $('iframe[src]').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') || '';
    if (src.includes('youtube') || src.includes('vimeo') || src.includes('player')) {
      const resolvedSrc = resolveUrl(src, pageUrl);
      if (!seen.has(resolvedSrc)) {
        seen.add(resolvedSrc);
        videos.push({
          src: resolvedSrc,
          type: 'embed',
          localPath: '',
        });
      }
    }
  });

  return videos;
}

function extractDocuments($: CheerioAPI, pageUrl: string): PageDocument[] {
  const documents: PageDocument[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href) return;

    const resolvedUrl = resolveUrl(href, pageUrl);
    if (isDocumentUrl(resolvedUrl) && !seen.has(resolvedUrl)) {
      seen.add(resolvedUrl);

      const ext = resolvedUrl.match(/\.(\w+)(\?|$)/)?.[1] || 'unknown';
      documents.push({
        src: resolvedUrl,
        type: ext,
        linkText: $el.text().trim() || sanitizeFilename(href),
        localPath: '',
      });
    }
  });

  return documents;
}

function parseSrcset(srcset: string): string[] {
  return srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function parseIntOrUndef(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}
