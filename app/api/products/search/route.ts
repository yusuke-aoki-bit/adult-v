import { NextResponse } from 'next/server';
import { getProducts, type SortOption } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

// 許可されたソートオプション
const VALID_SORT_OPTIONS: SortOption[] = [
  'releaseDateDesc',
  'releaseDateAsc',
  'priceAsc',
  'priceDesc',
  'nameAsc',
  'nameDesc',
  'viewsDesc',
];

function isValidSortOption(value: string | null): value is SortOption {
  return value !== null && VALID_SORT_OPTIONS.includes(value as SortOption);
}

// 数値パラメータのサニタイズ
function sanitizeNumber(
  value: string | null,
  defaultValue: number,
  min: number,
  max: number
): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.max(min, Math.min(parsed, max));
}

/**
 * 商品を検索するAPIエンドポイント
 *
 * @param request - GET /api/products/search?q=xxx&limit=20&site=DMM&minPrice=100&maxPrice=5000
 * @returns 検索結果の商品リストまたはエラー
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const site = searchParams.get('site');
    const sortByParam = searchParams.get('sortBy');
    const tags = searchParams.get('tags');
    const excludeTags = searchParams.get('excludeTags');
    const hasVideo = searchParams.get('hasVideo') === 'true' ? true : undefined;
    const hasImage = searchParams.get('hasImage') === 'true' ? true : undefined;

    // 数値パラメータのバリデーション
    const limit = sanitizeNumber(searchParams.get('limit'), 50, 1, 100);
    const offset = sanitizeNumber(searchParams.get('offset'), 0, 0, 10000);
    const minPrice = searchParams.get('minPrice')
      ? sanitizeNumber(searchParams.get('minPrice'), 0, 0, 1000000)
      : undefined;
    const maxPrice = searchParams.get('maxPrice')
      ? sanitizeNumber(searchParams.get('maxPrice'), 1000000, 0, 1000000)
      : undefined;

    // ソートオプションのバリデーション
    const sortBy: SortOption = isValidSortOption(sortByParam)
      ? sortByParam
      : 'releaseDateDesc';

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // クエリの長さ制限
    if (query.length > 200) {
      return NextResponse.json(
        { error: 'Search query is too long (max 200 characters)' },
        { status: 400 }
      );
    }

    // タグIDの配列に変換（数値のみ許可）
    const tagIds = tags
      ? tags.split(',').filter((id) => /^\d+$/.test(id))
      : undefined;
    const excludeTagIds = excludeTags
      ? excludeTags.split(',').filter((id) => /^\d+$/.test(id))
      : undefined;

    // getProducts関数を使用して高度な検索を実行
    const products = await getProducts({
      query,
      limit,
      offset,
      provider: site || undefined,
      minPrice,
      maxPrice,
      sortBy,
      tags: tagIds,
      excludeTags: excludeTagIds,
      hasVideo,
      hasImage,
    });

    return NextResponse.json({
      products,
      count: products.length,
      query,
      filters: {
        site,
        minPrice,
        maxPrice,
        sortBy,
        tags: tagIds,
        excludeTags: excludeTagIds,
        hasVideo,
        hasImage,
      }
    });
  } catch (error) {
    console.error('Error searching products:', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
}
