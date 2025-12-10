import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface TrackViewRequest {
  productId?: number;
  performerId?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: TrackViewRequest = await request.json();
    const db = getDb();

    if (body.productId) {
      // Track product view
      await db.execute(sql`
        INSERT INTO product_views (product_id, viewed_at)
        VALUES (${body.productId}, NOW())
      `);
    }

    if (body.performerId) {
      // Track performer view
      await db.execute(sql`
        INSERT INTO performer_views (performer_id, viewed_at)
        VALUES (${body.performerId}, NOW())
      `);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking view:', error);
    // Don't fail the request if tracking fails
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
