/**
 * 一本道 Crawler
 * Crawls product pages from 1pondo.tv
 *
 * Usage:
 *   npx tsx scripts/crawlers/dti/crawl-1pondo.ts --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-1pondo.ts --start 112024_001
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
  extractPrice,
  extractReleaseDate,
  extractSampleImages,
  fetchGalleryZip,
  isValidPerformerForProduct,
} from '../../../lib/providers/dti-base';
import { normalizePerformerName } from '../../../lib/performer-validation';

// ============================================================
// 一本道 Configuration
// ============================================================

const IPPONDO_CONFIG: DTISiteConfig = {
  siteName: '一本道',
  siteId: '2470',
  baseUrl: 'https://www.1pondo.tv',
  urlPattern: 'https://www.1pondo.tv/movies/{id}/',
  idFormat: 'MMDDYY_NNN',
  startId: '120624_001', // Current date
  endId: '010115_001', // Go back to 2015
  reverseMode: true,
  maxConcurrent: 3,
};

// ============================================================
// 1pondo JSON API
// ============================================================

interface IppondoJsonData {
  ActressesJa?: string[];
  Title?: string;
  Desc?: string;
  Release?: string;
  ThumbHigh?: string;
  ThumbUltra?: string;
  ThumbMed?: string;
}

async function fetch1pondoJsonData(productId: string): Promise<{
  actors?: string[];
  title?: string;
  description?: string;
  releaseDate?: string;
  imageUrl?: string;
  sampleImages?: string[];
} | null> {
  try {
    const apiUrl = `https://www.1pondo.tv/dyn/phpauto/movie_details/movie_id/${productId}.json`;
    console.log(`    🔍 Fetching 一本道 JSON API: ${apiUrl}`);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.log(`    ⚠️  JSON API not found for ${productId}`);
      return null;
    }

    const jsonData: IppondoJsonData = await response.json();

    // Extract actress names
    const actors: string[] = jsonData.ActressesJa || [];

    // Extract other data
    const title = jsonData.Title || undefined;
    const description = jsonData.Desc || undefined;

    // Parse release date from Release (format: "2025-11-23 10:00:00")
    let releaseDate: string | undefined;
    if (jsonData.Release) {
      const dateMatch = jsonData.Release.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        releaseDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      }
    }

    // Extract thumbnail URL
    const imageUrl =
      jsonData.ThumbHigh || jsonData.ThumbUltra || jsonData.ThumbMed || undefined;

    // Fetch gallery.zip for sample images
    const galleryZipUrl = `https://www.1pondo.tv/assets/sample/${productId}/gallery.zip`;
    const sampleImages = await fetchGalleryZip(galleryZipUrl, productId);

    console.log(
      `    ✓ JSON API data: ${actors.length} actress(es), title: ${title?.substring(0, 30)}...`
    );

    return {
      actors: actors.length > 0 ? actors : undefined,
      title,
      description,
      releaseDate,
      imageUrl,
      sampleImages: sampleImages.length > 0 ? sampleImages : undefined,
    };
  } catch (error) {
    console.error(`    ❌ Error fetching 一本道 JSON API:`, error);
    return null;
  }
}

// ============================================================
// 1pondo Crawler Class
// ============================================================

class IppondoCrawler extends DTIBaseCrawler {
  constructor() {
    super(IPPONDO_CONFIG);
  }

  async parseHtmlContent(
    html: string,
    productId: string
  ): Promise<ParsedProductData | null> {
    // 一本道 uses JSON API as primary source
    const jsonData = await fetch1pondoJsonData(productId);

    if (jsonData && jsonData.title) {
      console.log(`    ✓ Using JSON API data for 一本道 product ${productId}`);

      // Parse price from HTML
      const { price, saleInfo } = extractPrice(html);

      // Validate actors
      const actors = jsonData.actors
        ?.map((name) => normalizePerformerName(name))
        .filter(
          (name): name is string =>
            name !== null && isValidPerformerForProduct(name, jsonData.title)
        );

      // Sample video URL pattern for 1pondo
      const sampleVideoUrl = `https://smovie.1pondo.tv/sample/movies/${productId}/1080p.mp4`;

      return {
        title: jsonData.title,
        description: jsonData.description,
        actors,
        releaseDate: jsonData.releaseDate,
        imageUrl: jsonData.imageUrl,
        sampleImages: jsonData.sampleImages,
        sampleVideoUrl,
        price,
        saleInfo,
      };
    }

    // JSON API failed - skip to avoid invalid data
    console.log(
      `    ⚠️  一本道 JSON API failed for ${productId}, skipping to avoid invalid data`
    );
    return null;
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
  console.log('一本道 Crawler');
  console.log('========================================\n');

  const options = parseArgs();
  const crawler = new IppondoCrawler();

  try {
    await crawler.crawl(options);
    console.log('\n========================================');
    console.log('一本道 Crawl Completed!');
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

export { IppondoCrawler, IPPONDO_CONFIG };
