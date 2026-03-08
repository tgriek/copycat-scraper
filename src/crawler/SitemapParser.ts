import type winston from 'winston';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

export class SitemapParser {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  async parseSitemap(baseUrl: string): Promise<SitemapUrl[]> {
    const urls: SitemapUrl[] = [];

    // Try sitemap.xml
    try {
      const sitemapUrl = new URL('/sitemap.xml', baseUrl).toString();
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteCrawler/1.0)' },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const xml = await response.text();
        const parsed = this.parseXml(xml, baseUrl);
        urls.push(...parsed);
        this.logger.info(`Found ${parsed.length} URLs in sitemap.xml`);
      }
    } catch {
      this.logger.debug('No sitemap.xml found');
    }

    // Try sitemap_index.xml
    if (urls.length === 0) {
      try {
        const indexUrl = new URL('/sitemap_index.xml', baseUrl).toString();
        const response = await fetch(indexUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteCrawler/1.0)' },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const xml = await response.text();
          const sitemapUrls = this.extractSitemapIndexUrls(xml);

          for (const smUrl of sitemapUrls) {
            try {
              const smResponse = await fetch(smUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteCrawler/1.0)' },
                signal: AbortSignal.timeout(10000),
              });

              if (smResponse.ok) {
                const smXml = await smResponse.text();
                const parsed = this.parseXml(smXml, baseUrl);
                urls.push(...parsed);
              }
            } catch {
              // Skip individual sitemaps that fail
            }
          }

          if (urls.length > 0) {
            this.logger.info(`Found ${urls.length} URLs from sitemap index`);
          }
        }
      } catch {
        this.logger.debug('No sitemap index found');
      }
    }

    return urls;
  }

  async parseRobotsTxt(baseUrl: string): Promise<{
    disallowed: string[];
    sitemapUrls: string[];
  }> {
    const disallowed: string[] = [];
    const sitemapUrls: string[] = [];

    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString();
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteCrawler/1.0)' },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const text = await response.text();
        const lines = text.split('\n');
        let isRelevantAgent = false;

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed.toLowerCase().startsWith('user-agent:')) {
            const agent = trimmed.split(':')[1].trim();
            isRelevantAgent = agent === '*';
          } else if (isRelevantAgent && trimmed.toLowerCase().startsWith('disallow:')) {
            const path = trimmed.split(':').slice(1).join(':').trim();
            if (path) disallowed.push(path);
          } else if (trimmed.toLowerCase().startsWith('sitemap:')) {
            const url = trimmed.split(':').slice(1).join(':').trim();
            if (url) sitemapUrls.push(url);
          }
        }

        this.logger.debug(`robots.txt: ${disallowed.length} disallowed paths, ${sitemapUrls.length} sitemaps`);
      }
    } catch {
      this.logger.debug('No robots.txt found');
    }

    return { disallowed, sitemapUrls };
  }

  private parseXml(xml: string, _baseUrl: string): SitemapUrl[] {
    const urls: SitemapUrl[] = [];

    // Simple regex-based XML parsing for sitemap
    const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
    let match;

    while ((match = locRegex.exec(xml)) !== null) {
      const loc = match[1].trim();
      if (loc) {
        urls.push({ loc });
      }
    }

    return urls;
  }

  private extractSitemapIndexUrls(xml: string): string[] {
    const urls: string[] = [];
    const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
    let match;

    while ((match = locRegex.exec(xml)) !== null) {
      const loc = match[1].trim();
      if (loc && (loc.includes('sitemap') || loc.endsWith('.xml'))) {
        urls.push(loc);
      }
    }

    return urls;
  }
}
