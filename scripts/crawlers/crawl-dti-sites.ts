/**
 * DTI Sites Crawler - Legacy Entry Point
 *
 * This file now delegates to the modular DTI crawlers in scripts/crawlers/dti/
 *
 * For individual site crawlers, use:
 *   npx tsx scripts/crawlers/dti/crawl-1pondo.ts --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-caribbeancom.ts --limit 50
 *   npx tsx scripts/crawlers/dti/crawl-heyzo.ts --limit 50
 *
 * For unified crawler:
 *   npx tsx scripts/crawlers/dti/index.ts --site 1pondo --limit 50
 *   npx tsx scripts/crawlers/dti/index.ts --all --limit 10
 *   npx tsx scripts/crawlers/dti/index.ts --list
 *
 * This legacy script is kept for backward compatibility.
 */

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import {
  SITE_REGISTRY,
  findSiteEntry,
  crawlSites,
} from './dti/index';

// ============================================================
// Legacy Argument Parsing
// ============================================================

interface LegacyOptions {
  site?: string;
  start?: string;
  limit?: number;
  enableAI: boolean;
}

function parseArgs(): LegacyOptions {
  const args = process.argv.slice(2);
  const options: LegacyOptions = {
    enableAI: !args.includes('--no-ai'),
  };

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

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('========================================');
  console.log('DTI Sites Crawler (Legacy Mode)');
  console.log('========================================');
  console.log('NOTE: This script now uses the modular crawlers.');
  console.log('For better control, use: npx tsx scripts/crawlers/dti/index.ts\n');

  const options = parseArgs();

  if (options.site) {
    // Single site mode
    const entry = findSiteEntry(options.site);
    if (!entry) {
      console.error(`ERROR: Unknown site: ${options.site}`);
      console.error('Available sites:');
      for (const [key, e] of Object.entries(SITE_REGISTRY)) {
        console.error(`  - ${key} (${e.config.siteName})`);
      }
      process.exit(1);
    }

    await crawlSites([entry], {
      startId: options.start,
      limit: options.limit,
      enableAI: options.enableAI,
    });
  } else {
    // All sites mode
    console.log('Crawling all DTI sites...\n');
    const allSites = Object.values(SITE_REGISTRY);

    await crawlSites(allSites, {
      limit: options.limit,
      enableAI: options.enableAI,
    });
  }

  console.log('\n========================================');
  console.log('DTI Sites Crawl Completed!');
  console.log('========================================\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
