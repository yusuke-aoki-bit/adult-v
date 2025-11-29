import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkAliasStats() {
  const db = getDb();

  console.log('=== 別名データソース別統計 ===\n');

  // ソース別の別名数
  const bySource = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as alias_count,
      COUNT(DISTINCT performer_id) as unique_performers
    FROM performer_aliases
    GROUP BY source
    ORDER BY alias_count DESC
  `);

  console.log('データソース別:');
  console.table(bySource.rows);

  // 全体サマリー
  const summary = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM performers) as total_performers,
      (SELECT COUNT(*) FROM performer_aliases) as total_aliases,
      (SELECT COUNT(DISTINCT performer_id) FROM performer_aliases) as performers_with_aliases,
      (SELECT COUNT(*) FROM product_performers) as total_performer_product_links
  `);

  console.log('\n全体サマリー:');
  console.table(summary.rows);

  // 別名が多い女優TOP10
  const topPerformers = await db.execute(sql`
    SELECT
      p.name,
      COUNT(pa.id) as alias_count,
      ARRAY_AGG(pa.alias_name ORDER BY pa.alias_name) as aliases
    FROM performers p
    JOIN performer_aliases pa ON p.id = pa.performer_id
    GROUP BY p.id, p.name
    ORDER BY alias_count DESC
    LIMIT 10
  `);

  console.log('\n別名が多い女優 TOP10:');
  for (const row of topPerformers.rows) {
    const { name, alias_count, aliases } = row as any;
    console.log(`  ${name} (${alias_count}件)`);
    console.log(`    → ${(aliases as string[]).slice(0, 5).join(', ')}${alias_count > 5 ? '...' : ''}`);
  }

  process.exit(0);
}

checkAliasStats().catch(console.error);
