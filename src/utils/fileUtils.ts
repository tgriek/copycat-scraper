import fs from 'node:fs/promises';
import path from 'node:path';

export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function writeFile(filePath: string, data: Buffer | string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, data);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

export function buildOutputPath(
  outputDir: string,
  category: string,
  filename: string,
): string {
  return path.join(outputDir, 'assets', category, filename);
}

export function buildScreenshotPath(
  outputDir: string,
  viewport: string,
  slug: string,
): string {
  return path.join(outputDir, 'screenshots', viewport, `${slug}.png`);
}

export function buildPageDataPath(
  outputDir: string,
  slug: string,
  urlPath: string,
): string {
  // Preserve URL directory structure
  const segments = urlPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return path.join(outputDir, 'pages', 'index.json');
  }

  const lastSegment = segments.pop()!;
  const dirPath = segments.length > 0 ? segments.join('/') : '';

  if (urlPath.endsWith('/') || !lastSegment.includes('.')) {
    // Directory-like URL: /blog/ -> pages/blog/_index.json
    if (dirPath) {
      return path.join(outputDir, 'pages', dirPath, lastSegment, '_index.json');
    }
    return path.join(outputDir, 'pages', lastSegment, '_index.json');
  }

  // File-like URL: /blog/my-post -> pages/blog/my-post.json
  const baseName = lastSegment.replace(/\.[^.]+$/, '');
  if (dirPath) {
    return path.join(outputDir, 'pages', dirPath, `${baseName}.json`);
  }
  return path.join(outputDir, 'pages', `${baseName}.json`);
}

