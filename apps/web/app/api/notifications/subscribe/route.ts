import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const subscription = await request.json();

    // Validate subscription object
    if (!subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: 'Invalid subscription object' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Store subscription in database
    // Note: You'll need to create a push_subscriptions table first
    await db.execute(sql`
      INSERT INTO push_subscriptions (endpoint, keys, created_at)
      VALUES (
        ${subscription.endpoint},
        ${JSON.stringify(subscription.keys)},
        NOW()
      )
      ON CONFLICT (endpoint)
      DO UPDATE SET
        keys = ${JSON.stringify(subscription.keys)},
        updated_at = NOW()
    `);

    return NextResponse.json(
      { success: true, message: 'Subscription saved successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}
