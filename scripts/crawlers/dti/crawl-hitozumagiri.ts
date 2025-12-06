/**
 * 人妻斬り Crawler
 * Crawls product pages from hitozuma-giri.com
 *
 * Usage:
 *   npx tsx scripts/crawlers/dti/crawl-hitozumagiri.ts --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-hitozumagiri.ts --start 112024_001
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
// 人妻斬り Configuration
// ============================================================

const HITOZUMAGIRI_CONFIG: DTISiteConfig = {
  siteName: '人妻斬り',
  siteId: '2473',
  baseUrl: 'https://www.hitozuma-giri.com',
  urlPattern: 'https://www.hitozuma-giri.com/moviepages/{id}/index.html',
  idFormat: 'MMDDYY_NNN',
  startId: '120624_001',
  endId: '010115_001',
  reverseMode: true,
  maxConcurrent: 3,
};

// ============================================================
// 人妻斬り Crawler Class
// ============================================================

class HitozumagiriCrawler extends DTIBaseCrawler {
  constructor() {
    super(HITOZUMAGIRI_CONFIG);
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
    const galleryZipUrl = `https://www.hitozuma-giri.com/moviepages/${productId}/gallery.zip`;
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
      `https://www.hitozuma-giri.com/moviepages/${productId}/images/str.jpg`;

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
  console.log('人妻斬り Crawler');
  console.log('========================================\n');

  const options = parseArgs();
  const crawler = new HitozumagiriCrawler();

  try {
    await crawler.crawl(options);
    console.log('\n========================================');
    console.log('人妻斬り Crawl Completed!');
    console.log('========================================\n');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();

export { HitozumagiriCrawler, HITOZUMAGIRI_CONFIG };
