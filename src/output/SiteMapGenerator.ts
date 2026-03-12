import type { PageData } from '../types/PageData.js';
import type { SiteTreeNode } from '../types/CrawlResult.js';
import { writeJson } from '../utils/fileUtils.js';
import { urlToSlug, urlToPath } from '../utils/urlUtils.js';
import { buildPageDataPath } from '../utils/fileUtils.js';
import path from 'node:path';

export class SiteMapGenerator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async generateSiteMap(pages: PageData[]): Promise<SiteTreeNode> {
    const root: SiteTreeNode = {
      path: '/',
      url: '',
      title: '',
      children: [],
    };

    for (const page of pages) {
      const urlPath = urlToPath(page.url);
      const segments = urlPath.split('/').filter(Boolean);
      const slug = urlToSlug(page.url);
      const dataFile = path.relative(
        this.outputDir,
        buildPageDataPath(this.outputDir, slug, urlPath),
      );

      if (segments.length === 0) {
        // Root page
        root.url = page.url;
        root.title = page.metadata.title;
        root.templatePattern = page.classification.templatePattern;
        root.pageDataFile = dataFile;
        continue;
      }

      let current = root;
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLast = i === segments.length - 1;
        const currentPath = '/' + segments.slice(0, i + 1).join('/');

        let child = current.children.find((c) => c.path === currentPath);

        if (!child) {
          child = {
            path: currentPath,
            url: isLast ? page.url : '',
            title: isLast ? page.metadata.title : segment,
            children: [],
          };
          current.children.push(child);
        }

        if (isLast) {
          child.url = page.url;
          child.title = page.metadata.title;
          child.templatePattern = page.classification.templatePattern;
          child.pageDataFile = dataFile;
        }

        current = child;
      }
    }

    // Sort children alphabetically
    this.sortTree(root);

    const siteTreePath = path.join(this.outputDir, 'site-tree.json');
    await writeJson(siteTreePath, root);

    return root;
  }

  private sortTree(node: SiteTreeNode): void {
    node.children.sort((a, b) => a.path.localeCompare(b.path));
    for (const child of node.children) {
      this.sortTree(child);
    }
  }
}
