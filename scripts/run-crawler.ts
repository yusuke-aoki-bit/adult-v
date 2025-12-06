/**
 * Unified crawler runner for Cloud Run Jobs
 *
 * Usage:
 *   npx tsx scripts/run-crawler.ts mgs [--pages 10] [--full]
 *   npx tsx scripts/run-crawler.ts caribbeancom [--limit 100] [--full]
 *   npx tsx scripts/run-crawler.ts heyzo [--limit 100] [--full]
 *   npx tsx scripts/run-crawler.ts sokmil [--limit 100] [--full]
 *   npx tsx scripts/run-crawler.ts duga-api [--limit 100] [--full]
 *   npx tsx scripts/run-crawler.ts sales [--asp MGS|DUGA|SOKMIL|all] [--limit 100]
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
      FROM product_sources
      WHERE asp_name = ${source}
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

async function main() {
  console.log(`Starting ${crawlerType} crawler...`);
  console.log(`Arguments: ${args.join(' ')}`);

  try {
    switch (crawlerType) {
      case 'mgs':
        {
          // MGSは単一URL指定のクローラー。新着一覧からURLを個別に処理
          // 現在はインクリメンタルクロール未対応のため、引数で指定されたURLを処理
          const urlArg = args.find(arg => arg.startsWith('https://'));
          if (urlArg) {
            const command = `npx tsx scripts/crawlers/crawl-mgs.ts ${urlArg}`;
            console.log(`Executing: ${command}`);
            execSync(command, { stdio: 'inherit', env: process.env });
          } else {
            console.log('MGS crawler requires product URL as argument');
            console.log('Example: npx tsx scripts/run-crawler.ts mgs https://www.mgstage.com/product/product_detail/STARS-865/');
          }
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
          // duga-apiにリダイレクト
          const fullCrawl = await shouldDoFullCrawl('duga');
          const limit = fullCrawl ? '99999' : '100';
          const command = `npx tsx scripts/crawlers/crawl-duga-api.ts --limit=${limit}`;
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

      case 'seesaawiki-all':
        {
          // Full crawl of all seesaawiki pages (約9,538エントリ)
          const limit = '99999';
          const command = `npx tsx scripts/crawlers/crawl-wiki-performers.ts seesaawiki-all ${limit}`;
          console.log(`Executing: ${command}`);
          execSync(command, { stdio: 'inherit', env: process.env });
        }
        break;

      case 'seesaawiki-range':
        {
          // Crawl specific page range for parallel execution
          // Usage: seesaawiki-range --start 1 --end 20
          const startArg = args.find((arg, i) => args[i - 1] === '--start') || '1';
          const endArg = args.find((arg, i) => args[i - 1] === '--end') || '20';
          const command = `npx tsx scripts/crawlers/crawl-wiki-parallel.ts ${startArg} ${endArg}`;
          console.log(`Executing: ${command}`);
          execSync(command, { stdio: 'inherit', env: process.env });
        }
        break;

      case 'sokmil':
        {
          const fullCrawl = await shouldDoFullCrawl('sokmil');
          const limit = fullCrawl ? '99999' : '100';
          const command = `npx tsx scripts/crawlers/crawl-sokmil-api.ts --limit=${limit}`;
          console.log(`Executing: ${command}`);
          execSync(command, { stdio: 'inherit', env: process.env });
        }
        break;

      case 'duga-api':
        {
          const fullCrawl = await shouldDoFullCrawl('duga');
          const limit = fullCrawl ? '99999' : '100';
          const command = `npx tsx scripts/crawlers/crawl-duga-api.ts --limit=${limit}`;
          console.log(`Executing: ${command}`);
          execSync(command, { stdio: 'inherit', env: process.env });
        }
        break;

      case 'sales':
        {
          // セール情報クローラー（定期実行用）
          const aspArg = args.find((arg, i) => args[i - 1] === '--asp') || 'all';
          const limitArg = args.find((arg, i) => args[i - 1] === '--limit') || '200';
          const command = `npx tsx scripts/crawlers/crawl-sales.ts --asp ${aspArg} --limit ${limitArg}`;
          console.log(`Executing: ${command}`);
          execSync(command, { stdio: 'inherit', env: process.env });
        }
        break;

      case 'fc2':
        {
          const fullCrawl = await shouldDoFullCrawl('fc2');
          const limit = fullCrawl ? '99999' : '100';
          const command = `npx tsx scripts/crawlers/crawl-fc2.ts --limit=${limit}`;
          console.log(`Executing: ${command}`);
          execSync(command, { stdio: 'inherit', env: process.env });
        }
        break;

      case 'b10f':
        {
          const command = `npx tsx scripts/crawlers/crawl-b10f-csv.ts`;
          console.log(`Executing: ${command}`);
          execSync(command, { stdio: 'inherit', env: process.env });
        }
        break;

      default:
        console.error(`Unknown crawler type: ${crawlerType}`);
        console.log('Available types:');
        console.log('  Product crawlers: mgs, sokmil, duga, duga-api, fc2, b10f');
        console.log('  DTI crawlers: caribbeancom, heyzo, caribbeancompr, 1pondo');
        console.log('  Wiki crawlers: av-wiki, seesaawiki, seesaawiki-all, seesaawiki-range, wiki');
        console.log('  Utility crawlers: sales');
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

    // Generate AI reviews for performers (limited batch to avoid API rate limits)
    console.log('\n--- Generating AI reviews for performers ---');
    try {
      execSync('npx tsx scripts/generate-performer-reviews.ts --limit=20', { stdio: 'inherit', env: process.env });
      console.log('✓ Performer AI review generation completed');
    } catch (reviewError) {
      console.error('⚠ Performer AI review generation failed (non-critical):', reviewError);
      // Don't exit on review generation failure - it's not critical
    }
  } catch (error) {
    console.error(`✗ ${crawlerType} crawler failed:`, error);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
  }
}

main().catch(console.error);
