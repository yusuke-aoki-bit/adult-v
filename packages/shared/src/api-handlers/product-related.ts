import { NextRequest, NextResponse } from 'next/server';

interface RelatedProduct {
  id: number;
  title: string | null;
  imageUrl: string | null;
  match_score: number | string;
}

export interface ProductRelatedHandlerDeps {
  getRelatedProductsByNames: (params: {
    performers: string[];
    tags: string[];
    excludeProductId?: string;
    limit: number;
  }) => Promise<RelatedProduct[]>;
}

export function createProductRelatedHandler(deps: ProductRelatedHandlerDeps) {
  return async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);

      const performersParam = searchParams.get('performers');
      const tagsParam = searchParams.get('tags');
      const excludeId = searchParams.get('exclude');
      const limitParam = searchParams.get('limit');

      const performers = performersParam ? performersParam.split(',').filter(Boolean) : [];
      const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : [];
      const limit = Math.min(parseInt(limitParam || '6', 10), 20);

      if (performers.length === 0 && tags.length === 0) {
        return NextResponse.json({ products: [] });
      }

      const relatedProducts = await deps.getRelatedProductsByNames({
        performers,
        tags,
        excludeProductId: excludeId || undefined,
        limit,
      });

      const productsWithScore = relatedProducts.map((product) => {
        const dbScore = Number(product.match_score) || 0;
        const matchScore = Math.min(95, Math.max(50, 50 + dbScore * 15));

        return {
          id: String(product.id),
          title: product.title,
          imageUrl: product.imageUrl || null,
          matchScore: Math.round(matchScore),
        };
      });

      productsWithScore.sort((a, b) => b.matchScore - a.matchScore);

      return NextResponse.json({ products: productsWithScore });
    } catch (error) {
      console.error('Error fetching related products:', error);
      return NextResponse.json({ products: [], fallback: true });
    }
  };
}
