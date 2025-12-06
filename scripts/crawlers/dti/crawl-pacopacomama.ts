/**
 * パコパコママ Crawler
 * Crawls product pages from pacopacomama.com
 *
 * Usage:
 *   npx tsx scripts/crawlers/dti/crawl-pacopacomama.ts --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-pacopacomama.ts --start 112024_001
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
// パコパコママ Configuration
// ============================================================

const PACOPACOMAMA_CONFIG: DTISiteConfig = {
  siteName: 'パコパコママ',
  siteId: '2472',
  baseUrl: 'https://www.pacopacomama.com',
  urlPattern: 'https://www.pacopacomama.com/moviepages/{id}/index.html',
  idFormat: 'MMDDYY_NNN',
  startId: '120624_001',
  endId: '010115_001',
  reverseMode: true,
  maxConcurrent: 3,
};

// ============================================================
// パコパコママ Crawler Class
// ============================================================

class PacopacomamaCrawler extends DTIBaseCrawler {
  constructor() {
    super(PACOPACOMAMA_CONFIG);
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
    const galleryZipUrl = `https://www.pacopacomama.com/assets/sample/${productId}/gallery.zip`;
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
      `https://www.pacopacomama.com/moviepages/${productId}/images/str.jpg`;

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
  console.log('パコパコママ Crawler');
  console.log('========================================\n');

  const options = parseArgs();
  const crawler = new PacopacomamaCrawler();

  try {
    await crawler.crawl(options);
    console.log('\n========================================');
    console.log('パコパコママ Crawl Completed!');
    console.log('========================================\n');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();

export { PacopacomamaCrawler, PACOPACOMAMA_CONFIG };
