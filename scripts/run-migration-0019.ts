import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('Running migration 0019: Add currency, subscription, and AI review columns...');

  const statements = [
    // Add currency column
    `ALTER TABLE product_sources ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'JPY'`,
    // Add is_subscription column
    `ALTER TABLE product_sources ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false`,
    // Add AI review columns
    `ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review TEXT`,
    `ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_updated_at TIMESTAMP`,
  ];

  for (const statement of statements) {
    try {
      console.log(`Executing: ${statement.substring(0, 80)}...`);
      await db.execute(sql.raw(statement));
      console.log('  Done');
    } catch (error: any) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('  Already exists, skipping...');
      } else {
        console.error(`  Error: ${error.message}`);
      }
    }
  }

  // Data updates
  console.log('\nUpdating existing records...');

  // Update DTI subscription records (price = 0 or null)
  try {
    const result1 = await db.execute(sql`
      UPDATE product_sources
      SET is_subscription = true
      WHERE asp_name = 'DTI' AND (price IS NULL OR price = 0)
    `);
    console.log(`  Updated DTI subscription records`);
  } catch (error: any) {
    console.error(`  Error updating DTI subscriptions: ${error.message}`);
  }

  // Update Japanska as subscription
  try {
    const result2 = await db.execute(sql`
      UPDATE product_sources
      SET is_subscription = true
      WHERE asp_name = 'Japanska'
    `);
    console.log(`  Updated Japanska records`);
  } catch (error: any) {
    console.error(`  Error updating Japanska: ${error.message}`);
  }

  // Update DTI PPV records (price > 0)
  try {
    const result3 = await db.execute(sql`
      UPDATE product_sources
      SET is_subscription = false, currency = 'USD'
      WHERE asp_name = 'DTI' AND price > 0
    `);
    console.log(`  Updated DTI PPV records with USD currency`);
  } catch (error: any) {
    console.error(`  Error updating DTI PPV: ${error.message}`);
  }

  // Create indexes
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_sources_subscription ON product_sources(is_subscription)`,
    `CREATE INDEX IF NOT EXISTS idx_sources_currency ON product_sources(currency)`,
    `CREATE INDEX IF NOT EXISTS idx_performers_ai_review ON performers(ai_review_updated_at)`,
  ];

  console.log('\nCreating indexes...');
  for (const stmt of indexes) {
    try {
      await db.execute(sql.raw(stmt));
      console.log(`  Created: ${stmt.split(' ')[5]}`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`  Index already exists, skipping...`);
      } else {
        console.error(`  Error: ${error.message}`);
      }
    }
  }

  // Verify the changes
  console.log('\nVerifying changes...');
  const subscriptionStats = await db.execute(sql`
    SELECT
      is_subscription,
      currency,
      COUNT(*) as count
    FROM product_sources
    WHERE asp_name IN ('DTI', 'Japanska')
    GROUP BY is_subscription, currency
    ORDER BY is_subscription, currency
  `);
  console.log('\nDTI/Japanska subscription/currency stats:');
  for (const row of subscriptionStats.rows as any[]) {
    console.log(`  is_subscription=${row.is_subscription}, currency=${row.currency}: ${row.count} records`);
  }

  console.log('\nMigration completed!');
}

runMigration().catch(console.error);
