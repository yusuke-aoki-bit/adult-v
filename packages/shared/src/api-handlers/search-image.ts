import { NextRequest, NextResponse } from 'next/server';

export interface SearchImageHandlerDeps {
  getDb: () => any;
  products: any;
  productTags: any;
  productSources: any;
  tags: any;
  sql: any;
  inArray: any;
  analyzeImageForSearch: (params: any) => Promise<any>;
  calculateImageTextSimilarity: (params: any) => Promise<any>;
}

export function createSearchImageHandler(deps: SearchImageHandlerDeps) {
  return async function POST(request: NextRequest) {
    try {
      const formData = await request.formData();
      const imageFile = formData.get('image') as File | null;

      if (!imageFile) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
      if (imageFile.size > 5 * 1024 * 1024)
        return NextResponse.json({ error: 'Image too large. Max 5MB allowed.' }, { status: 400 });
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(imageFile.type))
        return NextResponse.json({ error: 'Invalid image type. Allowed: JPEG, PNG, WebP, GIF' }, { status: 400 });

      const arrayBuffer = await imageFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const db = deps.getDb();

      const availableTags = await db
        .select({ name: deps.tags.name })
        .from(deps.tags)
        .where(deps.sql`${deps.tags.category} = 'genre' OR ${deps.tags.category} IS NULL`)
        .limit(100);

      const analysis = await deps.analyzeImageForSearch({
        imageBase64: base64,
        mimeType: imageFile.type,
        availableGenres: availableTags.map((t: any) => t.name),
      });

      if (!analysis)
        return NextResponse.json({
          success: false,
          fallback: true,
          results: [],
          analysis: null,
          message: 'Failed to analyze image',
        });

      const searchTerms = [...analysis.searchKeywords, ...analysis.suggestedGenres];
      const searchQuery = searchTerms.slice(0, 5).join(' | ');

      const candidatesResult = await db.execute(deps.sql`
        SELECT DISTINCT p.id, p.title, p.normalized_product_id as "normalizedProductId", p.default_thumbnail_url as "imageUrl",
          ts_rank(p.search_vector, to_tsquery('japanese', ${searchQuery})) as rank
        FROM ${deps.products} p WHERE p.search_vector @@ to_tsquery('japanese', ${searchQuery})
          AND p.default_thumbnail_url IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM ${deps.productSources} ps WHERE ps.product_id = p.id AND ps.asp_name = 'DTI')
        ORDER BY rank DESC LIMIT 30
      `);

      let candidates = candidatesResult.rows as any[];

      if (candidates.length < 10 && analysis.suggestedGenres.length > 0) {
        const tagRecords = await db
          .select({ id: deps.tags.id, name: deps.tags.name })
          .from(deps.tags)
          .where(deps.inArray(deps.tags.name, analysis.suggestedGenres));
        if (tagRecords.length > 0) {
          const tagIds = tagRecords.map((t: any) => t.id);
          const excludeIds = candidates.length > 0 ? candidates.map((c: any) => c.id) : [0];
          const tagBasedResult = await db.execute(deps.sql`
            SELECT DISTINCT p.id, p.title, p.normalized_product_id as "normalizedProductId", p.default_thumbnail_url as "imageUrl", COUNT(pt.tag_id) as tag_match_count
            FROM ${deps.products} p INNER JOIN ${deps.productTags} pt ON p.id = pt.product_id
            WHERE pt.tag_id = ANY(ARRAY[${deps.sql.join(
              tagIds.map((id: number) => deps.sql`${id}`),
              deps.sql`, `,
            )}]::int[])
              AND p.default_thumbnail_url IS NOT NULL
              AND p.id != ALL(ARRAY[${deps.sql.join(
                excludeIds.map((id: number) => deps.sql`${id}`),
                deps.sql`, `,
              )}]::int[])
              AND NOT EXISTS (SELECT 1 FROM ${deps.productSources} ps WHERE ps.product_id = p.id AND ps.asp_name = 'DTI')
            GROUP BY p.id ORDER BY tag_match_count DESC LIMIT ${20 - candidates.length}
          `);
          candidates = [...candidates, ...(tagBasedResult.rows as any[]).map((c: any) => ({ ...c, rank: 0 }))];
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

      const candidateIds = candidates.map((c: any) => c.id);
      const candidateTags = await db
        .select({ productId: deps.productTags.productId, tagName: deps.tags.name })
        .from(deps.productTags)
        .innerJoin(deps.tags, deps.sql`${deps.productTags.tagId} = ${deps.tags.id}`)
        .where(deps.inArray(deps.productTags.productId, candidateIds));

      const tagsByProduct = new Map<number, string[]>();
      for (const ct of candidateTags) {
        if (!tagsByProduct.has(ct.productId)) tagsByProduct.set(ct.productId, []);
        tagsByProduct.get(ct.productId)!.push(ct.tagName);
      }

      const productsForScoring = candidates
        .slice(0, 20)
        .map((c: any) => ({ id: c.id, title: c.title, genres: tagsByProduct.get(c.id) || [] }));
      const similarityScores = await deps.calculateImageTextSimilarity({
        imageBase64: base64,
        mimeType: imageFile.type,
        products: productsForScoring,
      });

      const results: any[] = [];
      if (similarityScores && similarityScores.length > 0) {
        for (const score of similarityScores) {
          const candidate = candidates.find((c: any) => c.id === score.id);
          if (candidate)
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
      } else {
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
      return NextResponse.json({
        success: false,
        fallback: true,
        results: [],
        analysis: null,
        message: 'Image search temporarily unavailable',
      });
    }
  };
}
