import { NextRequest, NextResponse } from 'next/server';
import { generateKeywordSuggestions } from '../lib/llm-service';

export interface KeywordsHandlerDeps {
  getProductWithDetails: (normalizedId: string) => Promise<{
    id: number;
    title: string;
    description: string | null;
    performers: string[];
    tags: string[];
  } | null>;
}

export function createKeywordsHandler(deps: KeywordsHandlerDeps) {
  return async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const { id } = await params;

      const product = await deps.getProductWithDetails(id);

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      const result = await generateKeywordSuggestions({
        title: product.title,
        performers: product.performers,
        tags: product.tags,
        description: product.description || undefined,
      });

      if (!result) {
        return NextResponse.json({ error: 'Failed to generate keywords' }, { status: 500 });
      }

      return NextResponse.json({ success: true, productId: id, ...result });
    } catch (error) {
      console.error('[Keywords API] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
