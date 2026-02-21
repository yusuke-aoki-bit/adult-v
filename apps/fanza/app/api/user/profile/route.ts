import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productPerformers, productTags, performers, tags } from '@/lib/db/schema';
import { inArray, eq } from 'drizzle-orm';
import { generateUserPreferenceProfile } from '@adult-v/shared/lib/llm-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RecentlyViewedItem {
  id: string;
  title: string;
}

/**
 * ユーザー好みプロファイルAPI
 * POST /api/user/profile
 */
export async function POST(request: NextRequest) {
  try {
    const { history } = await request.json() as {
      history: RecentlyViewedItem[];
    };

    if (!history || !Array.isArray(history) || history.length < 5) {
      return NextResponse.json({
        success: false,
        profile: null,
        message: 'もう少し作品を閲覧するとプロファイルが生成されます（5件以上必要）',
      });
    }

    const db = getDb();
    const productIds = history.slice(0, 20).map(h => parseInt(h.id, 10)).filter(id => !isNaN(id));

    if (productIds.length < 5) {
      return NextResponse.json({
        success: false,
        profile: null,
        message: '有効な履歴が不足しています',
      });
    }

    // 1. 作品情報を取得
    const [productData, performerData, tagData] = await Promise.all([
      db
        .select({
          id: products.id,
          title: products.title,
          releaseDate: products.releaseDate,
        })
        .from(products)
        .where(inArray(products.id, productIds)),

      db
        .select({
          productId: productPerformers.productId,
          performerName: performers.name,
        })
        .from(productPerformers)
        .innerJoin(performers, eq(productPerformers.performerId, performers.id))
        .where(inArray(productPerformers.productId, productIds)),

      db
        .select({
          productId: productTags.productId,
          tagName: tags.name,
          tagCategory: tags.category,
        })
        .from(productTags)
        .innerJoin(tags, eq(productTags.tagId, tags.id))
        .where(inArray(productTags.productId, productIds)),
    ]);

    // 2. 統計情報を計算
    const uniquePerformers = new Set(performerData.map(p => p.performerName));
    const uniqueGenres = new Set(
      tagData
        .filter(t => t.tagCategory === 'genre' || !t.tagCategory)
        .map(t => t.tagName)
    );

    // 3. LLM分析用のデータを整形
    const recentProducts = productData.map(p => {
      const productPerformerNames = performerData
        .filter(pd => pd.productId === p.id)
        .map(pd => pd.performerName);
      const productGenres = tagData
        .filter(td => td.productId === p.id && (td.tagCategory === 'genre' || !td.tagCategory))
        .map(td => td.tagName);

      return {
        title: p.title || '',
        performers: productPerformerNames,
        genres: productGenres,
        releaseDate: p.releaseDate ? new Date(p.releaseDate).toISOString().split('T')[0] : undefined,
      };
    });

    // 4. 利用可能なジャンルを取得
    const availableGenresResult = await db
      .select({ name: tags.name })
      .from(tags)
      .where(eq(tags.category, 'genre'))
      .limit(50);
    const availableGenres = availableGenresResult.map(r => r.name);

    // 5. LLMでプロファイル生成
    const profile = await generateUserPreferenceProfile({
      recentProducts,
      viewingStats: {
        totalViewed: history.length,
        uniquePerformers: uniquePerformers.size,
        uniqueGenres: uniqueGenres.size,
      },
      availableGenres,
    });

    if (!profile) {
      return NextResponse.json({
        success: false,
        profile: null,
        message: 'プロファイル生成に失敗しました',
      });
    }

    // 6. 統計データも返す
    const stats = {
      totalViewed: history.length,
      uniquePerformers: uniquePerformers.size,
      uniqueGenres: uniqueGenres.size,
      topPerformers: [...uniquePerformers].slice(0, 5),
      topGenres: [...uniqueGenres].slice(0, 5),
    };

    return NextResponse.json({
      success: true,
      profile,
      stats,
      message: 'プロファイルを生成しました',
    });

  } catch (error) {
    console.error('[User Profile API] Error:', error);
    return NextResponse.json({
      success: false,
      fallback: true,
      profile: null,
      message: 'プロファイル生成に失敗しました',
    });
  }
}
