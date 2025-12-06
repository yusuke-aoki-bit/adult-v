/**
 * カリビアンコムプレミアム Crawler
 * Crawls product pages from caribbeancompr.com
 *
 * Usage:
 *   npx tsx scripts/crawlers/dti/crawl-caribbeancompr.ts --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-caribbeancompr.ts --start 112024_001
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
  extractActors,
  extractReleaseDate,
  extractSampleImages,
  extractSampleVideoFromHtml,
  fetchGalleryZip,
  isValidTitle,
} from '../../../lib/providers/dti-base';

// ============================================================
// カリビアンコムプレミアム Configuration
// ============================================================

const CARIBBEANCOMPR_CONFIG: DTISiteConfig = {
  siteName: 'カリビアンコムプレミアム',
  siteId: '2477',
  baseUrl: 'https://www.caribbeancompr.com',
  urlPattern: 'https://www.caribbeancompr.com/moviepages/{id}/index.html',
  idFormat: 'MMDDYY_NNN',
  startId: '120624_001',
  endId: '010115_001',
  reverseMode: true,
  maxConcurrent: 3,
};

// ============================================================
// カリビアンコムプレミアム Crawler Class
// ============================================================

class CaribbeancomprCrawler extends DTIBaseCrawler {
  constructor() {
    super(CARIBBEANCOMPR_CONFIG);
  }

  async parseHtmlContent(
    html: string,
    productId: string
  ): Promise<ParsedProductData | null> {
    // Extract basic info
    const basicInfo = extractBasicInfo(html);

    if (!isValidTitle(basicInfo.rawTitle)) {
      console.log(
        `    ⚠️  Invalid title detected: "${basicInfo.rawTitle?.substring(0, 50)}..."`
      );
      return null;
    }

    // Clean title
    const title = basicInfo.rawTitle!.replace(/\s*-.*$/, '').trim();

    // Extract other data
    const { price, saleInfo } = extractPrice(html);
    const actors = extractActors(html, title);
    const releaseDate = extractReleaseDate(html);

    // Sample images from HTML and gallery.zip
    let sampleImages = extractSampleImages(html, basicInfo.imageUrl);
    const galleryZipUrl = `https://www.caribbeancompr.com/moviepages/${productId}/gallery.zip`;
    const galleryImages = await fetchGalleryZip(galleryZipUrl, productId);
    for (const img of galleryImages) {
      if (!sampleImages.includes(img)) {
        sampleImages.push(img);
      }
    }

    // Sample video URL
    let sampleVideoUrl = extractSampleVideoFromHtml(html);
    if (!sampleVideoUrl) {
      sampleVideoUrl = `https://www.caribbeancompr.com/moviepages/${productId}/sample/sample.mp4`;
    }

    // Image URL fallback
    const imageUrl =
      basicInfo.imageUrl ||
      `https://www.caribbeancompr.com/moviepages/${productId}/images/l_l.jpg`;

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
  console.log('カリビアンコムプレミアム Crawler');
  console.log('========================================\n');

  const options = parseArgs();
  const crawler = new CaribbeancomprCrawler();

  try {
    await crawler.crawl(options);
    console.log('\n========================================');
    console.log('カリビアンコムプレミアム Crawl Completed!');
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

export { CaribbeancomprCrawler, CARIBBEANCOMPR_CONFIG };
