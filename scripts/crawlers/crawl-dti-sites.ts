/**
 * DTI sites crawler script
 * Crawls product pages directly from DTI affiliated sites
 * Run with: npx tsx scripts/crawl-dti-sites.ts
 *
 * Required environment variables:
 * - DATABASE_URL: PostgreSQL connection string
 */

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  console.error('Please set DATABASE_URL before running this script:');
  console.error('  export DATABASE_URL="postgresql://user:password@host:port/database"');
  process.exit(1);
}

import { createHash } from 'crypto';
import { getDb } from '../../lib/db/index';
import { products, performers, productPerformers, tags, productTags, productSources, rawHtmlData, productImages, productVideos } from '../../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import iconv from 'iconv-lite';
import { generateDTILink } from '../../lib/affiliate';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../../lib/performer-validation';
import { validateProductData } from '../../lib/crawler-utils';

/**
 * Detect encoding from HTML content or response headers
 */
function detectEncoding(buffer: Buffer, contentType?: string, url?: string): string {
  // Check Content-Type header first
  if (contentType) {
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch) {
      return charsetMatch[1].toLowerCase();
    }
  }

  // URL-based detection for known DTI sites (they use EUC-JP)
  if (url) {
    if (url.includes('caribbeancompr.com') ||
        url.includes('caribbeancom.com') ||
        url.includes('1pondo.tv') ||
        url.includes('heyzo.com')) {
      return 'euc-jp';
    }
  }

  // Try to detect from HTML meta tags (check first 4096 bytes)
  // Use 'latin1' to preserve raw bytes without corruption
  const head = buffer.slice(0, 4096).toString('latin1');

  // Pattern 1: <meta charset="xxx">
  const charsetMatch1 = head.match(/<meta\s+charset=["']?([^"'\s>]+)/i);
  if (charsetMatch1) {
    return charsetMatch1[1].toLowerCase();
  }

  // Pattern 2: <meta http-equiv="Content-Type" content="text/html; charset=xxx">
  const charsetMatch2 = head.match(/content=["'][^"']*charset=([^"'\s;]+)/i);
  if (charsetMatch2) {
    return charsetMatch2[1].toLowerCase();
  }

  // Default to UTF-8
  return 'utf-8';
}

/**
 * Decode buffer to string with proper encoding
 */
function decodeHtml(buffer: Buffer, contentType?: string, url?: string): string {
  const encoding = detectEncoding(buffer, contentType, url);
  console.log(`    🔤 Detected encoding: ${encoding} for ${url?.substring(0, 50) || 'unknown'}`);

  // Normalize encoding names
  const normalizedEncoding = encoding
    .replace('shift_jis', 'shift-jis')
    .replace('shift-jis', 'Shift_JIS')
    .replace('sjis', 'Shift_JIS')
    .replace('euc-jp', 'EUC-JP')
    .replace('eucjp', 'EUC-JP');

  try {
    if (normalizedEncoding.toLowerCase() === 'utf-8' || normalizedEncoding.toLowerCase() === 'utf8') {
      return buffer.toString('utf-8');
    }
    // Use iconv-lite for other encodings
    return iconv.decode(buffer, normalizedEncoding);
  } catch (error) {
    console.warn(`Failed to decode with ${normalizedEncoding}, falling back to UTF-8`);
    return buffer.toString('utf-8');
  }
}

interface CrawlConfig {
  siteName: string;
  siteId: string;
  baseUrl: string;
  urlPattern: string;
  idFormat: 'MMDDYY_NNN' | 'MMDDYY_NNNN' | 'NNNN';
  startId?: string;
  endId?: string;
  maxConcurrent?: number;
  reverseMode?: boolean; // True = 過去に向かって遡る、False = 未来に向かって進む
}

const CRAWL_CONFIGS: CrawlConfig[] = [
  {
    siteName: 'カリビアンコムプレミアム',
    siteId: '2477',
    baseUrl: 'https://www.caribbeancompr.com',
    urlPattern: 'https://www.caribbeancompr.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '112024_001', // Start from recent date: Nov 20, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: '一本道',
    siteId: '2470',
    baseUrl: 'https://www.1pondo.tv',
    urlPattern: 'https://www.1pondo.tv/movies/{id}/',
    idFormat: 'MMDDYY_NNN',
    startId: '112024_001', // Start from recent date: Nov 20, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: 'カリビアンコム',
    siteId: '2478',
    baseUrl: 'https://www.caribbeancom.com',
    urlPattern: 'https://www.caribbeancom.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '112024_001', // Start from recent date: Nov 20, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: 'HEYZO',
    siteId: '2665',
    baseUrl: 'https://www.heyzo.com',
    urlPattern: 'https://www.heyzo.com/moviepages/{id}/index.html',
    idFormat: 'NNNN',
    startId: '0001', // Start from the very first
    endId: '9999', // Go up to maximum
    maxConcurrent: 3,
  },
  {
    siteName: '天然むすめ',
    siteId: '2471',
    baseUrl: 'https://www.10musume.com',
    urlPattern: 'https://www.10musume.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001', // Start from Jan 1, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: 'パコパコママ',
    siteId: '2472',
    baseUrl: 'https://www.pacopacomama.com',
    urlPattern: 'https://www.pacopacomama.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001', // Start from Jan 1, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: '人妻斬り',
    siteId: '2473',
    baseUrl: 'https://www.hitozuma-giri.com',
    urlPattern: 'https://www.hitozuma-giri.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001', // Start from Jan 1, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: 'エッチな0930',
    siteId: '2474',
    baseUrl: 'https://www.av-e-body.com',
    urlPattern: 'https://www.av-e-body.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001', // Start from Jan 1, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: 'エッチな4610',
    siteId: '2475',
    baseUrl: 'https://www.av-4610.com',
    urlPattern: 'https://www.av-4610.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001', // Start from Jan 1, 2024
    endId: '010115_001', // Go back to Jan 1, 2015 (10 years of data)
    reverseMode: true, // 過去に向かって遡る
    maxConcurrent: 3,
  },
  {
    siteName: 'Hey動画',
    siteId: '3001',
    baseUrl: 'https://www.heyzo.com',
    urlPattern: 'https://www.heyzo.com/moviepages/{id}/index.html',
    idFormat: 'NNNN',
    startId: '0001',
    endId: '9999',
    maxConcurrent: 3,
  },
  {
    siteName: '金髪天國',
    siteId: '2476',
    baseUrl: 'https://www.kin8tengoku.com',
    urlPattern: 'https://www.kin8tengoku.com/moviepages/{id}/index.html',
    idFormat: 'NNNN',
    startId: '0001',
    endId: '9999',
    maxConcurrent: 3,
  },
  {
    siteName: '女体のしんぴ',
    siteId: '2690',
    baseUrl: 'https://www.nyoshin.com',
    urlPattern: 'https://www.nyoshin.com/moviepages/n{id}/index.html',
    idFormat: 'NNNN',
    startId: '0001',
    endId: '9999',
    maxConcurrent: 3,
  },
  {
    siteName: 'NOZOX',
    siteId: '3002',
    baseUrl: 'https://www.nozox.com',
    urlPattern: 'https://www.nozox.com/moviepages/{id}/index.html',
    idFormat: 'NNNN',
    startId: '0001',
    endId: '9999',
    maxConcurrent: 3,
  },
  {
    siteName: 'エッチな0930WORLD',
    siteId: '3003',
    baseUrl: 'https://www.av-e-body.com',
    urlPattern: 'https://www.av-e-body.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
  {
    siteName: 'エッチな0230',
    siteId: '3004',
    baseUrl: 'https://www.av-0230.com',
    urlPattern: 'https://www.av-0230.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
  {
    siteName: 'うんこたれ',
    siteId: '3005',
    baseUrl: 'https://www.unkotare.com',
    urlPattern: 'https://www.unkotare.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
  {
    siteName: '3D-EROS.NET',
    siteId: '3006',
    baseUrl: 'https://www.3d-eros.net',
    urlPattern: 'https://www.3d-eros.net/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
  {
    siteName: 'Pikkur',
    siteId: '3007',
    baseUrl: 'https://www.pikkur.com',
    urlPattern: 'https://www.pikkur.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
  {
    siteName: 'Javholic',
    siteId: '3008',
    baseUrl: 'https://www.javholic.com',
    urlPattern: 'https://www.javholic.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    startId: '010124_001',
    endId: '010115_001',
    reverseMode: true,
    maxConcurrent: 3,
  },
];

/**
 * Generate next ID based on format
 */
function generateNextId(currentId: string, format: string, reverse: boolean = false): string | null {
  if (format === 'NNNN') {
    // Simple numeric increment: 0001 -> 0002 -> ... -> 9999
    const num = parseInt(currentId);
    if (reverse) {
      if (num <= 1) return null;
      return String(num - 1).padStart(4, '0');
    } else {
      if (num >= 9999) return null;
      return String(num + 1).padStart(4, '0');
    }
  }

  if (format === 'MMDDYY_NNN' || format === 'MMDDYY_NNNN') {
    // Date-based format: MMDDYY_NNN or MMDDYY_NNNN
    const [datePart, seqPart] = currentId.split('_');
    const maxSeq = format === 'MMDDYY_NNN' ? 10 : 20; // 1日のリリース数は多くても10-20本程度
    const seqLen = format === 'MMDDYY_NNN' ? 3 : 4;

    const seq = parseInt(seqPart);

    if (reverse) {
      // 逆方向: シーケンス番号をインクリメント（001→002→...→010まで）
      // その日のリリースを全てチェックしてから前日へ
      if (seq < maxSeq) {
        return `${datePart}_${String(seq + 1).padStart(seqLen, '0')}`;
      }

      // 前日に移動（001から開始）
      const mm = parseInt(datePart.substring(0, 2));
      const dd = parseInt(datePart.substring(2, 4));
      const yy = parseInt(datePart.substring(4, 6));

      const date = new Date(2000 + yy, mm - 1, dd);
      date.setDate(date.getDate() - 1);

      // 2000年より前には行かない
      if (date.getFullYear() < 2000) return null;

      const prevMM = String(date.getMonth() + 1).padStart(2, '0');
      const prevDD = String(date.getDate()).padStart(2, '0');
      const prevYY = String(date.getFullYear() % 100).padStart(2, '0');

      return `${prevMM}${prevDD}${prevYY}_${String(1).padStart(seqLen, '0')}`;
    } else {
      // 順方向: シーケンス番号をインクリメント
      if (seq < maxSeq) {
        return `${datePart}_${String(seq + 1).padStart(seqLen, '0')}`;
      }

      // 翌日に移動
      const mm = parseInt(datePart.substring(0, 2));
      const dd = parseInt(datePart.substring(2, 4));
      const yy = parseInt(datePart.substring(4, 6));

      const date = new Date(2000 + yy, mm - 1, dd);
      date.setDate(date.getDate() + 1);

      // Stop if we've reached current date
      const now = new Date();
      if (date > now) return null;

      const nextMM = String(date.getMonth() + 1).padStart(2, '0');
      const nextDD = String(date.getDate()).padStart(2, '0');
      const nextYY = String(date.getFullYear() % 100).padStart(2, '0');

      return `${nextMM}${nextDD}${nextYY}_${String(1).padStart(seqLen, '0')}`;
    }
  }

  return null;
}

/**
 * Fetch gallery.zip for sample images (generic function for all DTI sites)
 */
async function fetchGalleryZip(galleryZipUrl: string, productId: string): Promise<string[]> {
  const sampleImages: string[] = [];

  try {
    console.log(`    🔍 Fetching gallery.zip: ${galleryZipUrl}`);
    const zipResponse = await fetch(galleryZipUrl);

    if (zipResponse.ok) {
      const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      // Extract base URL from galleryZipUrl by removing '/gallery.zip'
      const baseImageUrl = galleryZipUrl.replace(/\/gallery\.zip$/, '');

      for (const entry of zipEntries) {
        if (!entry.isDirectory && entry.entryName.match(/\.(jpg|jpeg|png)$/i)) {
          // Construct full URL for each image
          const imageUrl = `${baseImageUrl}/${entry.entryName}`;
          sampleImages.push(imageUrl);
        }
      }
      console.log(`    ✓ Extracted ${sampleImages.length} sample images from gallery.zip`);
    } else {
      console.log(`    ⚠️  Gallery.zip not available (${zipResponse.status})`);
    }
  } catch (error) {
    console.log(`    ⚠️  Could not fetch gallery.zip: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return sampleImages;
}

/**
 * Fetch actress data from 一本道 JSON API
 */
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

    const jsonData = await response.json();

    // Extract actress names from ActressesJa array
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
    const imageUrl = jsonData.ThumbHigh || jsonData.ThumbUltra || jsonData.ThumbMed || undefined;

    // Fetch gallery.zip for sample images
    const galleryZipUrl = `https://www.1pondo.tv/assets/sample/${productId}/gallery.zip`;
    const sampleImages = await fetchGalleryZip(galleryZipUrl, productId);

    console.log(`    ✓ JSON API data: ${actors.length} actress(es), title: ${title?.substring(0, 30)}...`);

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

/**
 * Parse HTML content and extract basic info
 */
async function parseHtmlContent(html: string, siteName: string, productId?: string): Promise<{
  title?: string;
  description?: string;
  actors?: string[];
  releaseDate?: string;
  imageUrl?: string;
  sampleImages?: string[];
  sampleVideoUrl?: string;
  price?: number;
} | null> {
  try {
    // For 一本道, fetch data from JSON API first (required)
    if (siteName === '一本道' && productId) {
      const jsonData = await fetch1pondoJsonData(productId);
      if (jsonData && jsonData.title) {
        // JSON API succeeded, use it as primary source
        console.log(`    ✓ Using JSON API data for 一本道 product ${productId}`);

        // Still parse HTML for price if needed
        let price: number | undefined;
        const priceMatch = html.match(/var\s+ec_price\s*=\s*parseFloat\s*\(\s*['"](\d+(?:\.\d+)?)['"]\s*\)/);
        if (priceMatch) {
          const usdPrice = parseFloat(priceMatch[1]);
          price = Math.round(usdPrice * 150);
        }

        return {
          ...jsonData,
          price: price || jsonData.price,
        };
      } else {
        // JSON API failed for 一本道 - skip this product to avoid invalid data
        console.log(`    ⚠️  一本道 JSON API failed for ${productId}, skipping to avoid invalid data`);
        return null;
      }
    }

    // Basic HTML parsing with regex (simplified)
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);

    // Site name suffixes to remove from title
    const siteSuffixes = [
      /\s*\|\s*美を追求する高画質アダルト動画サイト$/,
      /\s*\|\s*高画質無修正動画サイト$/,
      /\s*\|\s*カリビアンコムプレミアム$/,
      /\s*\|\s*カリビアンコム$/,
      /\s*\|\s*HEYZO$/,
      /\s*\|\s*一本道$/,
    ];

    // Invalid titles (site name only, no actual product title)
    const invalidTitlePatterns = [
      /^一本道$/,
      /^カリビアンコム$/,
      /^カリビアンコムプレミアム$/,
      /^HEYZO$/,
    ];

    // Extract and clean title
    let rawTitle = titleMatch ? titleMatch[1].trim() : undefined;

    // Remove site suffixes to get the actual product title
    if (rawTitle) {
      for (const suffix of siteSuffixes) {
        rawTitle = rawTitle.replace(suffix, '').trim();
      }
    }

    // Check if title is valid (not just site name)
    const isInvalidTitle = rawTitle && invalidTitlePatterns.some(pattern => pattern.test(rawTitle));

    if (isInvalidTitle || !rawTitle || rawTitle.length < 3) {
      console.log(`    ⚠️  Invalid title detected (site name only or too short): "${rawTitle?.substring(0, 50)}..."`);
      return null; // Skip this product - need proper data from JSON API or different source
    }

    // Extract price (DTI sites use USD)
    // Pattern 1: var ec_price = parseFloat('50.00');
    let price: number | undefined;
    const priceMatch = html.match(/var\s+ec_price\s*=\s*parseFloat\s*\(\s*['"](\d+(?:\.\d+)?)['"]\s*\)/);
    if (priceMatch) {
      const usdPrice = parseFloat(priceMatch[1]);
      // Convert USD to JPY (approximate rate: 150)
      price = Math.round(usdPrice * 150);
    }

    // Pattern 2: ec_item_price = '50.00' or similar
    if (!price) {
      const itemPriceMatch = html.match(/ec_item_price\s*=\s*['"]?(\d+(?:\.\d+)?)['"]?/);
      if (itemPriceMatch) {
        const usdPrice = parseFloat(itemPriceMatch[1]);
        price = Math.round(usdPrice * 150);
      }
    }

    // Pattern 3: Japanese yen price ¥1,980 or 1,980円
    if (!price) {
      const yenMatch = html.match(/[¥￥]?\s*(\d{1,3}(?:,\d{3})*)\s*円/);
      if (yenMatch) {
        price = parseInt(yenMatch[1].replace(/,/g, ''));
      }
    }

    // Try to extract actor names from multiple patterns
    let rawActors: string[] = [];

    // Pattern 1: JavaScript variable ec_item_brand (カリビアンコム系)
    const brandMatch = html.match(/var\s+ec_item_brand\s*=\s*['"]([^'"]+)['"]/);
    if (brandMatch && brandMatch[1]) {
      rawActors = [brandMatch[1]];
    }

    // Pattern 2: Title format "女優名 【ふりがな】 タイトル" (HEYZO系)
    if (rawActors.length === 0 && titleMatch) {
      const titleActorMatch = titleMatch[1].match(/^([^\s【]+)\s*【[^】]+】/);
      if (titleActorMatch) {
        rawActors = [titleActorMatch[1]];
      }
    }

    // Pattern 3: HTML content with 出演者 label
    if (rawActors.length === 0) {
      const actorMatches = html.match(/出演者?[:：]?\s*([^<\n]+)/i);
      if (actorMatches) {
        rawActors = actorMatches[1].split(/[、,]/).map(a => a.trim()).filter(a => a);
      }
    }

    // Apply performer validation (filter out invalid names)
    const actors = rawActors
      .map(name => normalizePerformerName(name))
      .filter((name): name is string => name !== null && isValidPerformerForProduct(name, rawTitle));

    // Try to extract release date
    const dateMatch = html.match(/配信日[:：]?\s*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
    const releaseDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}` : undefined;

    // Try to extract thumbnail
    const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    // Extract sample images (multiple patterns for DTI sites)
    const sampleImages: string[] = [];

    // Pattern 1: Sample image gallery members (カリビアンコム系)
    const memberGalleryMatches = html.matchAll(/<a[^>]*href=["']([^"']*members[^"']*gallery[^"']*\.jpg)["']/gi);
    for (const match of memberGalleryMatches) {
      if (!sampleImages.includes(match[1])) {
        sampleImages.push(match[1]);
      }
    }

    // Pattern 2: Movie thumb images
    const movieThumbMatches = html.matchAll(/<img[^>]*src=["']([^"']*moviepages[^"']*\.jpg)["']/gi);
    for (const match of movieThumbMatches) {
      if (!sampleImages.includes(match[1])) {
        sampleImages.push(match[1]);
      }
    }

    // Pattern 3: Sample image links (一本道系)
    const sampleLinkMatches = html.matchAll(/<a[^>]*href=["']([^"']*\/posters\/[^"']*\.jpg)["']/gi);
    for (const match of sampleLinkMatches) {
      if (!sampleImages.includes(match[1])) {
        sampleImages.push(match[1]);
      }
    }

    // Pattern 4: HEYZO sample images
    const heyzoMatches = html.matchAll(/<img[^>]*src=["']([^"']*\/contents\/[^"']*sample[^"']*\.jpg)["']/gi);
    for (const match of heyzoMatches) {
      if (!sampleImages.includes(match[1])) {
        sampleImages.push(match[1]);
      }
    }

    // Pattern 5: Generic sample image patterns
    const genericSampleMatches = html.matchAll(/<img[^>]*src=["']([^"']*sample[^"']*\.jpg)["']/gi);
    for (const match of genericSampleMatches) {
      const url = match[1];
      if (!sampleImages.includes(url) && url !== imageUrl) {
        sampleImages.push(url);
      }
    }

    // Try fetching gallery.zip for sites that support it (if productId is available)
    if (productId) {
      let galleryZipUrl: string | null = null;

      // Determine gallery.zip URL based on site name
      switch (siteName) {
        case '天然むすめ':
          galleryZipUrl = `https://www.10musume.com/assets/sample/${productId}/gallery.zip`;
          break;
        case 'パコパコママ':
          galleryZipUrl = `https://www.pacopacomama.com/assets/sample/${productId}/gallery.zip`;
          break;
        case 'カリビアンコムプレミアム':
          galleryZipUrl = `https://www.caribbeancompr.com/moviepages/${productId}/gallery.zip`;
          break;
        case 'HEYZO':
          galleryZipUrl = `https://www.heyzo.com/moviepages/${productId}/gallery.zip`;
          break;
        case '金髪天國':
          galleryZipUrl = `https://www.kin8tengoku.com/moviepages/${productId}/gallery.zip`;
          break;
        case '女体のしんぴ':
          galleryZipUrl = `https://www.nyoshin.com/moviepages/n${productId}/gallery.zip`;
          break;
        case '人妻斬り':
          galleryZipUrl = `https://www.hitozuma-giri.com/moviepages/${productId}/gallery.zip`;
          break;
        case 'エッチな0930':
          galleryZipUrl = `https://www.av-e-body.com/moviepages/${productId}/gallery.zip`;
          break;
        case 'エッチな4610':
          galleryZipUrl = `https://www.av-4610.com/moviepages/${productId}/gallery.zip`;
          break;
        case 'エッチな0230':
          galleryZipUrl = `https://www.av-0230.com/moviepages/${productId}/gallery.zip`;
          break;
        case 'うんこたれ':
          galleryZipUrl = `https://www.unkotare.com/moviepages/${productId}/gallery.zip`;
          break;
      }

      if (galleryZipUrl) {
        const galleryImages = await fetchGalleryZip(galleryZipUrl, productId);
        // Append gallery images to sampleImages (avoid duplicates)
        for (const img of galleryImages) {
          if (!sampleImages.includes(img)) {
            sampleImages.push(img);
          }
        }
      }
    }

    // Extract sample video URL
    let sampleVideoUrl: string | undefined;

    // Pattern 1: Video source tag
    const videoSrcMatch = html.match(/<source[^>]*src=["']([^"']+\.mp4)["']/i);
    if (videoSrcMatch) {
      sampleVideoUrl = videoSrcMatch[1];
    }

    // Pattern 2: Sample movie player URLs (DTI sites)
    if (!sampleVideoUrl) {
      const sampleMovieMatch = html.match(/sample[_-]?movie[^"']*\.mp4|[^"']*sample[^"']*\.mp4/i);
      if (sampleMovieMatch) {
        const fullMatch = html.match(/["']([^"']*sample[^"']*\.mp4)["']/i);
        if (fullMatch) {
          sampleVideoUrl = fullMatch[1];
        }
      }
    }

    // Pattern 3: JavaScript variable for sample movie URL
    if (!sampleVideoUrl) {
      const jsSampleMatch = html.match(/(?:sample_?url|movie_?url|video_?url)\s*[=:]\s*["']([^"']+\.mp4)["']/i);
      if (jsSampleMatch) {
        sampleVideoUrl = jsSampleMatch[1];
      }
    }

    // Pattern 4: data-video-url attribute
    if (!sampleVideoUrl) {
      const dataVideoMatch = html.match(/data-video-url=["']([^"']+\.mp4)["']/i);
      if (dataVideoMatch) {
        sampleVideoUrl = dataVideoMatch[1];
      }
    }

    // Pattern 5: 1pondo/Caribbeancom specific sample URL pattern
    if (!sampleVideoUrl && productId) {
      // Try known sample video URL patterns for DTI sites
      const samplePatterns = [
        `https://smovie.1pondo.tv/sample/movies/${productId}/1080p.mp4`,
        `https://www.caribbeancom.com/moviepages/${productId}/sample/sample.mp4`,
        `https://www.caribbeancompr.com/moviepages/${productId}/sample/sample.mp4`,
        `https://www.heyzo.com/moviepages/${productId}/sample/sample.mp4`,
      ];

      // Check which pattern matches the site
      if (siteName === '一本道') {
        sampleVideoUrl = `https://smovie.1pondo.tv/sample/movies/${productId}/1080p.mp4`;
      } else if (siteName === 'カリビアンコム') {
        sampleVideoUrl = `https://www.caribbeancom.com/moviepages/${productId}/sample/sample.mp4`;
      } else if (siteName === 'カリビアンコムプレミアム') {
        sampleVideoUrl = `https://www.caribbeancompr.com/moviepages/${productId}/sample/sample.mp4`;
      } else if (siteName === 'HEYZO') {
        sampleVideoUrl = `https://www.heyzo.com/moviepages/${productId}/sample/sample.mp4`;
      }
    }

    return {
      title: titleMatch ? titleMatch[1].replace(/\s*-.*$/, '').trim() : undefined,
      description: descMatch ? descMatch[1].trim() : undefined,
      actors,
      releaseDate,
      imageUrl,
      sampleImages: sampleImages.length > 0 ? sampleImages : undefined,
      sampleVideoUrl,
      price,
    };
  } catch (error) {
    console.error(`Error parsing HTML:`, error);
    return null;
  }
}

/**
 * Save product images to product_images table
 */
async function saveProductImages(
  productId: number,
  thumbnailUrl?: string,
  sampleImages?: string[],
  siteName?: string,
): Promise<void> {
  if (!thumbnailUrl && (!sampleImages || sampleImages.length === 0)) {
    return;
  }

  const db = getDb();

  try {
    // Save thumbnail as first image
    if (thumbnailUrl) {
      const existing = await db
        .select()
        .from(productImages)
        .where(
          and(
            eq(productImages.productId, productId),
            eq(productImages.imageUrl, thumbnailUrl),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(productImages).values({
          productId,
          imageUrl: thumbnailUrl,
          imageType: 'thumbnail',
          displayOrder: 0,
          aspName: 'DTI',
        });
        console.log(`    💾 Saved thumbnail to product_images`);
      }
    }

    // Save sample images
    if (sampleImages && sampleImages.length > 0) {
      let savedCount = 0;
      for (let i = 0; i < sampleImages.length; i++) {
        const imageUrl = sampleImages[i];

        const existing = await db
          .select()
          .from(productImages)
          .where(
            and(
              eq(productImages.productId, productId),
              eq(productImages.imageUrl, imageUrl),
            ),
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(productImages).values({
            productId,
            imageUrl,
            imageType: 'sample',
            displayOrder: i + 1,
            aspName: 'DTI',
          });
          savedCount++;
        }
      }
      if (savedCount > 0) {
        console.log(`    💾 Saved ${savedCount} sample image(s) to product_images`);
      }
    }
  } catch (error) {
    console.error(`    ❌ Error saving product images:`, error);
  }
}

/**
 * Save sample video to product_videos table
 */
async function saveProductVideo(
  productId: number,
  sampleVideoUrl?: string,
): Promise<void> {
  if (!sampleVideoUrl) {
    return;
  }

  const db = getDb();

  try {
    // 既存チェック
    const existing = await db
      .select()
      .from(productVideos)
      .where(
        and(
          eq(productVideos.productId, productId),
          eq(productVideos.videoUrl, sampleVideoUrl),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(productVideos).values({
        productId,
        videoUrl: sampleVideoUrl,
        videoType: 'sample',
        aspName: 'DTI',
        displayOrder: 0,
      });
      console.log(`    🎬 Saved sample video to product_videos`);
    }
  } catch (error) {
    console.error(`    ❌ Error saving product video:`, error);
  }
}

/**
 * Crawl a single site configuration
 */
async function crawlSite(config: CrawlConfig & { limit?: number}) {
  console.log(`\nStarting crawl for ${config.siteName}...`);
  console.log(`URL Pattern: ${config.urlPattern}`);
  console.log(`Starting from ID: ${config.startId}\n`);

  const db = getDb();
  let currentId = config.startId!;
  let foundCount = 0;
  let notFoundCount = 0;
  let importedCount = 0;
  let skippedCount = 0;
  let consecutiveNotFound = 0;
  const MAX_CONSECUTIVE_NOT_FOUND = 50; // Stop after 50 consecutive 404s

  while (currentId) {
    // Stop if limit is reached
    if (config.limit && foundCount >= config.limit) {
      console.log(`Reached limit: ${config.limit} products found`);
      break;
    }

    // Stop if end ID is specified and reached
    if (config.endId) {
      if (config.reverseMode && currentId < config.endId) {
        console.log(`Reached end ID: ${config.endId}`);
        break;
      } else if (!config.reverseMode && currentId > config.endId) {
        console.log(`Reached end ID: ${config.endId}`);
        break;
      }
    }

    // Stop if too many consecutive not found
    if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
      console.log(`Stopping: ${MAX_CONSECUTIVE_NOT_FOUND} consecutive products not found`);
      break;
    }

    const url = config.urlPattern.replace('{id}', currentId);

    // 既に生データが存在するかチェック
    const existingRawHtml = await db
      .select()
      .from(rawHtmlData)
      .where(
        and(
          eq(rawHtmlData.source, config.siteName),
          eq(rawHtmlData.productId, currentId)
        )
      )
      .limit(1);

    let shouldFetch = true;
    let htmlContent = '';

    if (existingRawHtml.length > 0) {
      // 既存の生データを使用
      htmlContent = existingRawHtml[0].htmlContent;
      shouldFetch = false;
      console.log(`  ⚡ Using cached HTML: ${currentId}`);
    }

    // Fetch product page (if needed)
    let productData = null;
    if (shouldFetch) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          notFoundCount++;
          consecutiveNotFound++;

          // Log every 10 not found
          if (notFoundCount % 10 === 0) {
            console.log(`  Progress: ${foundCount} found, ${notFoundCount} not found (current: ${currentId})`);
          }

          // Generate next ID
          const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
          if (!nextId) break;
          currentId = nextId;

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || undefined;
        htmlContent = decodeHtml(buffer, contentType, url);

        // 生データのハッシュを計算
        const hash = createHash('sha256').update(htmlContent).digest('hex');

        // 生データを保存
        await db.insert(rawHtmlData).values({
          source: config.siteName,
          productId: currentId,
          url,
          htmlContent,
          hash,
        });

        console.log(`  💾 Saved HTML: ${currentId}`);
      } catch (error) {
        console.error(`  ❌ Error fetching ${currentId}:`, error);
        notFoundCount++;
        consecutiveNotFound++;

        // Generate next ID
        const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
        if (!nextId) break;
        currentId = nextId;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
    }

    // Parse HTML content
    productData = await parseHtmlContent(htmlContent, config.siteName, currentId);

    if (!productData || !productData.title) {
      notFoundCount++;
      consecutiveNotFound++;

      // Log every 10 not found
      if (notFoundCount % 10 === 0) {
        console.log(`  Progress: ${foundCount} found, ${notFoundCount} not found (current: ${currentId})`);
      }
    } else {
      foundCount++;
      consecutiveNotFound = 0; // Reset consecutive counter

      console.log(`  ✓ Found: ${currentId} - ${productData.title?.substring(0, 50)}...`);

      // 共通バリデーションを実行
      const validation = validateProductData({
        title: productData.title,
        description: productData.description,
        aspName: 'DTI',
        originalId: currentId,
      });

      if (!validation.isValid) {
        console.log(`  ⚠️ バリデーションスキップ: ${validation.reason}`);
        // Generate next ID
        const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
        if (!nextId) break;
        currentId = nextId;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      try {
        const normalizedProductId = `${config.siteName}-${currentId}`;

        // Check if product already exists
        const existingProduct = await db
          .select()
          .from(products)
          .where(eq(products.normalizedProductId, normalizedProductId))
          .limit(1);

        let productId: number;

        if (existingProduct.length > 0) {
          productId = existingProduct[0].id;
          skippedCount++;
        } else {
          // Insert into products
          const [insertedProduct] = await db
            .insert(products)
            .values({
              normalizedProductId,
              title: productData.title,
              description: productData.description || '',
              releaseDate: productData.releaseDate,
              defaultThumbnailUrl: productData.imageUrl,
            })
            .returning({ id: products.id });

          productId = insertedProduct.id;

          // Generate affiliate URL using clear-tv.com format
          const affiliateUrl = generateDTILink(url);

          // Insert into product_sources
          await db.insert(productSources).values({
            productId,
            aspName: 'DTI',
            originalProductId: currentId,
            affiliateUrl: affiliateUrl,
            price: productData.price || 0,
            dataSource: 'CRAWL',
          });

          // Save images to product_images table
          await saveProductImages(productId, productData.imageUrl, productData.sampleImages, config.siteName);

          // Save sample video to product_videos table
          await saveProductVideo(productId, productData.sampleVideoUrl);

          // Insert actors
          if (productData.actors && productData.actors.length > 0) {
            for (const actorName of productData.actors) {
              if (!actorName) continue;

              const existingPerformer = await db
                .select()
                .from(performers)
                .where(eq(performers.name, actorName))
                .limit(1);

              let performerId: number;

              if (existingPerformer.length > 0) {
                performerId = existingPerformer[0].id;
              } else {
                const [insertedPerformer] = await db
                  .insert(performers)
                  .values({ name: actorName })
                  .returning({ id: performers.id });

                performerId = insertedPerformer.id;
              }

              // Link product to performer
              const existingLink = await db
                .select()
                .from(productPerformers)
                .where(
                  and(
                    eq(productPerformers.productId, productId),
                    eq(productPerformers.performerId, performerId)
                  )
                )
                .limit(1);

              if (existingLink.length === 0) {
                await db.insert(productPerformers).values({
                  productId,
                  performerId,
                });
              }
            }
          }

          // Link to site tag
          const existingSiteTag = await db
            .select()
            .from(tags)
            .where(eq(tags.name, config.siteName))
            .limit(1);

          if (existingSiteTag.length > 0) {
            const tagId = existingSiteTag[0].id;

            const existingTagLink = await db
              .select()
              .from(productTags)
              .where(
                and(
                  eq(productTags.productId, productId),
                  eq(productTags.tagId, tagId)
                )
              )
              .limit(1);

            if (existingTagLink.length === 0) {
              await db.insert(productTags).values({
                productId,
                tagId,
              });
            }
          }

          importedCount++;

          // 生データの処理完了をマーク
          if (existingRawHtml.length > 0) {
            await db
              .update(rawHtmlData)
              .set({ processedAt: new Date() })
              .where(eq(rawHtmlData.id, existingRawHtml[0].id));
          } else {
            // 新規保存したデータにも処理完了をマーク
            await db
              .update(rawHtmlData)
              .set({ processedAt: new Date() })
              .where(
                and(
                  eq(rawHtmlData.source, config.siteName),
                  eq(rawHtmlData.productId, currentId)
                )
              );
          }
        }
      } catch (error) {
        console.error(`  ❌ Error importing ${currentId}:`, error);
      }
    }

    // Generate next ID
    const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
    if (!nextId) break;
    currentId = nextId;

    // Rate limiting - wait between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n${config.siteName} - Crawl Summary:`);
  console.log(`  ✓ Found: ${foundCount}`);
  console.log(`  ✓ Imported: ${importedCount}`);
  console.log(`  ⚠️  Skipped: ${skippedCount}`);
  console.log(`  ⚠️  Not Found: ${notFoundCount}`);
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    site?: string;
    start?: string;
    limit?: number;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--site' && i + 1 < args.length) {
      options.site = args[i + 1];
      i++;
    } else if (arg === '--start' && i + 1 < args.length) {
      options.start = args[i + 1];
      i++;
    } else if (arg === '--limit' && i + 1 < args.length) {
      options.limit = parseInt(args[i + 1]);
      i++;
    }
  }

  return options;
}

/**
 * Find config by site name or alias
 */
function findConfigBySite(siteName: string): CrawlConfig | null {
  const normalized = siteName.toLowerCase();

  // Site name aliases mapping
  const aliases: Record<string, string> = {
    'caribbeancom': 'カリビアンコム',
    'caribbeancompr': 'カリビアンコムプレミアム',
    '1pondo': '一本道',
    'heyzo': 'HEYZO',
    '10musume': '天然むすめ',
    'pacopacomama': 'パコパコママ',
    'hitozumagiri': '人妻斬り',
    'av-e-body': 'エッチな0930',
    '0930': 'エッチな0930',
    'av-4610': 'エッチな4610',
    '4610': 'エッチな4610',
    'heydouga': 'Hey動画',
    'kin8tengoku': '金髪天國',
    'kin8': '金髪天國',
    'nyoshin': '女体のしんぴ',
    'nozox': 'NOZOX',
    '0930world': 'エッチな0930WORLD',
    'av-0230': 'エッチな0230',
    '0230': 'エッチな0230',
    'unkotare': 'うんこたれ',
    '3d-eros': '3D-EROS.NET',
    'pikkur': 'Pikkur',
    'javholic': 'Javholic',
  };

  const targetSiteName = aliases[normalized] || siteName;

  return CRAWL_CONFIGS.find(
    config =>
      config.siteName === targetSiteName ||
      config.siteName.toLowerCase() === normalized
  ) || null;
}

/**
 * Main crawl function
 */
async function crawlDTISites() {
  try {
    const options = parseArgs();

    if (options.site) {
      // Crawl specific site
      const config = findConfigBySite(options.site);

      if (!config) {
        console.error(`Error: Site '${options.site}' not found`);
        console.error('Available sites:');
        for (const c of CRAWL_CONFIGS) {
          console.error(`  - ${c.siteName}`);
        }
        process.exit(1);
      }

      // Override start ID if specified
      if (options.start) {
        config.startId = options.start;
      }

      console.log('Starting DTI sites crawler...\n');
      console.log(`Site: ${config.siteName}`);
      if (options.limit) {
        console.log(`Limit: ${options.limit} products\n`);
      }

      // Temporarily modify config to apply limit
      const originalStartId = config.startId;
      const originalEndId = config.endId;

      if (options.limit) {
        // We'll limit by modifying the crawlSite function behavior
        // For now, just pass it to the site crawler
        (config as any).limit = options.limit;
      }

      await crawlSite(config);

      // Restore original config
      config.startId = originalStartId;
      config.endId = originalEndId;
      delete (config as any).limit;

    } else {
      // Crawl all sites
      console.log('Starting DTI sites crawler...\n');
      console.log(`Crawling ${CRAWL_CONFIGS.length} sites\n`);

      for (const config of CRAWL_CONFIGS) {
        await crawlSite(config);
      }
    }

    console.log('\n========================================');
    console.log('DTI Sites Crawl Completed!');
    console.log('========================================\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

crawlDTISites();
