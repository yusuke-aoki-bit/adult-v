/**
 * 金髪天國 Crawler
 * Crawls product pages from kin8tengoku.com
 *
 * Usage:
 *   npx tsx scripts/crawlers/dti/crawl-kin8tengoku.ts --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-kin8tengoku.ts --start 0001
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
// 金髪天國 Configuration
// ============================================================

const KIN8TENGOKU_CONFIG: DTISiteConfig = {
  siteName: '金髪天國',
  siteId: '2476',
  baseUrl: 'https://www.kin8tengoku.com',
  urlPattern: 'https://www.kin8tengoku.com/moviepages/{id}/index.html',
  idFormat: 'NNNN',
  startId: '0001',
  endId: '9999',
  reverseMode: false,
  maxConcurrent: 3,
};

// ============================================================
// 金髪天國 Crawler Class
// ============================================================

class Kin8tengokuCrawler extends DTIBaseCrawler {
  constructor() {
    super(KIN8TENGOKU_CONFIG);
  }

  async parseHtmlContent(
    html: string,
    productId: string
  ): Promise<ParsedProductData | null> {
    const basicInfo = extractBasicInfo(html);

    if (!isValidTitle(basicInfo.rawTitle)) {
      console.log(
        `    ⚠️  Invalid title detected: "${basicInfo.rawTitle?.substring(0, 50)}..."`
      );
      return null;
    }

    const title = basicInfo.rawTitle!.replace(/\s*-.*$/, '').trim();

    const { price, saleInfo } = extractPrice(html);
    const actors = extractActors(html, title);
    const releaseDate = extractReleaseDate(html);

    // Sample images from HTML and gallery.zip
    let sampleImages = extractSampleImages(html, basicInfo.imageUrl);
    const galleryZipUrl = `https://www.kin8tengoku.com/moviepages/${productId}/gallery.zip`;
    const galleryImages = await fetchGalleryZip(galleryZipUrl, productId);
    for (const img of galleryImages) {
      if (!sampleImages.includes(img)) {
        sampleImages.push(img);
      }
    }

    // Sample video URL
    const sampleVideoUrl = extractSampleVideoFromHtml(html);

    // Image URL fallback
    const imageUrl =
      basicInfo.imageUrl ||
      `https://www.kin8tengoku.com/moviepages/${productId}/images/str.jpg`;

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
  console.log('金髪天國 Crawler');
  console.log('========================================\n');

  const options = parseArgs();
  const crawler = new Kin8tengokuCrawler();

  try {
    await crawler.crawl(options);
    console.log('\n========================================');
    console.log('金髪天國 Crawl Completed!');
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

export { Kin8tengokuCrawler, KIN8TENGOKU_CONFIG };
