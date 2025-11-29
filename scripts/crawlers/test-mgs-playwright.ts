/**
 * Test MGS crawler with Playwright to render JavaScript
 */
import { fetchWithBrowser, closeBrowser } from '../../lib/browser-utils';
import * as cheerio from 'cheerio';

async function testMgsCrawler(url: string) {
  console.log(`Testing MGS crawler with Playwright on: ${url}\n`);

  try {
    // Fetch HTML with Playwright (JavaScript rendering enabled)
    console.log('Fetching page with Playwright...');
    const html = await fetchWithBrowser(url, {
      cookies: [
        { name: 'adc', value: '1', domain: '.mgstage.com' },
      ],
      waitForTimeout: 3000, // Wait 3 seconds for images to load
    });

    const $ = cheerio.load(html);

    // Extract product ID
    const productIdMatch = url.match(/product_detail\/([^\/]+)/);
    const productId = productIdMatch ? productIdMatch[1] : 'unknown';

    console.log(`Product ID: ${productId}`);
    console.log(`HTML length: ${html.length} chars\n`);

    // Save HTML for inspection
    const fs = require('fs');
    const outputPath = `/tmp/mgs-${productId}.html`;
    fs.writeFileSync(outputPath, html);
    console.log(`💾 Saved rendered HTML to: ${outputPath}\n`);

    // Extract title
    const title = $('h1.tag').text().trim() || $('title').text().trim();
    console.log(`Title: ${title}\n`);

    // Extract thumbnail
    const ogImage = $('meta[property="og:image"]').attr('content');
    console.log(`og:image: ${ogImage || 'NOT FOUND'}\n`);

    // Extract sample images
    const sampleImages: string[] = [];

    // Method 1: Find all img tags
    $('img').each((_, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      const dataSrc = $(elem).attr('data-src');

      if (src && (src.includes('cap_e') || src.includes('pb_e') || src.includes('/pics/'))) {
        const fullUrl = src.startsWith('http') ? src : `https://www.mgstage.com${src}`;
        if (!sampleImages.includes(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }

      if (dataSrc && (dataSrc.includes('cap_e') || dataSrc.includes('pb_e') || dataSrc.includes('/pics/'))) {
        const fullUrl = dataSrc.startsWith('http') ? dataSrc : `https://www.mgstage.com${dataSrc}`;
        if (!sampleImages.includes(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });

    console.log(`Found ${sampleImages.length} product images:\n`);
    sampleImages.slice(0, 10).forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`);
    });

    if (sampleImages.length > 10) {
      console.log(`  ... and ${sampleImages.length - 10} more`);
    }

    // Extract performers
    const performerNames: string[] = [];
    $('th:contains("出演")').next('td').find('a').each((_, elem) => {
      const name = $(elem).text().trim();
      if (name) {
        performerNames.push(name);
      }
    });

    console.log(`\nFound ${performerNames.length} performers: ${performerNames.join(', ')}`);

    // Close browser
    await closeBrowser();

    return {
      success: sampleImages.length > 0,
      productId,
      title,
      thumbnailUrl: ogImage,
      sampleImages,
      performerNames,
    };
  } catch (error) {
    console.error('Error:', error);
    await closeBrowser();
    throw error;
  }
}

async function main() {
  const url = process.argv[2] || 'https://www.mgstage.com/product/product_detail/300MAAN-1028/';

  const result = await testMgsCrawler(url);

  console.log('\n=== TEST RESULT ===');
  console.log(`Success: ${result.success ? '✅ YES' : '❌ NO'}`);
  console.log(`Images found: ${result.sampleImages.length}`);
  console.log(`Performers found: ${result.performerNames.length}`);

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
