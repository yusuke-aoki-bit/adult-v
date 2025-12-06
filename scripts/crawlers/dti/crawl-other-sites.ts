/**
 * その他DTIサイト Crawler
 * Crawls product pages from:
 * - NOZOX
 * - 3D-EROS.NET
 * - Pikkur
 * - Javholic
 *
 * Usage:
 *   npx tsx scripts/crawlers/dti/crawl-other-sites.ts --site nozox --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-other-sites.ts --site 3d-eros --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-other-sites.ts --site pikkur --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-other-sites.ts --site javholic --limit 50
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
  isValidTitle,
} from '../../../lib/providers/dti-base';

// ============================================================
// Site Configurations
// ============================================================

const OTHER_CONFIGS: Record<string, DTISiteConfig> = {
  nozox: {
    siteName: 'NOZOX',
    siteId: '3002',
    baseUrl: 'https://www.nozox.com',
    urlPattern: 'https://www.nozox.com/moviepages/{id}/index.html',
    idFormat: 'NNNN',
    startId: '0001',
    endId: '9999',
    reverseMode: false,
    maxConcurrent: 3,
  },
  '3d-eros': {
    siteName: '3D-EROS.NET',
    siteId: '3006',
    baseUrl: 'https://www.3d-eros.net',
    urlPattern: 'https://www.3d-eros.net/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '120624_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
  pikkur: {
    siteName: 'Pikkur',
    siteId: '3007',
    baseUrl: 'https://www.pikkur.com',
    urlPattern: 'https://www.pikkur.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '120624_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
  javholic: {
    siteName: 'Javholic',
    siteId: '3008',
    baseUrl: 'https://www.javholic.com',
    urlPattern: 'https://www.javholic.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '120624_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
};

// ============================================================
// Other Sites Crawler Class
// ============================================================

class OtherSitesCrawler extends DTIBaseCrawler {
  constructor(siteKey: string) {
    const config = OTHER_CONFIGS[siteKey];
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
    const sampleImages = extractSampleImages(html, basicInfo.imageUrl);
    const sampleVideoUrl = extractSampleVideoFromHtml(html);

    return {
      title,
      description: basicInfo.description,
      actors,
      releaseDate,
      imageUrl: basicInfo.imageUrl,
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
    console.error('Available sites: nozox, 3d-eros, pikkur, javholic');
    process.exit(1);
  }

  const siteKey = options.site.toLowerCase();
  if (!OTHER_CONFIGS[siteKey]) {
    console.error(`ERROR: Unknown site: ${options.site}`);
    console.error('Available sites: nozox, 3d-eros, pikkur, javholic');
    process.exit(1);
  }

  const config = OTHER_CONFIGS[siteKey];
  console.log('========================================');
  console.log(`${config.siteName} Crawler`);
  console.log('========================================\n');

  const crawler = new OtherSitesCrawler(siteKey);

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

export { OtherSitesCrawler, OTHER_CONFIGS };
