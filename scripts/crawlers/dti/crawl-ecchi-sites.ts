/**
 * エッチな系サイト Crawler
 * Crawls product pages from:
 * - エッチな0930 (av-e-body.com)
 * - エッチな4610 (av-4610.com)
 * - エッチな0230 (av-0230.com)
 * - エッチな0930WORLD
 *
 * Usage:
 *   npx tsx scripts/crawlers/dti/crawl-ecchi-sites.ts --site 0930 --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-ecchi-sites.ts --site 4610 --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-ecchi-sites.ts --site 0230 --limit 50
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
// Site Configurations
// ============================================================

const ECCHI_CONFIGS: Record<string, DTISiteConfig> = {
  '0930': {
    siteName: 'エッチな0930',
    siteId: '2474',
    baseUrl: 'https://www.av-e-body.com',
    urlPattern: 'https://www.av-e-body.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '120624_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
  '4610': {
    siteName: 'エッチな4610',
    siteId: '2475',
    baseUrl: 'https://www.av-4610.com',
    urlPattern: 'https://www.av-4610.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '120624_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
  '0230': {
    siteName: 'エッチな0230',
    siteId: '3004',
    baseUrl: 'https://www.av-0230.com',
    urlPattern: 'https://www.av-0230.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '120624_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
  '0930world': {
    siteName: 'エッチな0930WORLD',
    siteId: '3003',
    baseUrl: 'https://www.av-e-body.com',
    urlPattern: 'https://www.av-e-body.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '120624_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
};

// ============================================================
// Ecchi Sites Crawler Class
// ============================================================

class EcchiSitesCrawler extends DTIBaseCrawler {
  constructor(siteKey: string) {
    const config = ECCHI_CONFIGS[siteKey];
    if (!config) {
      throw new Error(`Unknown site key: ${siteKey}`);
    }
    super(config);
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
    const baseUrl = this.config.baseUrl;
    const galleryZipUrl = `${baseUrl}/moviepages/${productId}/gallery.zip`;
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
      `${baseUrl}/moviepages/${productId}/images/str.jpg`;

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

function parseArgs(): CrawlOptions & { site?: string } {
  const args = process.argv.slice(2);
  const options: CrawlOptions & { site?: string } = {
    enableAI: !args.includes('--no-ai'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--site' && i + 1 < args.length) {
      options.site = args[i + 1];
      i++;
    } else if (arg === '--start' && i + 1 < args.length) {
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
  const options = parseArgs();

  if (!options.site) {
    console.error('ERROR: --site parameter is required');
    console.error('Available sites: 0930, 4610, 0230, 0930world');
    process.exit(1);
  }

  const siteKey = options.site.toLowerCase();
  if (!ECCHI_CONFIGS[siteKey]) {
    console.error(`ERROR: Unknown site: ${options.site}`);
    console.error('Available sites: 0930, 4610, 0230, 0930world');
    process.exit(1);
  }

  const config = ECCHI_CONFIGS[siteKey];
  console.log('========================================');
  console.log(`${config.siteName} Crawler`);
  console.log('========================================\n');

  const crawler = new EcchiSitesCrawler(siteKey);

  try {
    await crawler.crawl(options);
    console.log('\n========================================');
    console.log(`${config.siteName} Crawl Completed!`);
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

export { EcchiSitesCrawler, ECCHI_CONFIGS };
