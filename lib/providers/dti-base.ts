/**
 * DTI Base Crawler Utilities
 * Common functionality shared across all DTI site crawlers
 */

import * as iconv from 'iconv-lite';
import { getDb } from '../db/index';
import {
  products,
  performers,
  productPerformers,
  tags,
  productTags,
  productSources,
  rawHtmlData,
  productImages,
  productVideos,
} from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateDTILink } from '../affiliate';
import {
  isValidPerformerName,
  normalizePerformerName,
  isValidPerformerForProduct,
} from '../performer-validation';
import { validateProductData } from '../crawler-utils';
import {
  generateProductDescription,
  extractProductTags,
  translateProduct,
} from '../google-apis';
import { calculateHash } from '../gcs-crawler-helper';
import { saveSaleInfo, SaleInfo } from '../sale-helper';
import {
  upsertRawHtmlDataWithGcs,
  markRawDataAsProcessed,
  type UpsertRawDataResult,
} from '../crawler/dedup-helper';

// ============================================================
// Types & Interfaces
// ============================================================

export interface DTISiteConfig {
  siteName: string;
  siteId: string;
  aspName?: string; // ASP name for product_sources (e.g., 'カリビアンコム', 'HEYZO'). Falls back to siteName if not set.
  baseUrl: string;
  urlPattern: string;
  idFormat: 'MMDDYY_NNN' | 'MMDDYY_NNNN' | 'NNNN';
  startId?: string;
  endId?: string;
  maxConcurrent?: number;
  reverseMode?: boolean;
}

export interface CrawlOptions {
  limit?: number;
  enableAI?: boolean;
  startId?: string;
  forceReprocess?: boolean;
}

export interface ParsedProductData {
  title?: string;
  description?: string;
  actors?: string[];
  releaseDate?: string;
  imageUrl?: string;
  sampleImages?: string[];
  sampleVideoUrl?: string;
  price?: number;
  saleInfo?: SaleInfo;
}

export interface CrawlResult {
  foundCount: number;
  importedCount: number;
  skippedCount: number;
  notFoundCount: number;
}

// ============================================================
// Encoding Utilities
// ============================================================

/**
 * Detect encoding from HTML content or response headers
 */
export function detectEncoding(
  buffer: Buffer,
  contentType?: string,
  url?: string
): string {
  // Check Content-Type header first
  if (contentType) {
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch) {
      return charsetMatch[1].toLowerCase();
    }
  }

  // URL-based detection for known DTI sites (they use EUC-JP)
  if (url) {
    if (
      url.includes('caribbeancompr.com') ||
      url.includes('caribbeancom.com') ||
      url.includes('1pondo.tv') ||
      url.includes('heyzo.com')
    ) {
      return 'euc-jp';
    }
  }

  // Try to detect from HTML meta tags (check first 4096 bytes)
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
export function decodeHtml(
  buffer: Buffer,
  contentType?: string,
  url?: string
): string {
  const encoding = detectEncoding(buffer, contentType, url);
  console.log(
    `    🔤 Detected encoding: ${encoding} for ${url?.substring(0, 50) || 'unknown'}`
  );

  // Normalize encoding names
  const normalizedEncoding = encoding
    .replace('shift_jis', 'shift-jis')
    .replace('shift-jis', 'Shift_JIS')
    .replace('sjis', 'Shift_JIS')
    .replace('euc-jp', 'EUC-JP')
    .replace('eucjp', 'EUC-JP');

  try {
    if (
      normalizedEncoding.toLowerCase() === 'utf-8' ||
      normalizedEncoding.toLowerCase() === 'utf8'
    ) {
      return buffer.toString('utf-8');
    }
    // Use iconv-lite for other encodings
    return iconv.decode(buffer, normalizedEncoding);
  } catch (error) {
    console.warn(
      `Failed to decode with ${normalizedEncoding}, falling back to UTF-8`
    );
    return buffer.toString('utf-8');
  }
}

// ============================================================
// ID Generation
// ============================================================

/**
 * Generate next ID based on format
 */
export function generateNextId(
  currentId: string,
  format: string,
  reverse: boolean = false
): string | null {
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
    const maxSeq = format === 'MMDDYY_NNN' ? 10 : 20;
    const seqLen = format === 'MMDDYY_NNN' ? 3 : 4;

    const seq = parseInt(seqPart);

    if (reverse) {
      // Increment sequence within same day, then move to previous day
      if (seq < maxSeq) {
        return `${datePart}_${String(seq + 1).padStart(seqLen, '0')}`;
      }

      // Move to previous day
      const mm = parseInt(datePart.substring(0, 2));
      const dd = parseInt(datePart.substring(2, 4));
      const yy = parseInt(datePart.substring(4, 6));

      const date = new Date(2000 + yy, mm - 1, dd);
      date.setDate(date.getDate() - 1);

      if (date.getFullYear() < 2000) return null;

      const prevMM = String(date.getMonth() + 1).padStart(2, '0');
      const prevDD = String(date.getDate()).padStart(2, '0');
      const prevYY = String(date.getFullYear() % 100).padStart(2, '0');

      return `${prevMM}${prevDD}${prevYY}_${String(1).padStart(seqLen, '0')}`;
    } else {
      // Forward direction
      if (seq < maxSeq) {
        return `${datePart}_${String(seq + 1).padStart(seqLen, '0')}`;
      }

      // Move to next day
      const mm = parseInt(datePart.substring(0, 2));
      const dd = parseInt(datePart.substring(2, 4));
      const yy = parseInt(datePart.substring(4, 6));

      const date = new Date(2000 + yy, mm - 1, dd);
      date.setDate(date.getDate() + 1);

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

// ============================================================
// Image & Video Utilities
// ============================================================

/**
 * Generate DTI image URL as fallback based on site patterns
 */
export function generateDtiImageUrlFallback(
  siteName: string,
  productId: string
): string | null {
  switch (siteName) {
    case '一本道':
      return `https://www.1pondo.tv/moviepages/${productId}/images/str.jpg`;
    case 'カリビアンコム':
      return `https://www.caribbeancom.com/moviepages/${productId}/images/l_l.jpg`;
    case 'カリビアンコムプレミアム':
      return `https://www.caribbeancompr.com/moviepages/${productId}/images/l_l.jpg`;
    case '天然むすめ':
      return `https://www.10musume.com/moviepages/${productId}/images/str.jpg`;
    case 'パコパコママ':
      return `https://www.pacopacomama.com/moviepages/${productId}/images/str.jpg`;
    case '人妻斬り':
      return `https://www.hitozuma-giri.com/moviepages/${productId}/images/str.jpg`;
    case 'HEYZO':
      return `https://www.heyzo.com/moviepages/${productId}/images/player_thumbnail.jpg`;
    case 'エッチな0930':
    case 'エッチな0930WORLD':
      return `https://www.av-e-body.com/moviepages/${productId}/images/str.jpg`;
    case 'エッチな4610':
      return `https://www.av-4610.com/moviepages/${productId}/images/str.jpg`;
    case 'エッチな0230':
      return `https://www.av-0230.com/moviepages/${productId}/images/str.jpg`;
    case '金髪天國':
      return `https://www.kin8tengoku.com/moviepages/${productId}/images/str.jpg`;
    default:
      return null;
  }
}

/**
 * Fetch gallery.zip for sample images
 */
export async function fetchGalleryZip(
  galleryZipUrl: string,
  productId: string
): Promise<string[]> {
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
        if (
          !entry.isDirectory &&
          entry.entryName.match(/\.(jpg|jpeg|png)$/i)
        ) {
          const imageUrl = `${baseImageUrl}/${entry.entryName}`;
          sampleImages.push(imageUrl);
        }
      }
      console.log(
        `    ✓ Extracted ${sampleImages.length} sample images from gallery.zip`
      );
    } else {
      console.log(`    ⚠️  Gallery.zip not available (${zipResponse.status})`);
    }
  } catch (error) {
    console.log(
      `    ⚠️  Could not fetch gallery.zip: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return sampleImages;
}

/**
 * Get gallery.zip URL for a specific site
 */
export function getGalleryZipUrl(
  siteName: string,
  productId: string
): string | null {
  switch (siteName) {
    case '一本道':
      return `https://www.1pondo.tv/assets/sample/${productId}/gallery.zip`;
    case '天然むすめ':
      return `https://www.10musume.com/assets/sample/${productId}/gallery.zip`;
    case 'パコパコママ':
      return `https://www.pacopacomama.com/assets/sample/${productId}/gallery.zip`;
    case 'カリビアンコムプレミアム':
      return `https://www.caribbeancompr.com/moviepages/${productId}/gallery.zip`;
    case 'HEYZO':
      return `https://www.heyzo.com/moviepages/${productId}/gallery.zip`;
    case '金髪天國':
      return `https://www.kin8tengoku.com/moviepages/${productId}/gallery.zip`;
    case '人妻斬り':
      return `https://www.hitozuma-giri.com/moviepages/${productId}/gallery.zip`;
    case 'エッチな0930':
      return `https://www.av-e-body.com/moviepages/${productId}/gallery.zip`;
    case 'エッチな4610':
      return `https://www.av-4610.com/moviepages/${productId}/gallery.zip`;
    case 'エッチな0230':
      return `https://www.av-0230.com/moviepages/${productId}/gallery.zip`;
    default:
      return null;
  }
}

/**
 * Get sample video URL pattern for a site
 */
export function getSampleVideoUrl(
  siteName: string,
  productId: string
): string | null {
  switch (siteName) {
    case '一本道':
      return `https://smovie.1pondo.tv/sample/movies/${productId}/1080p.mp4`;
    case 'カリビアンコム':
      return `https://www.caribbeancom.com/moviepages/${productId}/sample/sample.mp4`;
    case 'カリビアンコムプレミアム':
      return `https://www.caribbeancompr.com/moviepages/${productId}/sample/sample.mp4`;
    case 'HEYZO':
      return `https://www.heyzo.com/moviepages/${productId}/sample/sample.mp4`;
    default:
      return null;
  }
}

// ============================================================
// HTML Parsing
// ============================================================

/**
 * Site name suffixes to remove from title
 */
const SITE_SUFFIXES = [
  /\s*\|\s*美を追求する高画質アダルト動画サイト$/,
  /\s*\|\s*高画質無修正動画サイト$/,
  /\s*\|\s*カリビアンコムプレミアム$/,
  /\s*\|\s*カリビアンコム$/,
  /\s*\|\s*HEYZO$/,
  /\s*\|\s*一本道$/,
];

/**
 * Invalid titles (site name only, no actual product title)
 */
const INVALID_TITLE_PATTERNS = [
  /^一本道$/,
  /^カリビアンコム$/,
  /^カリビアンコムプレミアム$/,
  /^HEYZO$/,
];

/**
 * Extract basic product info from HTML
 */
export function extractBasicInfo(html: string): {
  rawTitle?: string;
  description?: string;
  imageUrl?: string;
} {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const descMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i
  );
  const imgMatch = html.match(
    /<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i
  );

  let rawTitle = titleMatch ? titleMatch[1].trim() : undefined;

  // Remove site suffixes
  if (rawTitle) {
    for (const suffix of SITE_SUFFIXES) {
      rawTitle = rawTitle.replace(suffix, '').trim();
    }
  }

  return {
    rawTitle,
    description: descMatch ? descMatch[1].trim() : undefined,
    imageUrl: imgMatch ? imgMatch[1] : undefined,
  };
}

/**
 * Validate title
 */
export function isValidTitle(title?: string): boolean {
  if (!title || title.length < 3) return false;
  return !INVALID_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

/**
 * Extract price from HTML (DTI sites use USD)
 */
export function extractPrice(html: string): {
  price?: number;
  saleInfo?: SaleInfo;
} {
  let price: number | undefined;
  let saleInfo: SaleInfo | undefined;

  // Pattern 1: var ec_price = parseFloat('50.00');
  const priceMatch = html.match(
    /var\s+ec_price\s*=\s*parseFloat\s*\(\s*['"](\d+(?:\.\d+)?)['"]\s*\)/
  );
  if (priceMatch) {
    const usdPrice = parseFloat(priceMatch[1]);
    price = Math.round(usdPrice * 150);
  }

  // Pattern 2: ec_item_price = '50.00'
  if (!price) {
    const itemPriceMatch = html.match(
      /ec_item_price\s*=\s*['"]?(\d+(?:\.\d+)?)['"]?/
    );
    if (itemPriceMatch) {
      const usdPrice = parseFloat(itemPriceMatch[1]);
      price = Math.round(usdPrice * 150);
    }
  }

  // Pattern 3: Japanese yen price
  if (!price) {
    const yenMatch = html.match(/[¥￥]?\s*(\d{1,3}(?:,\d{3})*)\s*円/);
    if (yenMatch) {
      price = parseInt(yenMatch[1].replace(/,/g, ''));
    }
  }

  // Check for sale price
  const originalPriceMatch = html.match(
    /(?:通常|定価|元)[価値:]?\s*\$?\s*(\d+(?:\.\d+)?)/i
  );
  const discountMatch = html.match(/(\d+)\s*%\s*(?:OFF|オフ|off|割引)/);

  if (originalPriceMatch && price) {
    const originalUsd = parseFloat(originalPriceMatch[1]);
    const regularPrice = Math.round(originalUsd * 150);
    if (regularPrice > price) {
      saleInfo = {
        regularPrice,
        salePrice: price,
        discountPercent: discountMatch
          ? parseInt(discountMatch[1])
          : Math.round((1 - price / regularPrice) * 100),
        saleType: 'sale',
      };
    }
  }

  // Pattern: JavaScript variables for sale detection
  const regularPriceVar = html.match(
    /(?:ec_regular_price|regular_price|original_price)\s*=\s*(?:parseFloat\s*\(\s*)?['"]?(\d+(?:\.\d+)?)['"]?/
  );
  if (regularPriceVar && price && !saleInfo) {
    const regularUsd = parseFloat(regularPriceVar[1]);
    const regularPrice = Math.round(regularUsd * 150);
    if (regularPrice > price) {
      saleInfo = {
        regularPrice,
        salePrice: price,
        discountPercent: Math.round((1 - price / regularPrice) * 100),
        saleType: 'sale',
      };
    }
  }

  return { price, saleInfo };
}

/**
 * Extract actors from HTML
 */
export function extractActors(html: string, title?: string): string[] {
  let rawActors: string[] = [];

  // Pattern 1: JavaScript variable ec_item_brand
  const brandMatch = html.match(/var\s+ec_item_brand\s*=\s*['"]([^'"]+)['"]/);
  if (brandMatch && brandMatch[1]) {
    rawActors = [brandMatch[1]];
  }

  // Pattern 2: Title format "女優名 【ふりがな】 タイトル" (HEYZO系)
  if (rawActors.length === 0) {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      const titleActorMatch = titleMatch[1].match(/^([^\s【]+)\s*【[^】]+】/);
      if (titleActorMatch) {
        rawActors = [titleActorMatch[1]];
      }
    }
  }

  // Pattern 3: HTML content with 出演者 label
  if (rawActors.length === 0) {
    const actorMatches = html.match(/出演者?[:：]?\s*([^<\n]+)/i);
    if (actorMatches) {
      rawActors = actorMatches[1]
        .split(/[、,]/)
        .map((a) => a.trim())
        .filter((a) => a);
    }
  }

  // Apply performer validation
  return rawActors
    .map((name) => normalizePerformerName(name))
    .filter(
      (name): name is string =>
        name !== null && isValidPerformerForProduct(name, title)
    );
}

/**
 * Extract release date from HTML
 */
export function extractReleaseDate(html: string): string | undefined {
  const dateMatch = html.match(
    /配信日[:：]?\s*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/
  );
  return dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    : undefined;
}

/**
 * DTI系レビュー情報
 */
export interface DtiReview {
  reviewerName: string;
  rating: number;
  content: string;
  reviewDate?: string;
}

/**
 * Extract user reviews from DTI HTML (Caribbeancom, 1pondo, etc.)
 * HTML structure:
 * <div class="section is-dense">
 *   <div class="rating">★★★★★</div>
 *   <div class="review-comment">...</div>
 *   <div class="review-info">
 *     <span class="review-info__user">by XXX</span>
 *     <span class="review-info__date">YYYY-MM-DD HH:MM:SS</span>
 *   </div>
 * </div>
 */
export function extractReviews(html: string): DtiReview[] {
  const reviews: DtiReview[] = [];

  // Pattern: section blocks containing reviews
  // Match each review block: <div class="section is-dense">..rating..review-comment..review-info..</div>
  const reviewBlockRegex = /<div class="section is-dense">\s*<div class="rating"[^>]*>([\s\S]*?)<\/div>\s*<div class="review-comment">([\s\S]*?)<\/div>\s*<div class="review-info">\s*<span class="review-info__user">([^<]*)<\/span>\s*<span class="review-info__date">([^<]*)<\/span>/g;

  let match;
  while ((match = reviewBlockRegex.exec(html)) !== null) {
    const ratingHtml = match[1];
    const content = match[2].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    const reviewerRaw = match[3].trim();
    const dateRaw = match[4].trim();

    // Extract rating from star count
    const starCount = (ratingHtml.match(/★/g) || []).length;
    const rating = Math.min(starCount, 5);

    // Extract reviewer name (remove "by " prefix)
    const reviewerName = reviewerRaw.replace(/^by\s+/i, '').trim();

    // Parse date (format: YYYY-MM-DD HH:MM:SS)
    let reviewDate: string | undefined;
    const dateMatch = dateRaw.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
    if (dateMatch) {
      reviewDate = dateMatch[1].replace(/\//g, '-');
    }

    if (reviewerName && content) {
      reviews.push({
        reviewerName,
        rating,
        content,
        reviewDate,
      });
    }
  }

  return reviews;
}

/**
 * Extract sample images from HTML
 * Uses Set for O(1) deduplication instead of O(n) includes() checks
 */
export function extractSampleImages(html: string, imageUrl?: string): string[] {
  const imageSet = new Set<string>();

  // Pattern 1: Sample image gallery members
  const memberGalleryMatches = Array.from(
    html.matchAll(/<a[^>]*href=["']([^"']*members[^"']*gallery[^"']*\.jpg)["']/gi)
  );
  for (const match of memberGalleryMatches) {
    imageSet.add(match[1]);
  }

  // Pattern 2: Movie thumb images
  const movieThumbMatches = Array.from(
    html.matchAll(/<img[^>]*src=["']([^"']*moviepages[^"']*\.jpg)["']/gi)
  );
  for (const match of movieThumbMatches) {
    imageSet.add(match[1]);
  }

  // Pattern 3: Sample image links
  const sampleLinkMatches = Array.from(
    html.matchAll(/<a[^>]*href=["']([^"']*\/posters\/[^"']*\.jpg)["']/gi)
  );
  for (const match of sampleLinkMatches) {
    imageSet.add(match[1]);
  }

  // Pattern 4: HEYZO sample images
  const heyzoMatches = Array.from(
    html.matchAll(/<img[^>]*src=["']([^"']*\/contents\/[^"']*sample[^"']*\.jpg)["']/gi)
  );
  for (const match of heyzoMatches) {
    imageSet.add(match[1]);
  }

  // Pattern 5: Generic sample image patterns
  const genericSampleMatches = Array.from(
    html.matchAll(/<img[^>]*src=["']([^"']*sample[^"']*\.jpg)["']/gi)
  );
  for (const match of genericSampleMatches) {
    imageSet.add(match[1]);
  }

  // Remove main image URL if provided
  if (imageUrl) {
    imageSet.delete(imageUrl);
  }

  return Array.from(imageSet);
}

/**
 * Extract sample video URL from HTML
 */
export function extractSampleVideoFromHtml(html: string): string | undefined {
  // Pattern 1: Video source tag
  const videoSrcMatch = html.match(
    /<source[^>]*src=["']([^"']+\.mp4)["']/i
  );
  if (videoSrcMatch) return videoSrcMatch[1];

  // Pattern 2: Sample movie player URLs
  const sampleMovieMatch = html.match(
    /sample[_-]?movie[^"']*\.mp4|[^"']*sample[^"']*\.mp4/i
  );
  if (sampleMovieMatch) {
    const fullMatch = html.match(/["']([^"']*sample[^"']*\.mp4)["']/i);
    if (fullMatch) return fullMatch[1];
  }

  // Pattern 3: JavaScript variable for sample movie URL
  const jsSampleMatch = html.match(
    /(?:sample_?url|movie_?url|video_?url)\s*[=:]\s*["']([^"']+\.mp4)["']/i
  );
  if (jsSampleMatch) return jsSampleMatch[1];

  // Pattern 4: data-video-url attribute
  const dataVideoMatch = html.match(
    /data-video-url=["']([^"']+\.mp4)["']/i
  );
  if (dataVideoMatch) return dataVideoMatch[1];

  return undefined;
}

// ============================================================
// Database Operations
// ============================================================

/**
 * Save product images to product_images table
 */
export async function saveProductImages(
  productId: number,
  thumbnailUrl?: string,
  sampleImages?: string[],
  siteName?: string
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
            eq(productImages.imageUrl, thumbnailUrl)
          )
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
              eq(productImages.imageUrl, imageUrl)
            )
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
export async function saveProductVideo(
  productId: number,
  sampleVideoUrl?: string
): Promise<void> {
  if (!sampleVideoUrl) {
    return;
  }

  const db = getDb();

  try {
    const existing = await db
      .select()
      .from(productVideos)
      .where(
        and(
          eq(productVideos.productId, productId),
          eq(productVideos.videoUrl, sampleVideoUrl)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(productVideos).values({
        productId,
        videoUrl: sampleVideoUrl,
        videoType: 'sample',
        aspName: 'DTI',
        displayOrder: 0,
      }).onConflictDoNothing();
      console.log(`    🎬 Saved sample video to product_videos`);
    }
  } catch (error) {
    console.error(`    ❌ Error saving product video:`, error);
  }
}

/**
 * Save or update product to database
 */
export async function saveProduct(
  config: DTISiteConfig,
  productId: string,
  productData: ParsedProductData,
  url: string,
  enableAI: boolean = true
): Promise<{ productDbId: number; isNew: boolean } | null> {
  const db = getDb();
  const normalizedProductId = `${config.siteName}-${productId}`;
  const aspName = config.aspName || config.siteName; // Use aspName if set, otherwise fall back to siteName

  try {
    // Validate product data
    const validation = validateProductData({
      title: productData.title,
      description: productData.description,
      aspName: aspName,
      originalId: productId,
    });

    if (!validation.isValid) {
      console.log(`  ⚠️ バリデーションスキップ: ${validation.reason}`);
      return null;
    }

    // Check if product already exists
    const existingProduct = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    let productDbId: number;
    let isNew = false;

    if (existingProduct.length > 0) {
      productDbId = existingProduct[0].id;
    } else {
      isNew = true;
      const thumbnailUrl =
        productData.imageUrl ||
        generateDtiImageUrlFallback(config.siteName, productId);

      const [insertedProduct] = await db
        .insert(products)
        .values({
          normalizedProductId,
          title: productData.title || '',
          description: productData.description || '',
          releaseDate: productData.releaseDate,
          defaultThumbnailUrl: thumbnailUrl,
        })
        .returning({ id: products.id });

      productDbId = insertedProduct.id;

      // Generate affiliate URL
      const affiliateUrl = generateDTILink(url);

      // Insert into product_sources
      await db.insert(productSources).values({
        productId: productDbId,
        aspName: aspName,
        originalProductId: productId,
        affiliateUrl: affiliateUrl,
        price: productData.price || 0,
        dataSource: 'CRAWL',
      });

      // Save images
      await saveProductImages(
        productDbId,
        thumbnailUrl || undefined,
        productData.sampleImages,
        config.siteName
      );

      // Save video
      await saveProductVideo(productDbId, productData.sampleVideoUrl);

      // Save sale info
      if (productData.saleInfo) {
        try {
          const saved = await saveSaleInfo('DTI', productId, productData.saleInfo);
          if (saved) {
            console.log(`    💰 Saved sale info to database`);
          }
        } catch (saleError: any) {
          console.log(`    ⚠️ セール情報保存失敗: ${saleError.message}`);
        }
      }

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
                eq(productPerformers.productId, productDbId),
                eq(productPerformers.performerId, performerId)
              )
            )
            .limit(1);

          if (existingLink.length === 0) {
            await db.insert(productPerformers).values({
              productId: productDbId,
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
              eq(productTags.productId, productDbId),
              eq(productTags.tagId, tagId)
            )
          )
          .limit(1);

        if (existingTagLink.length === 0) {
          await db.insert(productTags).values({
            productId: productDbId,
            tagId,
          });
        }
      }

      // AI features
      if (enableAI) {
        await runAIFeatures(productDbId, productData);
      }
    }

    return { productDbId, isNew };
  } catch (error) {
    console.error(`  ❌ Error saving product ${productId}:`, error);
    return null;
  }
}

/**
 * Run AI features on a product
 */
async function runAIFeatures(
  productId: number,
  productData: ParsedProductData
): Promise<void> {
  const db = getDb();

  try {
    console.log(`  🤖 AI機能を実行中...`);

    // AI description generation
    const aiResult = await generateProductDescription({
      title: productData.title || '',
      originalDescription: productData.description,
      performers: productData.actors,
    });

    if (aiResult) {
      console.log(`    ✅ AI説明文生成完了`);
      console.log(`       キャッチコピー: ${aiResult.catchphrase}`);

      try {
        await db.execute(sql`
          UPDATE products
          SET
            ai_description = ${JSON.stringify(aiResult)}::jsonb,
            ai_catchphrase = ${aiResult.catchphrase},
            ai_short_description = ${aiResult.shortDescription},
            updated_at = NOW()
          WHERE id = ${productId}
        `);
      } catch (error: unknown) {
        // AI description columns may not exist during migration
        console.warn(`    ⚠️ AI説明文カラム更新スキップ:`, error instanceof Error ? error.message : error);
      }
    }

    // AI tag extraction
    const aiTags = await extractProductTags(
      productData.title || '',
      productData.description
    );
    if (aiTags.genres.length > 0 || aiTags.attributes.length > 0) {
      console.log(`    ✅ AIタグ抽出完了`);

      try {
        await db.execute(sql`
          UPDATE products
          SET ai_tags = ${JSON.stringify(aiTags)}::jsonb
          WHERE id = ${productId}
        `);
      } catch (error: unknown) {
        console.warn(`    ⚠️ AIタグカラム更新スキップ:`, error instanceof Error ? error.message : error);
      }
    }

    // Translation
    console.log(`  🌐 翻訳処理を実行中...`);
    const translation = await translateProduct(
      productData.title || '',
      productData.description
    );
    if (translation) {
      try {
        await db.execute(sql`
          UPDATE products
          SET
            title_en = ${translation.en?.title || null},
            title_zh = ${translation.zh?.title || null},
            title_ko = ${translation.ko?.title || null},
            description_en = ${translation.en?.description || null},
            description_zh = ${translation.zh?.description || null},
            description_ko = ${translation.ko?.description || null},
            updated_at = NOW()
          WHERE id = ${productId}
        `);
        console.log(`    ✅ 翻訳完了`);
        if (translation.en?.title) {
          console.log(`       EN: ${translation.en.title.slice(0, 50)}...`);
        }
      } catch (error: unknown) {
        console.warn(`    ⚠️ 翻訳カラム更新スキップ:`, error instanceof Error ? error.message : error);
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`    ⚠️ AI機能エラー: ${errorMessage}`);
  }
}

// ============================================================
// Base Crawler Class
// ============================================================

export abstract class DTIBaseCrawler {
  protected config: DTISiteConfig;
  protected db = getDb();

  constructor(config: DTISiteConfig) {
    this.config = config;
  }

  /**
   * Parse HTML content - to be implemented by subclass
   */
  abstract parseHtmlContent(
    html: string,
    productId: string
  ): Promise<ParsedProductData | null>;

  /**
   * Fetch and decode HTML from URL
   */
  async fetchHtml(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || undefined;
      return decodeHtml(buffer, contentType, url);
    } catch (error) {
      console.error(`  ❌ Error fetching ${url}:`, error);
      return null;
    }
  }

  /**
   * Check for existing raw HTML data
   */
  async getExistingRawHtml(productId: string) {
    return await this.db
      .select()
      .from(rawHtmlData)
      .where(
        and(
          eq(rawHtmlData.source, this.config.siteName),
          eq(rawHtmlData.productId, productId)
        )
      )
      .limit(1);
  }

  /**
   * Save raw HTML to database/GCS using unified dedup helper
   * Returns UpsertRawDataResult with shouldSkip flag for deduplication
   */
  async saveRawHtmlData(
    productId: string,
    url: string,
    htmlContent: string,
    forceReprocess: boolean = false
  ): Promise<UpsertRawDataResult> {
    const siteKey = this.config.siteName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Use the unified upsert function with GCS support
    const result = await upsertRawHtmlDataWithGcs(
      this.config.siteName,
      productId,
      url,
      htmlContent
    );

    // Log appropriately
    if (result.shouldSkip && !forceReprocess) {
      console.log(`  ⏭️ スキップ(処理済み): ${productId}`);
    } else if (result.isNew) {
      console.log(`  💾 Saved HTML: ${productId}${result.gcsUrl ? ' (GCS)' : ' (DB)'}`);
    } else {
      console.log(`  🔄 Updated HTML: ${productId}${result.gcsUrl ? ' (GCS)' : ' (DB)'}`);
    }

    return result;
  }

  /**
   * Mark raw HTML as processed
   */
  async markProcessed(rawDataId: number): Promise<void> {
    await markRawDataAsProcessed('dti', rawDataId);
  }

  /**
   * Main crawl loop
   */
  async crawl(options: CrawlOptions = {}): Promise<CrawlResult> {
    console.log(`\nStarting crawl for ${this.config.siteName}...`);
    console.log(`URL Pattern: ${this.config.urlPattern}`);
    console.log(`Starting from ID: ${options.startId || this.config.startId}`);
    console.log(`AI機能: ${options.enableAI !== false ? '有効' : '無効'}`);
    console.log(`強制再処理: ${options.forceReprocess ? '有効' : '無効'}\n`);

    let currentId = options.startId || this.config.startId!;
    let foundCount = 0;
    let notFoundCount = 0;
    let importedCount = 0;
    let skippedCount = 0;
    let skippedUnchanged = 0;
    let consecutiveNotFound = 0;
    const MAX_CONSECUTIVE_NOT_FOUND = 50;
    const forceReprocess = options.forceReprocess ?? false;

    while (currentId) {
      // Check limits
      if (options.limit && foundCount >= options.limit) {
        console.log(`Reached limit: ${options.limit} products found`);
        break;
      }

      if (this.config.endId) {
        if (this.config.reverseMode && currentId < this.config.endId) {
          console.log(`Reached end ID: ${this.config.endId}`);
          break;
        } else if (!this.config.reverseMode && currentId > this.config.endId) {
          console.log(`Reached end ID: ${this.config.endId}`);
          break;
        }
      }

      if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
        console.log(
          `Stopping: ${MAX_CONSECUTIVE_NOT_FOUND} consecutive products not found`
        );
        break;
      }

      const url = this.config.urlPattern.replace('{id}', currentId);

      // Fetch HTML
      const fetchedHtml = await this.fetchHtml(url);
      if (!fetchedHtml) {
        notFoundCount++;
        consecutiveNotFound++;

        if (notFoundCount % 10 === 0) {
          console.log(
            `  Progress: ${foundCount} found, ${notFoundCount} not found (current: ${currentId})`
          );
        }

        currentId =
          generateNextId(currentId, this.config.idFormat, this.config.reverseMode) ||
          '';
        if (!currentId) break;
        await this.delay(500);
        continue;
      }

      // Save raw HTML with deduplication
      const upsertResult = await this.saveRawHtmlData(
        currentId,
        url,
        fetchedHtml,
        forceReprocess
      );

      // Skip if no changes and already processed
      if (upsertResult.shouldSkip && !forceReprocess) {
        foundCount++;
        skippedUnchanged++;
        consecutiveNotFound = 0;
        currentId =
          generateNextId(currentId, this.config.idFormat, this.config.reverseMode) ||
          '';
        if (!currentId) break;
        await this.delay(500);
        continue;
      }

      // Parse HTML content
      const productData = await this.parseHtmlContent(fetchedHtml, currentId);

      if (!productData || !productData.title) {
        notFoundCount++;
        consecutiveNotFound++;

        if (notFoundCount % 10 === 0) {
          console.log(
            `  Progress: ${foundCount} found, ${notFoundCount} not found (current: ${currentId})`
          );
        }
      } else {
        foundCount++;
        consecutiveNotFound = 0;

        console.log(
          `  ✓ Found: ${currentId} - ${productData.title?.substring(0, 50)}...`
        );

        // Save product
        const result = await saveProduct(
          this.config,
          currentId,
          productData,
          url,
          options.enableAI !== false
        );

        if (result) {
          if (result.isNew) {
            importedCount++;
          } else {
            skippedCount++;
          }

          // Mark as processed
          await this.markProcessed(upsertResult.id);
        }
      }

      // Next ID
      currentId =
        generateNextId(currentId, this.config.idFormat, this.config.reverseMode) || '';
      if (!currentId) break;

      await this.delay(500);
    }

    console.log(`\n${this.config.siteName} - Crawl Summary:`);
    console.log(`  ✓ Found: ${foundCount}`);
    console.log(`  ✓ Imported: ${importedCount}`);
    console.log(`  ⏭️  Skipped (existing): ${skippedCount}`);
    console.log(`  ⏭️  Skipped (unchanged): ${skippedUnchanged}`);
    console.log(`  ⚠️  Not Found: ${notFoundCount}`);

    return { foundCount, importedCount, skippedCount, notFoundCount };
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================
// Exports
// ============================================================

export { calculateHash } from '../gcs-crawler-helper';
export { saveSaleInfo } from '../sale-helper';
export type { SaleInfo } from '../sale-helper';
export { upsertRawHtmlDataWithGcs, markRawDataAsProcessed } from '../crawler/dedup-helper';
export { isValidPerformerName, isValidPerformerForProduct, normalizePerformerName } from '../performer-validation';
