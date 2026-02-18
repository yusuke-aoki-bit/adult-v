import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productTags, tags, productSources } from '@/lib/db/schema';
import { sql, inArray } from 'drizzle-orm';
import { analyzeImageForSearch, calculateImageTextSimilarity } from '@adult-v/shared/lib/llm-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SearchResult {
  id: number;
  title: string;
  normalizedProductId: string | null;
  imageUrl: string | null;
  genres: string[];
  score: number;
  matchReason: string;
}

/**
 * 画像検索API
 * POST /api/search/image
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック (5MB制限)
    if (imageFile.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Max 5MB allowed.' },
        { status: 400 }
      );
    }

    // MIMEタイプチェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'Invalid image type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    // 画像をBase64に変換
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const db = getDb();

    // 利用可能なジャンル/タグを取得
    const availableTags = await db
      .select({ name: tags.name })
      .from(tags)
      .where(sql`${tags.category} = 'genre' OR ${tags.category} IS NULL`)
      .limit(100);

    // Step 1: 画像を分析してキーワードを抽出
    const analysis = await analyzeImageForSearch({
      imageBase64: base64,
      mimeType: imageFile.type,
      availableGenres: availableTags.map(t => t.name),
    });

    if (!analysis) {
      return NextResponse.json(
        { error: 'Failed to analyze image' },
        { status: 500 }
      );
    }

    // Step 2: 抽出されたキーワードとジャンルで候補作品を検索
    const searchTerms = [...analysis.searchKeywords, ...analysis.suggestedGenres];

    // キーワードでの全文検索
    const searchQuery = searchTerms.slice(0, 5).join(' | ');

    const candidatesResult = await db.execute(sql`
      SELECT DISTINCT
        p.id,
        p.title,
        p.normalized_product_id as "normalizedProductId",
        p.default_thumbnail_url as "imageUrl",
        ts_rank(p.search_vector, to_tsquery('japanese', ${searchQuery})) as rank
      FROM ${products} p
      WHERE p.search_vector @@ to_tsquery('japanese', ${searchQuery})
        AND p.default_thumbnail_url IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM ${productSources} ps
          WHERE ps.product_id = p.id AND ps.asp_name = 'DTI'
        )
      ORDER BY rank DESC
      LIMIT 30
    `);

    // 検索結果が少ない場合はジャンルベースで補完
    let candidates = candidatesResult.rows as Array<{
      id: number;
      title: string;
      normalizedProductId: string | null;
      imageUrl: string | null;
      rank: number;
    }>;

    if (candidates.length < 10 && analysis.suggestedGenres.length > 0) {
      // タグIDを取得
      const tagRecords = await db
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(inArray(tags.name, analysis.suggestedGenres));

      if (tagRecords.length > 0) {
        const tagIds = tagRecords.map(t => t.id);
        const excludeIds = candidates.length > 0 ? candidates.map(c => c.id) : [0];

        const tagBasedResult = await db.execute(sql`
          SELECT DISTINCT
            p.id,
            p.title,
            p.normalized_product_id as "normalizedProductId",
            p.default_thumbnail_url as "imageUrl",
            COUNT(pt.tag_id) as tag_match_count
          FROM ${products} p
          INNER JOIN ${productTags} pt ON p.id = pt.product_id
          WHERE pt.tag_id = ANY(ARRAY[${sql.join(tagIds.map((id: number) => sql`${id}`), sql`, `)}]::int[])
            AND p.default_thumbnail_url IS NOT NULL
            AND p.id != ALL(ARRAY[${sql.join(excludeIds.map((id: number) => sql`${id}`), sql`, `)}]::int[])
            AND NOT EXISTS (
              SELECT 1 FROM ${productSources} ps
              WHERE ps.product_id = p.id AND ps.asp_name = 'DTI'
            )
          GROUP BY p.id
          ORDER BY tag_match_count DESC
          LIMIT ${20 - candidates.length}
        `);

        const additionalCandidates = tagBasedResult.rows as Array<{
          id: number;
          title: string;
          normalizedProductId: string | null;
          imageUrl: string | null;
        }>;

        candidates = [
          ...candidates,
          ...additionalCandidates.map(c => ({ ...c, rank: 0 }))
        ];
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        analysis: {
          description: analysis.description,
          keywords: analysis.searchKeywords,
          genres: analysis.suggestedGenres,
        },
        message: 'No matching products found',
      });
    }

    // 各候補のタグを取得
    const candidateIds = candidates.map(c => c.id);
    const candidateTags = await db
      .select({
        productId: productTags.productId,
        tagName: tags.name,
      })
      .from(productTags)
      .innerJoin(tags, sql`${productTags.tagId} = ${tags.id}`)
      .where(inArray(productTags.productId, candidateIds));

    const tagsByProduct = new Map<number, string[]>();
    for (const ct of candidateTags) {
      if (!tagsByProduct.has(ct.productId)) {
        tagsByProduct.set(ct.productId, []);
      }
      tagsByProduct.get(ct.productId)!.push(ct.tagName);
    }

    // Step 3: LLMで類似度スコアリング
    const productsForScoring = candidates.slice(0, 20).map(c => ({
      id: c.id,
      title: c.title,
      genres: tagsByProduct.get(c.id) || [],
    }));

    const similarityScores = await calculateImageTextSimilarity({
      imageBase64: base64,
      mimeType: imageFile.type,
      products: productsForScoring,
    });

    // 結果をマージ
    const results: SearchResult[] = [];

    if (similarityScores && similarityScores.length > 0) {
      for (const score of similarityScores) {
        const candidate = candidates.find(c => c.id === score.id);
        if (candidate) {
          results.push({
            id: candidate.id,
            title: candidate.title,
            normalizedProductId: candidate.normalizedProductId,
            imageUrl: candidate.imageUrl,
            genres: tagsByProduct.get(candidate.id) || [],
            score: score.score,
            matchReason: score.reason,
          });
        }
      }
    } else {
      // LLMスコアリングが失敗した場合はランクベースで返す
      for (const candidate of candidates.slice(0, 12)) {
        results.push({
          id: candidate.id,
          title: candidate.title,
          normalizedProductId: candidate.normalizedProductId,
          imageUrl: candidate.imageUrl,
          genres: tagsByProduct.get(candidate.id) || [],
          score: Math.round(50 + candidate.rank * 10),
          matchReason: 'キーワードマッチ',
        });
      }
    }

    // スコア順でソート
    results.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      results: results.slice(0, 12),
      analysis: {
        description: analysis.description,
        keywords: analysis.searchKeywords,
        genres: analysis.suggestedGenres,
        features: analysis.detectedFeatures,
      },
    });

  } catch (error) {
    console.error('[Image Search API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
