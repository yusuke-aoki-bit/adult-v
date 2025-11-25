/**
 * Test image extraction from actual raw HTML data
 */
import * as cheerio from 'cheerio';
import { getDb } from '../lib/db';
import { rawHtmlData } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

interface ImageExtractionResult {
  thumbnailUrl?: string;
  sampleImages: string[];
}

function normalizeUrl(url: string | undefined, baseUrl?: string): string | undefined {
  if (!url) return undefined;

  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  if (!url.startsWith('http') && baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return undefined;
    }
  }

  if (url.startsWith('http')) {
    return url;
  }

  return undefined;
}

async function main() {
  const db = getDb();

  // Test HEYZO (protocol-relative URL)
  console.log('Testing HEYZO extraction:\n');
  const heyzo = await db
    .select({
      productId: rawHtmlData.productId,
      source: rawHtmlData.source,
      htmlContent: rawHtmlData.htmlContent,
    })
    .from(rawHtmlData)
    .where(sql`${rawHtmlData.source} = 'HEYZO'`)
    .limit(1);

  if (heyzo.length > 0) {
    const $ = cheerio.load(heyzo[0].htmlContent);
    const ogImage = $('meta[property="og:image"]').attr('content');
    console.log(`Raw og:image: "${ogImage}"`);
    console.log(`Normalized: "${normalizeUrl(ogImage)}"`);
    console.log(`Product ID: ${heyzo[0].productId}\n`);
  }

  // Test av-wiki
  console.log('Testing av-wiki extraction:\n');
  const avwiki = await db
    .select({
      productId: rawHtmlData.productId,
      source: rawHtmlData.source,
      htmlContent: rawHtmlData.htmlContent,
    })
    .from(rawHtmlData)
    .where(sql`${rawHtmlData.source} = 'av-wiki'`)
    .limit(1);

  if (avwiki.length > 0) {
    const $ = cheerio.load(avwiki[0].htmlContent);
    const ogImage = $('meta[property="og:image"]').attr('content');
    console.log(`og:image: "${ogImage}"`);

    // Try to find DMM image
    const dmmImage = $('img[src*="pics.dmm.co.jp"]').first().attr('src');
    console.log(`DMM image: "${dmmImage}"`);
    console.log(`Product ID: ${avwiki[0].productId}\n`);
  }

  // List all sources
  console.log('All sources in raw_html_data:');
  const sources = await db
    .selectDistinct({ source: rawHtmlData.source })
    .from(rawHtmlData);

  for (const { source } of sources) {
    const count = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(rawHtmlData)
      .where(sql`${rawHtmlData.source} = ${source}`);
    console.log(`  ${source}: ${count[0].count} records`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
