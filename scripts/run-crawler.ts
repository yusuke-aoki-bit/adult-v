/**
 * Unified crawler runner for Cloud Run Jobs
 *
 * Usage:
 *   npx tsx scripts/run-crawler.ts mgs [--pages 10]
 *   npx tsx scripts/run-crawler.ts caribbeancom [--limit 100]
 *   npx tsx scripts/run-crawler.ts heyzo [--limit 100]
 */

import { execSync } from 'child_process';

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const crawlerType = process.argv[2];
const args = process.argv.slice(3);

console.log(`Starting ${crawlerType} crawler...`);
console.log(`Arguments: ${args.join(' ')}`);

try {
  switch (crawlerType) {
    case 'mgs':
      {
        const maxPages = args.find((arg, i) => args[i - 1] === '--pages') || '5';
        const command = `npx tsx scripts/crawlers/crawl-mgs-list.ts "https://www.mgstage.com/search/cSearch.php?sort=new&disp_type=3" --max-pages ${maxPages}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'caribbeancom':
      {
        const limit = args.find((arg, i) => args[i - 1] === '--limit') || '50';
        const start = args.find((arg, i) => args[i - 1] === '--start') || '122024_001';
        const command = `npx tsx scripts/crawlers/crawl-dti-sites.ts --site caribbeancom --start "${start}" --limit ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'heyzo':
      {
        const limit = args.find((arg, i) => args[i - 1] === '--limit') || '100';
        const start = args.find((arg, i) => args[i - 1] === '--start') || '0001';
        const command = `npx tsx scripts/crawlers/crawl-dti-sites.ts --site heyzo --start "${start}" --limit ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'caribbeancompr':
      {
        const limit = args.find((arg, i) => args[i - 1] === '--limit') || '100';
        const start = args.find((arg, i) => args[i - 1] === '--start') || '122024_001';
        const command = `npx tsx scripts/crawlers/crawl-dti-sites.ts --site caribbeancompr --start "${start}" --limit ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case '1pondo':
      {
        const limit = args.find((arg, i) => args[i - 1] === '--limit') || '100';
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
        const limit = args.find((arg, i) => args[i - 1] === '--limit') || '100';
        const command = `npx tsx scripts/crawlers/crawl-wiki-performers.ts av-wiki ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'seesaawiki':
      {
        const limit = args.find((arg, i) => args[i - 1] === '--limit') || '100';
        const command = `npx tsx scripts/crawlers/crawl-wiki-performers.ts seesaawiki ${limit}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });
      }
      break;

    case 'wiki':
      {
        const limit = args.find((arg, i) => args[i - 1] === '--limit') || '100';
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
}
