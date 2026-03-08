import type { CheerioAPI } from 'cheerio';
import { urlToPath, urlToPathSegments, getUrlDepth } from '../utils/urlUtils.js';

export interface ClassificationResult {
  templatePattern: string;
  urlDepth: number;
  pathSegments: string[];
  estimatedType: string;
}

export function classifyPage(
  url: string,
  templatePattern: string,
): ClassificationResult {
  return {
    templatePattern,
    urlDepth: getUrlDepth(url),
    pathSegments: urlToPathSegments(url),
    estimatedType: estimateType(templatePattern),
  };
}

function estimateType(pattern: string): string {
  const typeMap: Record<string, string> = {
    'homepage': 'marketing-landing',
    'blog-listing': 'content-listing',
    'blog-post': 'content-article',
    'product-listing': 'commerce-listing',
    'product-detail': 'commerce-detail',
    'about': 'informational',
    'contact': 'conversion',
    'faq': 'support',
    'documentation': 'technical',
    'pricing': 'conversion',
    'legal': 'compliance',
    'careers': 'recruitment',
    'case-study': 'marketing',
    'services': 'marketing',
    'features': 'marketing',
    'listing-page': 'content-listing',
    'generic-page': 'informational',
  };

  return typeMap[pattern] || 'informational';
}
