import type { CheerioAPI } from 'cheerio';
import { resolveUrl, isDocumentUrl, sanitizeFilename } from '../utils/urlUtils.js';

export interface ExtractedDocument {
  url: string;
  linkText: string;
  type: string;
}

export function extractDocuments($: CheerioAPI, pageUrl: string): ExtractedDocument[] {
  const documents: ExtractedDocument[] = [];
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
        url: resolvedUrl,
        linkText: $el.text().trim() || sanitizeFilename(href),
        type: ext,
      });
    }
  });

  // Also check for download links
  $('a[download]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href) return;

    const resolvedUrl = resolveUrl(href, pageUrl);
    if (!seen.has(resolvedUrl)) {
      seen.add(resolvedUrl);

      const ext = resolvedUrl.match(/\.(\w+)(\?|$)/)?.[1] || 'download';
      documents.push({
        url: resolvedUrl,
        linkText: $el.text().trim() || $el.attr('download') || 'download',
        type: ext,
      });
    }
  });

  return documents;
}
