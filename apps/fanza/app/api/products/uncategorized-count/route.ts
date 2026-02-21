import { NextResponse } from 'next/server';
import { getUncategorizedProductsCount } from '@/lib/db/queries';

export const revalidate = 300; // 5分キャッシュ

/**
 * 未整理商品数を取得
 * GET /api/products/uncategorized-count
 */
export async function GET() {
  try {
    const count = await getUncategorizedProductsCount();

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching uncategorized count:', error);
    return NextResponse.json({ count: 0, fallback: true });
  }
}
