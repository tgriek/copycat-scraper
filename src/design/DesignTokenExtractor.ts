import type { Page } from 'playwright';
import type { DesignTokens } from '../types/DesignTokens.js';

interface RawDesignData {
  colors: Record<string, { count: number; contexts: string[] }>;
  fontSizes: string[];
  fontFamilies: string[];
  fontWeights: string[];
  lineHeights: string[];
  spacingValues: string[];
  borderRadii: string[];
  borderWidths: string[];
  shadows: string[];
  transitions: string[];
  containerWidths: string[];
  typeScale: Array<{
    element: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    fontFamily: string;
    letterSpacing: string;
  }>;
}

export async function extractDesignTokens(page: Page): Promise<DesignTokens> {
  const rawData: RawDesignData = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const colors: Record<string, { count: number; contexts: string[] }> = {};
    const fontSizes = new Set<string>();
    const fontFamilies = new Set<string>();
    const fontWeights = new Set<string>();
    const lineHeights = new Set<string>();
    const spacingValues = new Set<string>();
    const borderRadii = new Set<string>();
    const borderWidths = new Set<string>();
    const shadows = new Set<string>();
    const transitions = new Set<string>();
    const containerWidths = new Set<string>();

    function recordColor(color: string, context: string) {
      if (!color || color === 'rgba(0, 0, 0, 0)' || color === 'transparent') return;
      if (!colors[color]) {
        colors[color] = { count: 0, contexts: [] };
      }
      colors[color].count++;
      if (!colors[color].contexts.includes(context) && colors[color].contexts.length < 5) {
        colors[color].contexts.push(context);
      }
    }

    allElements.forEach((el) => {
      const styles = window.getComputedStyle(el);
      const tag = el.tagName.toLowerCase();

      // Colors
      recordColor(styles.color, `text:${tag}`);
      recordColor(styles.backgroundColor, `bg:${tag}`);
      recordColor(styles.borderTopColor, `border:${tag}`);

      // Typography
      fontSizes.add(styles.fontSize);
      fontFamilies.add(styles.fontFamily);
      fontWeights.add(styles.fontWeight);
      lineHeights.add(styles.lineHeight);

      // Spacing
      const spacingProps = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gap'] as const;
      spacingProps.forEach((prop) => {
        const val = styles.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
        if (val && val !== '0px' && val !== 'auto' && val !== 'normal') {
          spacingValues.add(val);
        }
      });

      // Border radius
      const radius = styles.borderRadius;
      if (radius && radius !== '0px') borderRadii.add(radius);

      // Border widths
      const bw = styles.borderTopWidth;
      if (bw && bw !== '0px') borderWidths.add(bw);

      // Shadows
      const boxShadow = styles.boxShadow;
      if (boxShadow && boxShadow !== 'none') shadows.add(boxShadow);

      // Transitions
      const transition = styles.transition;
      if (transition && transition !== 'all 0s ease 0s' && transition !== 'none') {
        transitions.add(transition);
      }

      // Container widths (max-width on larger elements)
      const maxWidth = styles.maxWidth;
      if (maxWidth && maxWidth !== 'none' && maxWidth !== '0px') {
        containerWidths.add(maxWidth);
      }
    });

    // Extract type scale from semantic elements
    const typeScaleElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'small', 'body'];
    const typeScale: RawDesignData['typeScale'] = [];

    for (const selector of typeScaleElements) {
      const el = document.querySelector(selector) || (selector === 'body' ? document.body : null);
      if (el) {
        const s = window.getComputedStyle(el);
        typeScale.push({
          element: selector,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          lineHeight: s.lineHeight,
          fontFamily: s.fontFamily,
          letterSpacing: s.letterSpacing,
        });
      }
    }

    return {
      colors,
      fontSizes: Array.from(fontSizes),
      fontFamilies: Array.from(fontFamilies),
      fontWeights: Array.from(fontWeights),
      lineHeights: Array.from(lineHeights),
      spacingValues: Array.from(spacingValues),
      borderRadii: Array.from(borderRadii),
      borderWidths: Array.from(borderWidths),
      shadows: Array.from(shadows),
      transitions: Array.from(transitions),
      containerWidths: Array.from(containerWidths),
      typeScale,
    };
  });

  return processRawDesignData(rawData);
}

function processRawDesignData(raw: RawDesignData): DesignTokens {
  // Sort colors by frequency
  const colorEntries = Object.entries(raw.colors)
    .sort(([, a], [, b]) => b.count - a.count);

  const allColors = colorEntries.map(([color, data]) => ({
    color,
    frequency: data.count,
    contexts: data.contexts,
  }));

  // Classify colors
  const textColors = colorEntries
    .filter(([, d]) => d.contexts.some((c) => c.startsWith('text:')))
    .map(([color, d]) => ({ color, usage: d.contexts.filter((c) => c.startsWith('text:')).join(', ') }));

  const bgColors = colorEntries
    .filter(([, d]) => d.contexts.some((c) => c.startsWith('bg:')))
    .map(([color, d]) => ({ color, usage: d.contexts.filter((c) => c.startsWith('bg:')).join(', ') }));

  const borderColors = colorEntries
    .filter(([, d]) => d.contexts.some((c) => c.startsWith('border:')))
    .map(([color, d]) => ({ color, usage: d.contexts.filter((c) => c.startsWith('border:')).join(', ') }));

  // Extract unique font families
  const fontFamilies = raw.fontFamilies
    .filter((f) => f && f !== 'inherit')
    .map((familyStr) => {
      const family = familyStr.split(',')[0].replace(/['"]/g, '').trim();
      const weights = raw.fontWeights.map(Number).filter((w) => !isNaN(w));
      return {
        family,
        weights: [...new Set(weights)].sort(),
        source: detectFontSource(family) as 'google-fonts' | 'local' | 'cdn',
        localFiles: [],
      };
    });

  // Deduplicate font families
  const uniqueFamilies = new Map<string, (typeof fontFamilies)[0]>();
  for (const f of fontFamilies) {
    if (!uniqueFamilies.has(f.family)) {
      uniqueFamilies.set(f.family, f);
    }
  }

  // Sort spacing values numerically
  const sortedSpacing = raw.spacingValues
    .map((v) => ({ value: v, px: parseFloat(v) }))
    .filter((v) => !isNaN(v.px))
    .sort((a, b) => a.px - b.px)
    .map((v) => v.value);

  // Extract transition durations and easings
  const durations = new Set<string>();
  const easings = new Set<string>();
  for (const t of raw.transitions) {
    const durationMatch = t.match(/(\d+\.?\d*m?s)/);
    if (durationMatch) durations.add(durationMatch[1]);

    const easingMatch = t.match(/(ease[-\w]*|linear|cubic-bezier\([^)]+\))/);
    if (easingMatch) easings.add(easingMatch[1]);
  }

  // Detect breakpoints from container widths
  const breakpointValues = raw.containerWidths
    .map((v) => parseFloat(v))
    .filter((v) => !isNaN(v) && v > 300 && v < 2000)
    .sort((a, b) => a - b);

  const breakpoints = detectBreakpoints(breakpointValues);

  // Find likely container max-width
  const containerMaxWidth = raw.containerWidths
    .find((v) => {
      const px = parseFloat(v);
      return px >= 900 && px <= 1400;
    });

  return {
    colors: {
      primary: allColors.slice(0, 3).map((c) => c.color),
      secondary: allColors.slice(3, 6).map((c) => c.color),
      text: textColors.slice(0, 10),
      background: bgColors.slice(0, 10),
      border: borderColors.slice(0, 10),
      accent: allColors.slice(6, 10).map((c) => c.color),
      all: allColors.slice(0, 50),
    },
    typography: {
      fontFamilies: Array.from(uniqueFamilies.values()),
      typeScale: raw.typeScale,
    },
    spacing: {
      values: [...new Set(sortedSpacing)],
      containerMaxWidth,
      contentMaxWidth: containerMaxWidth,
    },
    borders: {
      radii: [...new Set(raw.borderRadii)].sort(),
      widths: [...new Set(raw.borderWidths)].sort(),
      styles: ['solid'], // Most common
    },
    shadows: {
      values: [...new Set(raw.shadows)],
    },
    breakpoints: {
      values: breakpoints,
    },
    transitions: {
      durations: Array.from(durations),
      easings: Array.from(easings),
    },
  };
}

function detectFontSource(family: string): string {
  const lowerFamily = family.toLowerCase();
  // System fonts
  const systemFonts = ['arial', 'helvetica', 'times', 'georgia', 'verdana',
    'tahoma', 'courier', 'system-ui', '-apple-system', 'segoe ui',
    'roboto', 'sans-serif', 'serif', 'monospace'];
  if (systemFonts.some((sf) => lowerFamily.includes(sf))) return 'local';
  return 'cdn';
}

export interface ElementComputedStyles {
  tag: string;
  classes: string;
  id: string;
  selector: string;
  textPreview: string;
  childCount: number;
  rect: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
  parentLayout?: {
    display: string;
    flexDirection: string;
    gridTemplateColumns: string;
    justifyContent: string;
    alignItems: string;
    gap: string;
  };
}

export async function extractElementStyles(page: Page): Promise<ElementComputedStyles[]> {
  return page.evaluate(() => {
    const STYLE_PROPERTIES = [
      'display', 'position', 'width', 'height',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'gap', 'grid-template-columns', 'grid-template-rows',
      'flex-direction', 'justify-content', 'align-items',
      'background-color', 'background-image',
      'border-top', 'border-right', 'border-bottom', 'border-left',
      'border-radius', 'box-shadow',
      'font-size', 'font-weight', 'font-family', 'line-height',
      'letter-spacing', 'text-align', 'color', 'opacity',
      'max-width', 'overflow',
    ];

    const SIGNIFICANT_SELECTORS = 'nav, header, section, footer, main, aside, article';

    // Collect significant layout elements
    const elements: Element[] = [];
    const seen = new Set<Element>();
    const significantElements = document.querySelectorAll(SIGNIFICANT_SELECTORS);
    significantElements.forEach((el) => { if (!seen.has(el)) { seen.add(el); elements.push(el); } });

    // Also include direct children of body
    const bodyChildren = document.body ? Array.from(document.body.children) : [];
    for (const child of bodyChildren) {
      if (!seen.has(child)) { seen.add(child); elements.push(child); }
    }

    // Capture inner layout containers (grid/flex with multi-column layouts)
    // This catches responsive 2-column layouts, card grids, etc. that aren't
    // top-level semantic elements but define the page's visual structure.
    const allEls = document.querySelectorAll('body *');
    for (const el of allEls) {
      if (seen.has(el)) continue;
      const cs = window.getComputedStyle(el);
      const display = cs.getPropertyValue('display');
      const isGrid = display === 'grid' || display === 'inline-grid';
      const isFlex = display === 'flex' || display === 'inline-flex';
      if (!isGrid && !isFlex) continue;
      // Only capture multi-child layouts (skip single-child flex wrappers)
      if (el.children.length < 2) continue;
      // For grid: only capture if it has explicit columns
      if (isGrid) {
        const cols = cs.getPropertyValue('grid-template-columns');
        if (cols && cols !== 'none' && cols !== 'auto') {
          seen.add(el); elements.push(el);
        }
      }
      // For flex: only capture row layouts with multiple children
      if (isFlex) {
        const dir = cs.getPropertyValue('flex-direction');
        if (dir === 'row' || dir === 'row-reverse') {
          // Only if it has enough visual width to be a real layout container
          const rect = el.getBoundingClientRect();
          if (rect.width > 300) {
            seen.add(el); elements.push(el);
          }
        }
      }
      // Cap at 100 elements to avoid noise
      if (elements.length >= 100) break;
    }

    const results: Array<{
      tag: string;
      classes: string;
      id: string;
      selector: string;
      textPreview: string;
      childCount: number;
      rect: { x: number; y: number; width: number; height: number };
      styles: Record<string, string>;
      parentLayout?: {
        display: string;
        flexDirection: string;
        gridTemplateColumns: string;
        justifyContent: string;
        alignItems: string;
        gap: string;
      };
    }> = [];

    for (const el of elements) {
      const tag = el.tagName.toLowerCase();
      const classes = el.className && typeof el.className === 'string' ? el.className : '';
      const id = el.id || '';

      // Build a CSS selector
      let selector = tag;
      if (id) {
        selector += `#${id}`;
      } else if (classes.trim()) {
        selector += '.' + classes.trim().split(/\s+/).join('.');
      }

      // Text preview (first 100 chars)
      const textContent = el.textContent || '';
      const textPreview = textContent.trim().substring(0, 100);

      // Child count
      const childCount = el.children.length;

      // Bounding rect
      const domRect = el.getBoundingClientRect();
      const rect = {
        x: Math.round(domRect.x),
        y: Math.round(domRect.y),
        width: Math.round(domRect.width),
        height: Math.round(domRect.height),
      };

      // Computed styles
      const computed = window.getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const prop of STYLE_PROPERTIES) {
        styles[prop] = computed.getPropertyValue(prop);
      }

      // Parent layout context — only if parent uses flex or grid
      let parentLayout: typeof results[0]['parentLayout'];
      const parent = el.parentElement;
      if (parent) {
        const parentStyles = window.getComputedStyle(parent);
        const parentDisplay = parentStyles.getPropertyValue('display');
        if (parentDisplay === 'flex' || parentDisplay === 'inline-flex' ||
            parentDisplay === 'grid' || parentDisplay === 'inline-grid') {
          parentLayout = {
            display: parentDisplay,
            flexDirection: parentStyles.getPropertyValue('flex-direction'),
            gridTemplateColumns: parentStyles.getPropertyValue('grid-template-columns'),
            justifyContent: parentStyles.getPropertyValue('justify-content'),
            alignItems: parentStyles.getPropertyValue('align-items'),
            gap: parentStyles.getPropertyValue('gap'),
          };
        }
      }

      results.push({
        tag,
        classes,
        id,
        selector,
        textPreview,
        childCount,
        rect,
        styles,
        ...(parentLayout ? { parentLayout } : {}),
      });
    }

    return results;
  });
}

function detectBreakpoints(values: number[]): Array<{ name: string; value: string }> {
  const standard = [
    { name: 'sm', min: 580, max: 680 },
    { name: 'md', min: 700, max: 800 },
    { name: 'lg', min: 960, max: 1080 },
    { name: 'xl', min: 1200, max: 1320 },
    { name: '2xl', min: 1400, max: 1600 },
  ];

  const breakpoints: Array<{ name: string; value: string }> = [];

  for (const bp of standard) {
    const match = values.find((v) => v >= bp.min && v <= bp.max);
    if (match) {
      breakpoints.push({ name: bp.name, value: `${match}px` });
    }
  }

  return breakpoints;
}
