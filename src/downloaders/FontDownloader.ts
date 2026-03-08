import fs from 'node:fs/promises';
import path from 'node:path';
import type { FontInfo } from '../types/AssetData.js';
import { ensureDir } from '../utils/fileUtils.js';
import { sanitizeFilename } from '../utils/urlUtils.js';
import type winston from 'winston';

export class FontDownloader {
  private outputDir: string;
  private logger: winston.Logger;
  private downloaded: Map<string, string> = new Map(); // url -> localPath

  constructor(outputDir: string, logger: winston.Logger) {
    this.outputDir = outputDir;
    this.logger = logger;
  }

  async downloadFonts(fonts: FontInfo[]): Promise<Map<string, string>> {
    const fontDir = path.join(this.outputDir, 'assets', 'fonts');
    await ensureDir(fontDir);

    const downloadable = fonts.filter(
      (f) => f.src && !f.src.startsWith('data:') && f.source !== 'google-fonts',
    );

    this.logger.info(`Downloading ${downloadable.length} font files...`);

    // Handle Google Fonts separately - need to fetch CSS first
    const googleFonts = fonts.filter((f) => f.source === 'google-fonts');
    for (const gf of googleFonts) {
      try {
        await this.downloadGoogleFont(gf, fontDir);
      } catch (err) {
        this.logger.debug(`Failed to download Google Font: ${gf.family}: ${err}`);
      }
    }

    // Download direct font files
    for (const font of downloadable) {
      try {
        await this.downloadFontFile(font.src, fontDir, font.family);
      } catch (err) {
        this.logger.debug(`Failed to download font: ${font.src}: ${err}`);
      }
    }

    return this.downloaded;
  }

  private async downloadFontFile(
    url: string,
    fontDir: string,
    family: string,
  ): Promise<void> {
    if (this.downloaded.has(url)) return;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) return;

      const buffer = Buffer.from(await response.arrayBuffer());

      // Determine filename
      const urlFilename = path.basename(new URL(url).pathname);
      const filename = urlFilename.includes('.')
        ? sanitizeFilename(urlFilename)
        : sanitizeFilename(`${family}.woff2`);

      const localPath = path.join(fontDir, filename);
      await fs.writeFile(localPath, buffer);

      const relativePath = path.relative(this.outputDir, localPath);
      this.downloaded.set(url, relativePath);

      this.logger.debug(`Downloaded font: ${filename}`);
    } catch {
      // Non-fatal
    }
  }

  private async downloadGoogleFont(
    font: FontInfo,
    fontDir: string,
  ): Promise<void> {
    try {
      // Fetch the Google Fonts CSS with a modern UA to get woff2
      const response = await fetch(font.src, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) return;

      const css = await response.text();

      // Extract font file URLs from CSS
      const urlRegex = /url\(([^)]+)\)/g;
      let match;

      while ((match = urlRegex.exec(css)) !== null) {
        const fontUrl = match[1].replace(/['"]/g, '');
        if (fontUrl.startsWith('data:')) continue;

        await this.downloadFontFile(fontUrl, fontDir, font.family);
      }
    } catch {
      // Non-fatal
    }
  }

  getDownloadedPaths(): Map<string, string> {
    return this.downloaded;
  }
}
