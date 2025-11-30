import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

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
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const site = searchParams.get('site'); // サイトフィルター (DMM, DUGA, etc.)
    const minPriceParam = searchParams.get('minPrice');
    const maxPriceParam = searchParams.get('maxPrice');
    const sortBy = searchParams.get('sortBy'); // ソート順
    const tags = searchParams.get('tags'); // タグフィルター (カンマ区切り)
    const excludeTags = searchParams.get('excludeTags'); // 除外タグ (カンマ区切り)
    const hasVideo = searchParams.get('hasVideo') === 'true' ? true : undefined; // サンプル動画あり
    const hasImage = searchParams.get('hasImage') === 'true' ? true : undefined; // サンプル画像あり

    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    const minPrice = minPriceParam ? parseInt(minPriceParam, 10) : undefined;
    const maxPrice = maxPriceParam ? parseInt(maxPriceParam, 10) : undefined;

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // タグIDの配列に変換
    const tagIds = tags ? tags.split(',').filter(Boolean) : undefined;
    const excludeTagIds = excludeTags ? excludeTags.split(',').filter(Boolean) : undefined;

    // getProducts関数を使用して高度な検索を実行
    const products = await getProducts({
      query,
      limit,
      offset,
      provider: site || undefined,
      minPrice,
      maxPrice,
      sortBy: sortBy as any || 'releaseDateDesc',
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
