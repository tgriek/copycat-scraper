import type { Page } from 'playwright';
import { VIEWPORT_SIZES } from '../config.js';
import { ensureDir } from '../utils/fileUtils.js';
import path from 'node:path';

export interface ScreenshotResult {
  desktop: string;
  tablet?: string;
  mobile?: string;
}

/**
 * Scroll through the entire page to trigger lazy-loaded images and content,
 * then scroll back to the top before taking a screenshot.
 */
export async function triggerLazyContent(page: Page): Promise<void> {
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const step = Math.max(Math.floor(viewportHeight * 0.5), 200);

  for (let y = 0; y < totalHeight; y += step) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(300);
  }

  // Scroll to the very bottom to catch the last lazy elements
  await page.evaluate((h) => window.scrollTo(0, h), totalHeight);
  await page.waitForTimeout(500);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

export async function captureScreenshots(
  page: Page,
  slug: string,
  outputDir: string,
  viewports: string[],
): Promise<ScreenshotResult> {
  const result: ScreenshotResult = { desktop: '' };

  for (const viewportName of viewports) {
    const size = VIEWPORT_SIZES[viewportName];
    if (!size) continue;

    try {
      await page.setViewportSize({ width: size.width, height: size.height });
      // Let responsive layout settle
      await page.waitForTimeout(1000);

      // Scroll through the page to trigger lazy-loaded images
      await triggerLazyContent(page);

      const screenshotDir = path.join(outputDir, 'screenshots', viewportName);
      await ensureDir(screenshotDir);

      // Handle nested slug paths (e.g., "blog/first-post")
      const screenshotPath = path.join(screenshotDir, `${slug}.png`);
      await ensureDir(path.dirname(screenshotPath));

      const fullHeight = await page.evaluate(() => document.body.scrollHeight);

      if (fullHeight > 16384) {
        // Playwright has limits on screenshot height; cap it
        await page.screenshot({
          path: screenshotPath,
          fullPage: false,
          clip: {
            x: 0,
            y: 0,
            width: size.width,
            height: Math.min(fullHeight, 16384),
          },
        });
      } else {
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        });
      }

      const relativePath = path.relative(outputDir, screenshotPath);

      if (viewportName === 'desktop') {
        result.desktop = relativePath;
      } else if (viewportName === 'tablet') {
        result.tablet = relativePath;
      } else if (viewportName === 'mobile') {
        result.mobile = relativePath;
      }
    } catch {
      // Screenshot failure is not fatal
    }
  }

  return result;
}
