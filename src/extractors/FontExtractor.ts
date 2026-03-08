import type { CheerioAPI } from 'cheerio';
import type { Page } from 'playwright';
import type { FontInfo } from '../types/AssetData.js';
import { resolveUrl, isFontUrl } from '../utils/urlUtils.js';

export async function extractFonts(
  $: CheerioAPI,
  page: Page,
  pageUrl: string,
  interceptedUrls: string[],
): Promise<FontInfo[]> {
  const fonts: FontInfo[] = [];
  const seen = new Set<string>();

  // 1. Parse @font-face from stylesheets via page.evaluate
  try {
    const fontFaces = await page.evaluate(() => {
      const results: Array<{
        family: string;
        src: string;
        weight: string;
        style: string;
      }> = [];

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSFontFaceRule) {
              results.push({
                family: rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim(),
                src: rule.style.getPropertyValue('src'),
                weight: rule.style.getPropertyValue('font-weight') || '400',
                style: rule.style.getPropertyValue('font-style') || 'normal',
              });
            }
          }
        } catch {
          // CORS-blocked stylesheet
        }
      }

      return results;
    });

    for (const ff of fontFaces) {
      const urls = parseFontSrcUrls(ff.src, pageUrl);
      for (const url of urls) {
        if (!seen.has(url)) {
          seen.add(url);
          fonts.push({
            family: ff.family,
            weight: ff.weight,
            style: ff.style,
            src: url,
            format: detectFontFormat(url),
            source: 'font-face',
          });
        }
      }
    }
  } catch {
    // page.evaluate might fail
  }

  // 2. Check Google Fonts links
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      fonts.push({
        family: extractGoogleFontFamily(href),
        src: href,
        source: 'google-fonts',
      });
    }
  });

  // 3. Check Adobe Fonts / Typekit
  $('link[href*="use.typekit.net"], script[src*="use.typekit.net"]').each((_, el) => {
    const src = $(el).attr('href') || $(el).attr('src');
    if (src) {
      fonts.push({
        family: 'typekit',
        src,
        source: 'cdn',
      });
    }
  });

  // 4. Intercepted font URLs from network
  for (const url of interceptedUrls) {
    if (isFontUrl(url) && !seen.has(url)) {
      seen.add(url);
      fonts.push({
        family: guessFamily(url),
        src: url,
        format: detectFontFormat(url),
        source: 'network',
      });
    }
  }

  return deduplicateFonts(fonts);
}

function parseFontSrcUrls(srcValue: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g;
  let match;

  while ((match = urlRegex.exec(srcValue)) !== null) {
    const url = match[1];
    if (url.startsWith('data:')) continue;
    urls.push(resolveUrl(url, baseUrl));
  }

  return urls;
}

function detectFontFormat(url: string): string {
  if (url.includes('.woff2')) return 'woff2';
  if (url.includes('.woff')) return 'woff';
  if (url.includes('.ttf')) return 'truetype';
  if (url.includes('.eot')) return 'embedded-opentype';
  if (url.includes('.otf')) return 'opentype';
  return 'unknown';
}

function extractGoogleFontFamily(url: string): string {
  try {
    const parsed = new URL(url);
    const family = parsed.searchParams.get('family');
    if (family) {
      return family.split(':')[0].replace(/\+/g, ' ');
    }
  } catch { /* ignore */ }
  return 'google-font';
}

function guessFamily(url: string): string {
  // Try to extract family name from URL path
  const filename = url.split('/').pop()?.split('?')[0] || '';
  const name = filename.replace(/\.(woff2?|ttf|eot|otf)$/i, '');
  return name.replace(/[-_]/g, ' ').trim() || 'unknown';
}

function deduplicateFonts(fonts: FontInfo[]): FontInfo[] {
  const seen = new Map<string, FontInfo>();

  for (const font of fonts) {
    const key = font.src;
    if (!seen.has(key)) {
      seen.set(key, font);
    }
  }

  return Array.from(seen.values());
}
