import type { Page, Route } from 'playwright';
import type { InterceptedAsset } from '../types/AssetData.js';
import { isFontUrl, isImageUrl, isCssUrl, isJsUrl, isDocumentUrl } from '../utils/urlUtils.js';

export class AssetInterceptor {
  private interceptedAssets: InterceptedAsset[] = [];
  private seen: Set<string> = new Set();

  async setup(page: Page, pageUrl: string): Promise<void> {
    await page.route('**/*', async (route: Route) => {
      const request = route.request();
      const url = request.url();
      const resourceType = request.resourceType();

      // Record discovered assets
      if (this.isTrackableResource(url, resourceType)) {
        if (!this.seen.has(url)) {
          this.seen.add(url);
          this.interceptedAssets.push({
            url,
            resourceType,
            pageUrl,
            mimeType: undefined, // Will be resolved after response
          });
        }
      }

      // Allow all requests to continue
      try {
        await route.continue();
      } catch {
        // Route might already be handled
      }
    });
  }

  getInterceptedAssets(): InterceptedAsset[] {
    return [...this.interceptedAssets];
  }

  getInterceptedUrls(): string[] {
    return this.interceptedAssets.map((a) => a.url);
  }

  clear(): void {
    this.interceptedAssets = [];
    this.seen.clear();
  }

  private isTrackableResource(url: string, resourceType: string): boolean {
    // Skip data URIs and blobs
    if (url.startsWith('data:') || url.startsWith('blob:')) return false;

    // Track by resource type
    const trackableTypes = ['image', 'font', 'stylesheet', 'script', 'media'];
    if (trackableTypes.includes(resourceType)) return true;

    // Track by URL extension
    if (
      isFontUrl(url) ||
      isImageUrl(url) ||
      isCssUrl(url) ||
      isJsUrl(url) ||
      isDocumentUrl(url)
    ) {
      return true;
    }

    return false;
  }
}
