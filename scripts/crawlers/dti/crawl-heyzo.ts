/**
 * HEYZO Crawler
 * Crawls product pages from heyzo.com
 *
 * Usage:
 *   npx tsx scripts/crawlers/dti/crawl-heyzo.ts --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-heyzo.ts --start 0001
 */

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import {
  DTIBaseCrawler,
  DTISiteConfig,
  ParsedProductData,
  CrawlOptions,
  extractBasicInfo,
  extractPrice,
  extractReleaseDate,
  extractSampleImages,
  extractSampleVideoFromHtml,
  fetchGalleryZip,
  isValidTitle,
} from '../../../lib/providers/dti-base';
import {
  normalizePerformerName,
  isValidPerformerForProduct,
} from '../../../lib/performer-validation';

// ============================================================
// HEYZO Configuration
// ============================================================

const HEYZO_CONFIG: DTISiteConfig = {
  siteName: 'HEYZO',
  siteId: '2665',
  baseUrl: 'https://www.heyzo.com',
  urlPattern: 'https://www.heyzo.com/moviepages/{id}/index.html',
  idFormat: 'NNNN',
  startId: '0001',
  endId: '9999',
  reverseMode: false, // Forward direction for numeric IDs
  maxConcurrent: 3,
};

// ============================================================
// HEYZO Specific Parsing
// ============================================================

/**
 * Extract actor from HEYZO title format
 * Title format: "女優名 【ふりがな】 作品タイトル"
 */
function extractHeyzoActor(html: string): string[] {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (!titleMatch) return [];

  const title = titleMatch[1];

  // Pattern: 女優名 【ふりがな】
  const actorMatch = title.match(/^([^\s【]+)\s*【[^】]+】/);
  if (actorMatch) {
    const normalized = normalizePerformerName(actorMatch[1]);
    if (normalized && isValidPerformerForProduct(normalized, title)) {
      return [normalized];
    }
  }

  // Fallback: try ec_item_brand pattern
  const brandMatch = html.match(/var\s+ec_item_brand\s*=\s*['"]([^'"]+)['"]/);
  if (brandMatch && brandMatch[1]) {
    const normalized = normalizePerformerName(brandMatch[1]);
    if (normalized && isValidPerformerForProduct(normalized, title)) {
      return [normalized];
    }
  }

  return [];
}

/**
 * Clean HEYZO title - remove actor and furigana prefix
 */
function cleanHeyzoTitle(rawTitle: string): string {
  // Remove "女優名 【ふりがな】 " prefix
  let title = rawTitle.replace(/^[^\s【]+\s*【[^】]+】\s*/, '');

  // Remove site suffix
  title = title
    .replace(/\s*\|\s*HEYZO$/, '')
    .replace(/\s*-.*$/, '')
    .trim();

  return title;
}

// ============================================================
// HEYZO Crawler Class
// ============================================================

class HeyzoCrawler extends DTIBaseCrawler {
  constructor() {
    super(HEYZO_CONFIG);
  }

  async parseHtmlContent(
    html: string,
    productId: string
  ): Promise<ParsedProductData | null> {
    // Extract basic info
    const basicInfo = extractBasicInfo(html);

    if (!basicInfo.rawTitle) {
      return null;
    }

    // Clean HEYZO title
    const title = cleanHeyzoTitle(basicInfo.rawTitle);

    if (!title || title.length < 3) {
      console.log(`    ⚠️  Invalid title after cleaning: "${title}"`);
      return null;
    }

    // Extract HEYZO-specific actor
    const actors = extractHeyzoActor(html);

    // Extract other data
    const { price, saleInfo } = extractPrice(html);
    const releaseDate = extractReleaseDate(html);

    // Sample images from HTML and gallery.zip
    let sampleImages = extractSampleImages(html, basicInfo.imageUrl);
    const galleryZipUrl = `https://www.heyzo.com/moviepages/${productId}/gallery.zip`;
    const galleryImages = await fetchGalleryZip(galleryZipUrl, productId);
    for (const img of galleryImages) {
      if (!sampleImages.includes(img)) {
        sampleImages.push(img);
      }
    }

    // Sample video URL
    let sampleVideoUrl = extractSampleVideoFromHtml(html);
    if (!sampleVideoUrl) {
      sampleVideoUrl = `https://www.heyzo.com/moviepages/${productId}/sample/sample.mp4`;
    }

    // Image URL fallback
    const imageUrl =
      basicInfo.imageUrl ||
      `https://www.heyzo.com/moviepages/${productId}/images/player_thumbnail.jpg`;

    return {
      title,
      description: basicInfo.description,
      actors,
      releaseDate,
      imageUrl,
      sampleImages,
      sampleVideoUrl,
      price,
      saleInfo,
    };
  }
}

// ============================================================
// CLI Entry Point
// ============================================================

function parseArgs(): CrawlOptions {
  const args = process.argv.slice(2);
  const options: CrawlOptions = {
    enableAI: !args.includes('--no-ai'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--start' && i + 1 < args.length) {
      options.startId = args[i + 1];
      i++;
    } else if (arg === '--limit' && i + 1 < args.length) {
      options.limit = parseInt(args[i + 1]);
      i++;
    }
  }

  return options;
}

async function main() {
  console.log('========================================');
  console.log('HEYZO Crawler');
  console.log('========================================\n');

  const options = parseArgs();
  const crawler = new HeyzoCrawler();

  try {
    await crawler.crawl(options);
    console.log('\n========================================');
    console.log('HEYZO Crawl Completed!');
    console.log('========================================\n');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (require.main === module) {
  main();
}

export { HeyzoCrawler, HEYZO_CONFIG };
