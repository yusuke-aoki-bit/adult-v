/**
 * Unified crawler runner for Cloud Run Jobs
 *
 * Usage:
 *   npx tsx scripts/run-crawler.ts mgs [--pages 10] [--full]
 *   npx tsx scripts/run-crawler.ts caribbeancom [--limit 100] [--full]
 *   npx tsx scripts/run-crawler.ts heyzo [--limit 100] [--full]
 *
 * Options:
 *   --full: Force full crawl (default: incremental after first run)
 */

import { execSync } from 'child_process';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const crawlerType = process.argv[2];
const args = process.argv.slice(3);
const isFullCrawl = args.includes('--full');

/**
 * Check if this is the first crawl for a given source
 */
async function isFirstCrawl(source: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM products
      WHERE id LIKE ${source + '%'}
      LIMIT 1
    `);
    const count = Number(result.rows[0]?.count || 0);
    return count === 0;
  } catch (error) {
    console.error('Error checking first crawl:', error);
    return true; // Default to full crawl on error
  }
}

/**
 * Determine crawl mode based on history and flags
 */
async function shouldDoFullCrawl(source: string): Promise<boolean> {
  if (isFullCrawl) {
    console.log('🔄 Full crawl mode (--full flag)');
    return true;
  }

  const firstCrawl = await isFirstCrawl(source);
  if (firstCrawl) {
    console.log('🆕 First crawl detected - running full crawl');
    return true;
  }

  console.log('📊 Incremental crawl mode (fetching latest only)');
  return false;
}

console.log(`Starting ${crawlerType} crawler...`);
console.log(`Arguments: ${args.join(' ')}`);

try {
  switch (crawlerType) {
    case 'mgs':
      {
        const fullCrawl = await shouldDoFullCrawl('mgs');
        const maxPages = fullCrawl ? '9999' : '5'; // Full: all pages, Incremental: 5 pages
        const command = `npx tsx scripts/crawlers/crawl-mgs-list.ts "https://www.mgstage.com/search/cSearch.php?sort=new&disp_type=3" --max-pages ${maxPages}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'caribbeancom':
      {
        const fullCrawl = await shouldDoFullCrawl('カリビアンコム');
        const limit = fullCrawl ? '99999' : '50'; // Full: all content, Incremental: 50 latest
        const start = args.find((arg, i) => args[i - 1] === '--start') || '122024_001';
        const command = `npx tsx scripts/crawlers/crawl-dti-sites.ts --site caribbeancom --start "${start}" --limit ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'heyzo':
      {
        const fullCrawl = await shouldDoFullCrawl('HEYZO');
        const limit = fullCrawl ? '99999' : '100'; // Full: all content, Incremental: 100 latest
        const start = args.find((arg, i) => args[i - 1] === '--start') || '0001';
        const command = `npx tsx scripts/crawlers/crawl-dti-sites.ts --site heyzo --start "${start}" --limit ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'caribbeancompr':
      {
        const fullCrawl = await shouldDoFullCrawl('カリビアンコムプレミアム');
        const limit = fullCrawl ? '99999' : '100'; // Full: all content, Incremental: 100 latest
        const start = args.find((arg, i) => args[i - 1] === '--start') || '122024_001';
        const command = `npx tsx scripts/crawlers/crawl-dti-sites.ts --site caribbeancompr --start "${start}" --limit ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case '1pondo':
      {
        const fullCrawl = await shouldDoFullCrawl('一本道');
        const limit = fullCrawl ? '99999' : '100'; // Full: all content, Incremental: 100 latest
        const start = args.find((arg, i) => args[i - 1] === '--start') || '122024_001';
        const command = `npx tsx scripts/crawlers/crawl-dti-sites.ts --site 1pondo --start "${start}" --limit ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'duga':
      {
        const command = `npx tsx scripts/crawlers/download-and-seed-duga.ts`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'av-wiki':
      {
        const fullCrawl = await shouldDoFullCrawl('av-wiki');
        const limit = fullCrawl ? '99999' : '100'; // Full: all content, Incremental: 100 latest
        const command = `npx tsx scripts/crawlers/crawl-wiki-performers.ts av-wiki ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'seesaawiki':
      {
        const fullCrawl = await shouldDoFullCrawl('seesaawiki');
        const limit = fullCrawl ? '99999' : '100'; // Full: all content, Incremental: 100 latest
        const command = `npx tsx scripts/crawlers/crawl-wiki-performers.ts seesaawiki ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'wiki':
      {
        const fullCrawl = await shouldDoFullCrawl('wiki');
        const limit = fullCrawl ? '99999' : '100'; // Full: all content, Incremental: 100 latest
        const command = `npx tsx scripts/crawlers/crawl-wiki-performers.ts both ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    default:
      console.error(`Unknown crawler type: ${crawlerType}`);
      console.log('Available types: mgs, caribbeancom, heyzo, caribbeancompr, 1pondo, duga, av-wiki, seesaawiki, wiki');
      process.exit(1);
  }

  console.log(`✓ ${crawlerType} crawler completed successfully`);

  // Run performer normalization after successful crawl
  console.log('\n--- Running performer normalization ---');
  try {
    execSync('npx tsx scripts/normalize-performers.ts', { stdio: 'inherit', env: process.env });
    console.log('✓ Performer normalization completed');
  } catch (normError) {
    console.error('⚠ Performer normalization failed (non-critical):', normError);
    // Don't exit on normalization failure - it's not critical
  }
} catch (error) {
  console.error(`✗ ${crawlerType} crawler failed:`, error);
  process.exit(1);
} finally {
  // Close database connection
  await pool.end();
}
