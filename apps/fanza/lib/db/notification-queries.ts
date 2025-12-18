/**
 * Notifications DB Query Functions
 *
 * These functions are used by the shared notifications handler
 */

import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { SubscriptionKeys } from '@adult-v/shared/api-handlers';

/**
 * Save push subscription to database
 */
export async function saveSubscription(endpoint: string, keys: SubscriptionKeys): Promise<void> {
  const db = getDb();

  await db.execute(sql`
    INSERT INTO push_subscriptions (endpoint, keys, created_at)
    VALUES (
      ${endpoint},
      ${JSON.stringify(keys)},
      NOW()
    )
    ON CONFLICT (endpoint)
    DO UPDATE SET
      keys = ${JSON.stringify(keys)},
      updated_at = NOW()
  `);
}

/**
 * Remove push subscription from database
 */
export async function removeSubscription(endpoint: string): Promise<void> {
  const db = getDb();

  await db.execute(sql`
    DELETE FROM push_subscriptions
    WHERE endpoint = ${endpoint}
  `);
}
