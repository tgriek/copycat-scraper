import type { CheerioAPI } from 'cheerio';
import type { HeadingNode } from '../types/PageData.js';

interface FlatHeading {
  level: number;
  text: string;
  id?: string;
}

export function extractHeadings($: CheerioAPI, contentHtml?: string): HeadingNode[] {
  const flatHeadings: FlatHeading[] = [];

  const selector = 'h1, h2, h3, h4, h5, h6';
  const elements = contentHtml ? $(selector, contentHtml) : $(selector);

  elements.each((_, el) => {
    const $el = $(el);
    const tagName = el.type === 'tag' ? el.tagName.toLowerCase() : '';
    const level = parseInt(tagName.replace('h', ''), 10);

    if (level >= 1 && level <= 6) {
      flatHeadings.push({
        level,
        text: $el.text().trim(),
        id: $el.attr('id') || undefined,
      });
    }
  });

  return buildHeadingTree(flatHeadings);
}

function buildHeadingTree(headings: FlatHeading[]): HeadingNode[] {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const heading of headings) {
    const node: HeadingNode = {
      level: heading.level,
      text: heading.text,
      id: heading.id,
      children: [],
    };

    // Find parent: walk back up the stack to find a heading with a lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}
