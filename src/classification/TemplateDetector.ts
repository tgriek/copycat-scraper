import type { CheerioAPI } from 'cheerio';

export function detectTemplatePattern(url: string, $: CheerioAPI): string {
  const path = new URL(url).pathname;

  // URL-based heuristics
  if (path === '/' || path === '') return 'homepage';
  if (path.match(/^\/(blog|news|articles|posts)\/?$/)) return 'blog-listing';
  if (path.match(/^\/(blog|news|articles|posts)\/.+/)) return 'blog-post';
  if (path.match(/^\/(products?|shop|store)\/?$/)) return 'product-listing';
  if (path.match(/^\/(products?|shop|store)\/.+/)) return 'product-detail';
  if (path.match(/^\/(about|team|company)/)) return 'about';
  if (path.match(/^\/(contact|get-in-touch)/)) return 'contact';
  if (path.match(/^\/(faq|help|support)/)) return 'faq';
  if (path.match(/^\/(docs?|documentation|guide)/)) return 'documentation';
  if (path.match(/^\/(pricing|plans)/)) return 'pricing';
  if (path.match(/^\/(privacy|terms|legal|cookie)/)) return 'legal';
  if (path.match(/^\/(careers?|jobs)/)) return 'careers';
  if (path.match(/^\/(case-stud|portfolio|work)/)) return 'case-study';
  if (path.match(/^\/(services?)/)) return 'services';
  if (path.match(/^\/(features?)/)) return 'features';

  // DOM-based heuristics to supplement URL detection
  const domPattern = detectFromDom($);
  if (domPattern) return domPattern;

  return 'generic-page';
}

function detectFromDom($: CheerioAPI): string | null {
  // Blog post indicators
  const hasByline = $('[class*="author"], [class*="byline"], [rel="author"]').length > 0;
  const hasDate = $('time[datetime], [class*="publish"], [class*="date"]').length > 0;
  const hasArticle = $('article').length > 0;

  if (hasByline && hasDate && hasArticle) {
    return 'blog-post';
  }

  // Product indicators
  const hasPrice = $('[class*="price"], [data-price]').length > 0;
  const hasAddToCart = $('[class*="add-to-cart"], [class*="buy"], button:contains("Add to")').length > 0;

  if (hasPrice && hasAddToCart) {
    return 'product-detail';
  }

  // Listing indicators (many repeated card-like structures)
  const cardLike = $('[class*="card"], [class*="item"], [class*="post"]');
  if (cardLike.length >= 4) {
    return 'listing-page';
  }

  // Contact form
  const hasForm = $('form').length > 0;
  const hasContactHints = $('[class*="contact"], [id*="contact"]').length > 0;
  if (hasForm && hasContactHints) {
    return 'contact';
  }

  // FAQ
  const hasAccordion = $('[class*="accordion"], [class*="faq"], details').length > 0;
  if (hasAccordion) {
    return 'faq';
  }

  return null;
}

export function estimatePageType(templatePattern: string): string {
  const typeMap: Record<string, string> = {
    'homepage': 'marketing',
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

  return typeMap[templatePattern] || 'informational';
}
