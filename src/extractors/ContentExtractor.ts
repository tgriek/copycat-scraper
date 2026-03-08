import type { Page } from 'playwright';
import type { CheerioAPI } from 'cheerio';
import TurndownService from 'turndown';
import { CHROME_SELECTORS, MAIN_CONTENT_SELECTORS } from '../config.js';
import type { PageSection } from '../types/PageData.js';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

export interface ExtractedContent {
  rawHtml: string;
  fullPageHtml: string;
  markdown: string;
  wordCount: number;
}

export function extractContent($: CheerioAPI): ExtractedContent {
  // Capture full page HTML before any stripping
  const fullPageHtml = $('body').html() || '';

  // Clone to avoid mutating original
  const $clone = $.root().clone();

  // Remove chrome elements
  for (const selector of CHROME_SELECTORS) {
    $clone.find(selector).remove();
  }

  // Find main content area
  let $mainContent = findMainContent($, $clone);

  // If no main content found, use the cleaned body
  if (!$mainContent || $mainContent.length === 0) {
    $mainContent = $clone.find('body');
  }

  const rawHtml = $mainContent.html() || '';
  const textContent = $mainContent.text().replace(/\s+/g, ' ').trim();
  const markdown = htmlToMarkdown(rawHtml);
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;

  return {
    rawHtml,
    fullPageHtml,
    markdown,
    wordCount,
  };
}

export function extractPageSections($: CheerioAPI): PageSection[] {
  const sections: PageSection[] = [];
  let order = 0;

  // Determine the container: if body has a single wrapper div, use that; otherwise use body
  const $body = $('body');
  const $directChildren = $body.children();

  let $container: ReturnType<CheerioAPI>;
  if ($directChildren.length === 1 && $directChildren.first().is('div')) {
    $container = $directChildren.first().children();
  } else {
    $container = $directChildren;
  }

  $container.each((_, el) => {
    if (el.type !== 'tag') return;

    const $el = $(el);
    const tag = el.tagName.toLowerCase();
    const id = $el.attr('id') || '';
    const classes = $el.attr('class') || '';
    const role = $el.attr('role') || '';
    const html = $.html($el) || '';
    const fullText = $el.text().replace(/\s+/g, ' ').trim();
    const textPreview = fullText.substring(0, 200);
    const sectionType = classifySectionType(tag, id, classes, role, fullText);

    sections.push({
      tag,
      id,
      classes,
      role,
      sectionType,
      html,
      textPreview,
      order: order++,
    });
  });

  return sections;
}

export async function extractSectionRects(
  page: Page,
): Promise<Array<{ order: number; rect: { x: number; y: number; width: number; height: number } }>> {
  return page.evaluate(() => {
    const body = document.body;
    if (!body) return [];

    const directChildren = Array.from(body.children);
    let container: Element[];

    // Mirror the cheerio logic: if body has a single wrapper div, use its children
    if (directChildren.length === 1 && directChildren[0].tagName.toLowerCase() === 'div') {
      container = Array.from(directChildren[0].children);
    } else {
      container = directChildren;
    }

    const results: Array<{ order: number; rect: { x: number; y: number; width: number; height: number } }> = [];
    let order = 0;

    for (const el of container) {
      if (el.nodeType !== Node.ELEMENT_NODE) continue;
      const domRect = el.getBoundingClientRect();
      // Use absolute Y (add scrollY) so rects correspond to full-page screenshot coords
      results.push({
        order: order++,
        rect: {
          x: Math.round(domRect.x + window.scrollX),
          y: Math.round(domRect.y + window.scrollY),
          width: Math.round(domRect.width),
          height: Math.round(domRect.height),
        },
      });
    }

    return results;
  });
}

function classifySectionType(
  tag: string,
  id: string,
  classes: string,
  role: string,
  text: string,
): string {
  const lowerClasses = classes.toLowerCase();
  const lowerId = id.toLowerCase();
  const lowerText = text.toLowerCase();

  // Tag-based classification
  if (tag === 'nav') return 'navigation';
  if (tag === 'footer') return 'footer';
  if (tag === 'header') return 'navigation';
  if (tag === 'aside') return 'sidebar';

  // Role-based classification
  if (role === 'navigation') return 'navigation';
  if (role === 'banner') return 'navigation';
  if (role === 'contentinfo') return 'footer';
  if (role === 'complementary') return 'sidebar';
  if (role === 'main') return 'content';

  // Class/ID-based classification
  const combined = `${lowerClasses} ${lowerId}`;

  if (/\bnav\b|navbar|navigation|menu/.test(combined)) return 'navigation';
  if (/\bhero\b|banner|jumbotron/.test(combined)) return 'hero';
  if (/\bfeature/.test(combined)) return 'features';
  if (/testimonial|review/.test(combined)) return 'testimonials';
  if (/pricing|plans/.test(combined)) return 'pricing';
  if (/\bcta\b|call-to-action|signup|sign-up/.test(combined)) return 'cta';
  if (/\bfooter\b/.test(combined)) return 'footer';
  if (/sidebar|aside/.test(combined)) return 'sidebar';
  if (/\bcontent\b|article|post|main/.test(combined)) return 'content';

  // Content-pattern-based classification
  if (/get started|sign up|try free|subscribe|join now/i.test(lowerText.substring(0, 100))) return 'cta';
  if (/\$\d+|\bfree\b.*\bplan\b|\bmonth\b.*\bplan\b/i.test(lowerText)) return 'pricing';

  return 'unknown';
}

function findMainContent($: CheerioAPI, $context: ReturnType<CheerioAPI['root']>): ReturnType<CheerioAPI> | null {
  // Try semantic selectors first
  for (const selector of MAIN_CONTENT_SELECTORS) {
    const $el = $context.find(selector);
    if ($el.length > 0) {
      return $el.first();
    }
  }

  // Fallback: find the largest text-containing block
  let bestElement: ReturnType<CheerioAPI> | null = null;
  let bestTextLength = 0;

  $context.find('div, section').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (text.length > bestTextLength) {
      bestTextLength = text.length;
      bestElement = $el;
    }
  });

  return bestElement;
}

function htmlToMarkdown(html: string): string {
  try {
    return turndown.turndown(html);
  } catch {
    return '';
  }
}

