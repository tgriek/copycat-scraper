import type { PageData } from '../types/PageData.js';
import { ensureDir, writeJson } from '../utils/fileUtils.js';
import { buildPageDataPath } from '../utils/fileUtils.js';
import { urlToPath } from '../utils/urlUtils.js';
import path from 'node:path';
import type winston from 'winston';

export class OutputWriter {
  private outputDir: string;
  private logger: winston.Logger;

  constructor(outputDir: string, logger: winston.Logger) {
    this.outputDir = outputDir;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    const dirs = [
      this.outputDir,
      path.join(this.outputDir, 'pages'),
      path.join(this.outputDir, 'assets', 'images'),
      path.join(this.outputDir, 'assets', 'fonts'),
      path.join(this.outputDir, 'assets', 'stylesheets'),
      path.join(this.outputDir, 'assets', 'scripts'),
      path.join(this.outputDir, 'assets', 'documents'),
      path.join(this.outputDir, 'assets', 'videos'),
      path.join(this.outputDir, 'screenshots', 'desktop'),
      path.join(this.outputDir, 'screenshots', 'tablet'),
      path.join(this.outputDir, 'screenshots', 'mobile'),
    ];

    for (const dir of dirs) {
      await ensureDir(dir);
    }

    this.logger.info(`Output directory initialized: ${this.outputDir}`);
  }

  async writePageData(pageData: PageData): Promise<string> {
    const urlPath = urlToPath(pageData.url);
    const slug = pageData.slug;
    const filePath = buildPageDataPath(this.outputDir, slug, urlPath);
    await writeJson(filePath, pageData);
    this.logger.debug(`Saved page data: ${filePath}`);
    return filePath;
  }

}
