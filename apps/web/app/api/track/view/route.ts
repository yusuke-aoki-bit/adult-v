import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createTrackViewHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

async function trackProductView(productId: number) {
  const db = getDb();
  await db.execute(sql`
    INSERT INTO product_views (product_id, viewed_at)
    VALUES (${productId}, NOW())
  `);
}

async function trackPerformerView(performerId: number) {
  const db = getDb();
  await db.execute(sql`
    INSERT INTO performer_views (performer_id, viewed_at)
    VALUES (${performerId}, NOW())
  `);
}

export const POST = createTrackViewHandler({
  trackProductView,
  trackPerformerView,
});
