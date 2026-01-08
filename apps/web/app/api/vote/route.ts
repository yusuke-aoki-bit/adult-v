import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * 投票を記録
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { productId, category, userId } = body;

    if (!productId || !category || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 既に投票済みかチェック
    const existingVote = await db.execute(sql`
      SELECT id FROM product_ranking_votes
      WHERE product_id = ${productId}
        AND category = ${category}
        AND user_id = ${userId}
    `);

    if (existingVote.rows.length > 0) {
      return NextResponse.json(
        { error: 'Already voted' },
        { status: 400 }
      );
    }

    // 投票を記録
    await db.execute(sql`
      INSERT INTO product_ranking_votes (product_id, category, user_id, created_at)
      VALUES (${productId}, ${category}, ${userId}, NOW())
    `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json(
      { error: 'Failed to vote' },
      { status: 500 }
    );
  }
}
