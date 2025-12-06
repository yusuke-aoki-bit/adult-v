/**
 * DTI Unified Crawler
 * Entry point for crawling all DTI-affiliated sites
 *
 * Usage:
 *   npx tsx scripts/crawlers/dti/index.ts --site 1pondo --limit 50
 *   npx tsx scripts/crawlers/dti/index.ts --site caribbeancom --start 112024_001
 *   npx tsx scripts/crawlers/dti/index.ts --all --limit 10
 *   npx tsx scripts/crawlers/dti/index.ts --list
 */

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { DTIBaseCrawler, DTISiteConfig, CrawlOptions } from '../../../lib/providers/dti-base';

// Import individual crawlers
import { IppondoCrawler, IPPONDO_CONFIG } from './crawl-1pondo';
import { CaribbeancomCrawler, CARIBBEANCOM_CONFIG } from './crawl-caribbeancom';
import { CaribbeancomprCrawler, CARIBBEANCOMPR_CONFIG } from './crawl-caribbeancompr';
import { HeyzoCrawler, HEYZO_CONFIG } from './crawl-heyzo';
import { TenmusumeCrawler, TENMUSUME_CONFIG } from './crawl-10musume';
import { PacopacomamaCrawler, PACOPACOMAMA_CONFIG } from './crawl-pacopacomama';
import { HitozumagiriCrawler, HITOZUMAGIRI_CONFIG } from './crawl-hitozumagiri';
import { Kin8tengokuCrawler, KIN8TENGOKU_CONFIG } from './crawl-kin8tengoku';
import { EcchiSitesCrawler, ECCHI_CONFIGS } from './crawl-ecchi-sites';
import { OtherSitesCrawler, OTHER_CONFIGS } from './crawl-other-sites';

// ============================================================
// Site Registry
// ============================================================

interface SiteEntry {
  aliases: string[];
  config: DTISiteConfig;
  createCrawler: () => DTIBaseCrawler;
  priority: 'high' | 'medium' | 'low';
}

const SITE_REGISTRY: Record<string, SiteEntry> = {
  // High priority sites
  '1pondo': {
    aliases: ['1pondo', 'ippondo', '一本道'],
    config: IPPONDO_CONFIG,
    createCrawler: () => new IppondoCrawler(),
    priority: 'high',
  },
  caribbeancom: {
    aliases: ['caribbeancom', 'carib', 'カリビアンコム'],
    config: CARIBBEANCOM_CONFIG,
    createCrawler: () => new CaribbeancomCrawler(),
    priority: 'high',
  },
  caribbeancompr: {
    aliases: ['caribbeancompr', 'caribpr', 'カリビアンコムプレミアム'],
    config: CARIBBEANCOMPR_CONFIG,
    createCrawler: () => new CaribbeancomprCrawler(),
    priority: 'high',
  },
  heyzo: {
    aliases: ['heyzo', 'HEYZO'],
    config: HEYZO_CONFIG,
    createCrawler: () => new HeyzoCrawler(),
    priority: 'high',
  },

  // Medium priority sites
  '10musume': {
    aliases: ['10musume', 'tenmusume', '天然むすめ'],
    config: TENMUSUME_CONFIG,
    createCrawler: () => new TenmusumeCrawler(),
    priority: 'medium',
  },
  pacopacomama: {
    aliases: ['pacopacomama', 'paco', 'パコパコママ'],
    config: PACOPACOMAMA_CONFIG,
    createCrawler: () => new PacopacomamaCrawler(),
    priority: 'medium',
  },
  hitozumagiri: {
    aliases: ['hitozumagiri', 'hitozuma', '人妻斬り'],
    config: HITOZUMAGIRI_CONFIG,
    createCrawler: () => new HitozumagiriCrawler(),
    priority: 'medium',
  },
  kin8tengoku: {
    aliases: ['kin8tengoku', 'kin8', '金髪天國'],
    config: KIN8TENGOKU_CONFIG,
    createCrawler: () => new Kin8tengokuCrawler(),
    priority: 'medium',
  },

  // Low priority sites - Ecchi series
  '0930': {
    aliases: ['0930', 'h0930', 'エッチな0930'],
    config: ECCHI_CONFIGS['0930'],
    createCrawler: () => new EcchiSitesCrawler('0930'),
    priority: 'low',
  },
  '4610': {
    aliases: ['4610', 'h4610', 'エッチな4610'],
    config: ECCHI_CONFIGS['4610'],
    createCrawler: () => new EcchiSitesCrawler('4610'),
    priority: 'low',
  },
  '0230': {
    aliases: ['0230', 'h0230', 'エッチな0230'],
    config: ECCHI_CONFIGS['0230'],
    createCrawler: () => new EcchiSitesCrawler('0230'),
    priority: 'low',
  },
  '0930world': {
    aliases: ['0930world', 'エッチな0930WORLD'],
    config: ECCHI_CONFIGS['0930world'],
    createCrawler: () => new EcchiSitesCrawler('0930world'),
    priority: 'low',
  },

  // Low priority sites - Other
  nozox: {
    aliases: ['nozox', 'NOZOX'],
    config: OTHER_CONFIGS['nozox'],
    createCrawler: () => new OtherSitesCrawler('nozox'),
    priority: 'low',
  },
  '3d-eros': {
    aliases: ['3d-eros', '3deros', '3D-EROS.NET'],
    config: OTHER_CONFIGS['3d-eros'],
    createCrawler: () => new OtherSitesCrawler('3d-eros'),
    priority: 'low',
  },
  pikkur: {
    aliases: ['pikkur', 'Pikkur'],
    config: OTHER_CONFIGS['pikkur'],
    createCrawler: () => new OtherSitesCrawler('pikkur'),
    priority: 'low',
  },
  javholic: {
    aliases: ['javholic', 'Javholic'],
    config: OTHER_CONFIGS['javholic'],
    createCrawler: () => new OtherSitesCrawler('javholic'),
    priority: 'low',
  },
};

// ============================================================
// Helper Functions
// ============================================================

function findSiteEntry(siteName: string): SiteEntry | null {
  const normalized = siteName.toLowerCase();

  // Direct match
  if (SITE_REGISTRY[normalized]) {
    return SITE_REGISTRY[normalized];
  }

  // Search by alias
  for (const [key, entry] of Object.entries(SITE_REGISTRY)) {
    if (entry.aliases.some((alias) => alias.toLowerCase() === normalized)) {
      return entry;
    }
  }

  return null;
}

function listSites(): void {
  console.log('========================================');
  console.log('Available DTI Sites');
  console.log('========================================\n');

  console.log('🔴 High Priority:');
  for (const [key, entry] of Object.entries(SITE_REGISTRY)) {
    if (entry.priority === 'high') {
      console.log(`  ${key.padEnd(20)} - ${entry.config.siteName}`);
    }
  }

  console.log('\n🟡 Medium Priority:');
  for (const [key, entry] of Object.entries(SITE_REGISTRY)) {
    if (entry.priority === 'medium') {
      console.log(`  ${key.padEnd(20)} - ${entry.config.siteName}`);
    }
  }

  console.log('\n🟢 Low Priority:');
  for (const [key, entry] of Object.entries(SITE_REGISTRY)) {
    if (entry.priority === 'low') {
      console.log(`  ${key.padEnd(20)} - ${entry.config.siteName}`);
    }
  }

  console.log('\n========================================');
  console.log('Usage Examples:');
  console.log('  npx tsx scripts/crawlers/dti/index.ts --site 1pondo --limit 50');
  console.log('  npx tsx scripts/crawlers/dti/index.ts --all --limit 10');
  console.log('  npx tsx scripts/crawlers/dti/index.ts --priority high --limit 20');
  console.log('========================================\n');
}

// ============================================================
// CLI Entry Point
// ============================================================

interface CliOptions extends CrawlOptions {
  site?: string;
  all?: boolean;
  list?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    enableAI: !args.includes('--no-ai'),
    forceReprocess: args.includes('--force'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--site' && i + 1 < args.length) {
      options.site = args[i + 1];
      i++;
    } else if (arg === '--start' && i + 1 < args.length) {
      options.startId = args[i + 1];
      i++;
    } else if (arg === '--limit' && i + 1 < args.length) {
      options.limit = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--list') {
      options.list = true;
    } else if (arg === '--priority' && i + 1 < args.length) {
      options.priority = args[i + 1] as 'high' | 'medium' | 'low';
      i++;
    }
  }

  return options;
}

async function crawlSites(
  sites: SiteEntry[],
  options: CrawlOptions
): Promise<void> {
  console.log(`\nCrawling ${sites.length} site(s)...\n`);

  for (const siteEntry of sites) {
    console.log('========================================');
    console.log(`${siteEntry.config.siteName} Crawler`);
    console.log('========================================\n');

    try {
      const crawler = siteEntry.createCrawler();
      await crawler.crawl(options);
    } catch (error) {
      console.error(`Error crawling ${siteEntry.config.siteName}:`, error);
    }
  }
}

async function main() {
  const options = parseArgs();

  // List sites
  if (options.list) {
    listSites();
    return;
  }

  // Single site
  if (options.site) {
    const entry = findSiteEntry(options.site);
    if (!entry) {
      console.error(`ERROR: Unknown site: ${options.site}`);
      console.error('Use --list to see available sites');
      process.exit(1);
    }

    await crawlSites([entry], options);
    return;
  }

  // All sites
  if (options.all) {
    const allSites = Object.values(SITE_REGISTRY);
    await crawlSites(allSites, options);
    return;
  }

  // By priority
  if (options.priority) {
    const sites = Object.values(SITE_REGISTRY).filter(
      (entry) => entry.priority === options.priority
    );
    if (sites.length === 0) {
      console.error(`ERROR: No sites found with priority: ${options.priority}`);
      process.exit(1);
    }
    await crawlSites(sites, options);
    return;
  }

  // No options - show help
  console.log('DTI Unified Crawler\n');
  console.log('Options:');
  console.log('  --site <name>      Crawl a specific site');
  console.log('  --all              Crawl all sites');
  console.log('  --priority <level> Crawl sites by priority (high/medium/low)');
  console.log('  --list             List all available sites');
  console.log('  --limit <n>        Limit number of products per site');
  console.log('  --start <id>       Start from specific ID');
  console.log('  --no-ai            Disable AI features');
  console.log('  --force            Force reprocessing (ignore processedAt)');
  console.log('\nExample:');
  console.log('  npx tsx scripts/crawlers/dti/index.ts --site 1pondo --limit 50');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Export for programmatic use
export {
  SITE_REGISTRY,
  findSiteEntry,
  crawlSites,
};
