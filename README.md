# copycat-scraper

Website scraper that extracts content, assets, design tokens, and structure from any site. Powered by Playwright.

## Features

- Full-page crawling with configurable depth, concurrency, and page limits
- Content extraction: HTML, Markdown, headings, links, media, fonts, animations
- Design token extraction: colors, typography, spacing, shadows, transitions
- Multi-viewport screenshots (desktop, tablet, mobile)
- Asset downloading: images, fonts, stylesheets, scripts, documents
- Page classification and template detection
- Sitemap and robots.txt support
- CLI, programmatic API, and MCP server

## Install

```bash
npm install copycat-scraper
npx playwright install chromium
```

## CLI Usage

```bash
# Crawl a site
npx copycat-scraper crawl https://example.com

# With options
npx copycat-scraper crawl https://example.com \
  -o ./output \
  --max-pages 50 \
  -c 3 \
  --no-screenshots \
  -v

# List previous crawls
npx copycat-scraper list ./output
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./output` |
| `-d, --depth <n>` | Maximum crawl depth | `10` |
| `-c, --concurrency <n>` | Max concurrent pages | `5` |
| `--max-pages <n>` | Maximum pages to crawl | `1000` |
| `--timeout <ms>` | Navigation timeout | `30000` |
| `--no-screenshots` | Disable screenshots | |
| `--no-design-tokens` | Disable design token extraction | |
| `--viewports <list>` | Comma-separated viewports | `desktop,tablet,mobile` |
| `--include <patterns>` | URL patterns to include | |
| `--exclude <patterns>` | URL patterns to exclude | |
| `--no-download-assets` | Disable asset downloading | |
| `--follow-external` | Follow external links | `false` |
| `--no-respect-robots` | Ignore robots.txt | |
| `--user-agent <ua>` | Custom user agent | |
| `--delay <ms>` | Delay between requests | `0` |
| `-v, --verbose` | Verbose logging | `false` |
| `--no-headless` | Run browser in headed mode | |

## Programmatic API

```typescript
import { CrawlEngine, createLogger } from 'copycat-scraper';
import type { CrawlConfig } from 'copycat-scraper';

const config: CrawlConfig = {
  targetUrl: 'https://example.com',
  outputDir: './output/example.com',
  maxDepth: 5,
  maxConcurrency: 3,
  maxPages: 50,
  navigationTimeout: 30000,
  screenshots: true,
  designTokens: true,
  viewports: ['desktop', 'mobile'],
  includePatterns: [],
  excludePatterns: [],
  downloadAssets: true,
  followExternal: false,
  respectRobots: true,
  delay: 0,
  verbose: false,
  headless: true,
};

const logger = createLogger(true);
const engine = new CrawlEngine(config, logger);
await engine.crawl();
```

## MCP Server

The package includes an MCP server with `crawl` and `list_crawls` tools. Requires `@modelcontextprotocol/sdk` (optional dependency).

```bash
npm install @modelcontextprotocol/sdk
```

### Claude Code config

```json
{
  "mcpServers": {
    "copycat-scraper": {
      "command": "npx",
      "args": ["copycat-scraper-mcp"]
    }
  }
}
```

Or if installed locally:

```json
{
  "mcpServers": {
    "copycat-scraper": {
      "command": "node",
      "args": ["node_modules/copycat-scraper/dist/mcp-server.js"]
    }
  }
}
```

## Output Structure

```
output/example.com/
  manifest.json          # Crawl metadata, page index, asset manifest
  design-tokens.json     # Extracted design tokens
  sitemap.json           # Site tree structure
  pages/
    index.json           # Per-page data (content, metadata, links, media)
    about.json
    ...
  screenshots/
    index-desktop.png
    index-mobile.png
    ...
  assets/
    images/
    fonts/
    stylesheets/
    scripts/
```

## License

MIT
