import type { Page } from 'playwright';
import type { AnimationInfo } from '../types/PageData.js';

export async function extractAnimations(page: Page): Promise<AnimationInfo[]> {
  return page.evaluate(() => {
    const animations: Array<{
      selector: string;
      tag: string;
      classes: string;
      sectionType: string;
      animationType: 'css-animation' | 'css-transition' | 'slideshow' | 'autoplay-video' | 'scroll-triggered';
      details: Record<string, string | string[] | number | boolean>;
    }> = [];

    const seen = new Set<Element>();

    function getSelector(el: Element): string {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
        : '';
      return `${tag}${id}${cls}`;
    }

    function getSectionType(el: Element): string {
      let current: Element | null = el;
      while (current) {
        const tag = current.tagName?.toLowerCase();
        if (tag === 'header' || tag === 'nav') return 'navigation';
        if (tag === 'footer') return 'footer';
        const cls = (current.className || '').toString().toLowerCase();
        const id = (current.id || '').toLowerCase();
        const combined = `${cls} ${id}`;
        if (/hero|banner/.test(combined)) return 'hero';
        if (/nav|menu|header/.test(combined)) return 'navigation';
        if (tag === 'section' || tag === 'main') return 'content';
        current = current.parentElement;
      }
      return 'unknown';
    }

    // 1. CSS animations (keyframe-based)
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const style = window.getComputedStyle(el);

      const animName = style.animationName;
      if (animName && animName !== 'none') {
        if (seen.has(el)) continue;
        seen.add(el);
        animations.push({
          selector: getSelector(el),
          tag: el.tagName.toLowerCase(),
          classes: (el.className || '').toString().trim(),
          sectionType: getSectionType(el),
          animationType: 'css-animation',
          details: {
            animationName: animName,
            animationDuration: style.animationDuration,
            animationTimingFunction: style.animationTimingFunction,
            animationIterationCount: style.animationIterationCount,
            animationDirection: style.animationDirection,
          },
        });
      }

      // 2. CSS transitions (non-trivial)
      const transitionProp = style.transitionProperty;
      const transitionDuration = style.transitionDuration;
      if (
        transitionProp &&
        transitionProp !== 'none' &&
        transitionProp !== 'all' &&
        transitionDuration &&
        transitionDuration !== '0s'
      ) {
        // Only capture transitions on interactive/visible elements (nav, buttons, links, hero elements)
        const tag = el.tagName.toLowerCase();
        const isInteractive = ['a', 'button', 'nav', 'header', 'li'].includes(tag) ||
          el.closest('nav, header, [class*="hero"], [class*="menu"], [class*="nav"]');
        if (isInteractive && !seen.has(el)) {
          seen.add(el);
          animations.push({
            selector: getSelector(el),
            tag,
            classes: (el.className || '').toString().trim(),
            sectionType: getSectionType(el),
            animationType: 'css-transition',
            details: {
              transitionProperty: transitionProp,
              transitionDuration,
              transitionTimingFunction: style.transitionTimingFunction,
            },
          });
        }
      }
    }

    // 3. Slideshows / carousels — detect containers with multiple children and overflow hidden or transform
    const carouselPatterns = [
      '[class*="slider"]', '[class*="carousel"]', '[class*="swiper"]',
      '[class*="slide"]', '[class*="banner"]', '[class*="hero"]',
      '[data-slick]', '[data-flickity]', '[data-splide]',
    ];

    for (const selector of carouselPatterns) {
      document.querySelectorAll(selector).forEach((el) => {
        if (seen.has(el)) return;
        const style = window.getComputedStyle(el);
        const children = el.children;

        // Check for multiple similar children (slides) or overflow hidden
        const hasMultipleChildren = children.length >= 2;
        const hasOverflowHidden = style.overflow === 'hidden' || style.overflowX === 'hidden';
        const hasTransform = style.transform !== 'none';

        // Check for images/videos inside
        const mediaCount = el.querySelectorAll('img, video, picture').length;

        if ((hasMultipleChildren && (hasOverflowHidden || hasTransform)) || mediaCount >= 2) {
          seen.add(el);
          const slideImages: string[] = [];
          el.querySelectorAll('img[src]').forEach((img) => {
            const src = (img as HTMLImageElement).src;
            if (src) slideImages.push(src);
          });
          const slideVideos: string[] = [];
          el.querySelectorAll('video source[src], video[src]').forEach((vid) => {
            const src = (vid as HTMLSourceElement | HTMLVideoElement).src;
            if (src) slideVideos.push(src);
          });

          animations.push({
            selector: getSelector(el),
            tag: el.tagName.toLowerCase(),
            classes: (el.className || '').toString().trim(),
            sectionType: getSectionType(el),
            animationType: 'slideshow',
            details: {
              childCount: children.length,
              mediaCount,
              slideImages: slideImages.slice(0, 20),
              slideVideos: slideVideos.slice(0, 10),
              hasOverflowHidden,
              hasTransform,
            },
          });
        }
      });
    }

    // 4. Autoplay videos (hero background videos, looping videos)
    document.querySelectorAll('video').forEach((video) => {
      if (seen.has(video)) return;
      const isAutoplay = video.autoplay || video.hasAttribute('autoplay');
      const isLoop = video.loop || video.hasAttribute('loop');
      const isMuted = video.muted || video.hasAttribute('muted');

      if (isAutoplay || isLoop) {
        seen.add(video);
        const sources: string[] = [];
        if (video.src) sources.push(video.src);
        video.querySelectorAll('source[src]').forEach((s) => {
          const src = (s as HTMLSourceElement).src;
          if (src) sources.push(src);
        });

        animations.push({
          selector: getSelector(video),
          tag: 'video',
          classes: (video.className || '').toString().trim(),
          sectionType: getSectionType(video),
          animationType: 'autoplay-video',
          details: {
            autoplay: isAutoplay,
            loop: isLoop,
            muted: isMuted,
            sources,
            poster: video.poster || '',
          },
        });
      }
    });

    // 5. Scroll-triggered animations — elements with common animation library classes
    const scrollAnimPatterns = [
      '[data-aos]', '[data-scroll]', '[data-animate]',
      '[class*="wow"]', '[class*="animate__"]', '[class*="fade-in"]',
      '[class*="slide-in"]', '[class*="reveal"]',
      '.aos-init', '.gsap', '[data-gsap]',
    ];

    for (const selector of scrollAnimPatterns) {
      document.querySelectorAll(selector).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);

        const dataset: Record<string, string> = {};
        for (const key of Object.keys((el as HTMLElement).dataset)) {
          if (['aos', 'aosDelay', 'aosDuration', 'aosOffset', 'scroll', 'animate', 'gsap'].includes(key)) {
            dataset[key] = (el as HTMLElement).dataset[key] || '';
          }
        }

        animations.push({
          selector: getSelector(el),
          tag: el.tagName.toLowerCase(),
          classes: (el.className || '').toString().trim(),
          sectionType: getSectionType(el),
          animationType: 'scroll-triggered',
          details: {
            ...dataset,
            library: el.hasAttribute('data-aos') ? 'aos' :
              el.hasAttribute('data-gsap') ? 'gsap' :
              (el.className || '').toString().includes('wow') ? 'wow' :
              (el.className || '').toString().includes('animate__') ? 'animate.css' : 'unknown',
          },
        });
      });
    }

    return animations;
  });
}
