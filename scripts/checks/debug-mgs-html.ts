import { getDb } from '../lib/db';
import { rawHtmlData } from '../lib/db/schema';
import { and, eq } from 'drizzle-orm';
import * as cheerio from 'cheerio';

async function debugMgsHtml() {
  const db = getDb();

  // Get one MGS product HTML
  const [record] = await db
    .select()
    .from(rawHtmlData)
    .where(and(
      eq(rawHtmlData.source, 'MGS'),
      eq(rawHtmlData.productId, '300maan-1028')
    ))
    .limit(1);

  if (!record) {
    console.log('No MGS HTML found for product 300maan-1028');
    process.exit(1);
  }

  console.log(`Product ID: ${record.productId}`);
  console.log(`HTML Length: ${record.htmlContent?.length || 0} chars`);

  const $ = cheerio.load(record.htmlContent || '');

  // Find all img tags
  const allImages: string[] = [];
  $('img').each((_, elem) => {
    const src = $(elem).attr('src') || $(elem).attr('data-src');
    if (src) {
      allImages.push(src);
    }
  });

  console.log(`\nTotal <img> tags: ${allImages.length}`);

  // Filter for potential product images (containing 'cap_e' or 'pb_e')
  const productImages = allImages.filter(src =>
    src.includes('cap_e') || src.includes('pb_e') ||
    src.includes('images/') && !src.includes('banner')
  );

  console.log(`\nPotential product images: ${productImages.length}`);
  console.log('\nFirst 10 image URLs:');
  productImages.slice(0, 10).forEach((src, i) => {
    console.log(`${i + 1}. ${src}`);
  });

  // Check for specific CSS classes
  console.log('\nChecking CSS selectors:');
  console.log(`  .sample-photo img: ${$('.sample-photo img').length}`);
  console.log(`  .sample-box img: ${$('.sample-box img').length}`);
  console.log(`  .sample-image img: ${$('.sample-image img').length}`);
  console.log(`  .product-sample img: ${$('.product-sample img').length}`);
  console.log(`  a[href*="pics/"] img: ${$('a[href*="pics/"] img').length}`);
  console.log(`  a[href*="sample"] img: ${$('a[href*="sample"] img').length}`);

  // Check og:image
  const ogImage = $('meta[property="og:image"]').attr('content');
  console.log(`\nog:image: ${ogImage || 'NOT FOUND'}`);

  // Find unique class names on images
  const imageClasses = new Set<string>();
  $('img').each((_, elem) => {
    const className = $(elem).attr('class');
    if (className) {
      className.split(/\s+/).forEach(cls => imageClasses.add(cls));
    }
  });

  console.log(`\nUnique image class names (${imageClasses.size}):`);
  Array.from(imageClasses).sort().slice(0, 20).forEach(cls => {
    console.log(`  - ${cls}`);
  });

  process.exit(0);
}

debugMgsHtml().catch(console.error);
