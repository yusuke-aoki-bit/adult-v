import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { endpoint } = await request.json();

    // Validate endpoint
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint is required' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Remove subscription from database
    await db.execute(sql`
      DELETE FROM push_subscriptions
      WHERE endpoint = ${endpoint}
    `);

    return NextResponse.json(
      { success: true, message: 'Subscription removed successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error removing subscription:', error);
    return NextResponse.json(
      { error: 'Failed to remove subscription' },
      { status: 500 }
    );
  }
}
