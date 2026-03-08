import type { CheerioAPI } from 'cheerio';
import type { PageLink } from '../types/PageData.js';
import { isSameDomain, resolveUrl } from '../utils/urlUtils.js';

export interface ExtractedLinks {
  internal: PageLink[];
  external: PageLink[];
  anchors: { id: string; text: string }[];
}

export function extractLinks($: CheerioAPI, pageUrl: string): ExtractedLinks {
  const internal: PageLink[] = [];
  const external: PageLink[] = [];
  const anchors: { id: string; text: string }[] = [];

  // Extract all anchor links
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href) return;

    const text = $el.text().trim();
    const context = getContext($, $el);

    // Skip empty or javascript: links
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }

    // Anchor links
    if (href.startsWith('#')) {
      anchors.push({ id: href.slice(1), text });
      return;
    }

    const resolvedUrl = resolveUrl(href, pageUrl);

    if (isSameDomain(resolvedUrl, pageUrl)) {
      internal.push({ url: resolvedUrl, text, context });
    } else {
      external.push({ url: resolvedUrl, text, context });
    }
  });

  // Also collect elements with IDs as anchor targets
  $('[id]').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id');
    if (id) {
      const text = $el.text().trim().slice(0, 100);
      // Avoid duplicates
      if (!anchors.find((a) => a.id === id)) {
        anchors.push({ id, text });
      }
    }
  });

  return { internal, external, anchors };
}

function getContext($: CheerioAPI, $el: ReturnType<CheerioAPI>): string {
  // Get the parent element's tag to provide context
  const parent = $el.parent();
  if (parent.length > 0) {
    const parentTag = parent.prop('tagName')?.toLowerCase() || '';
    const parentClass = parent.attr('class') || '';
    if (parentClass) {
      return `${parentTag}.${parentClass.split(/\s+/)[0]}`;
    }
    return parentTag;
  }
  return '';
}
