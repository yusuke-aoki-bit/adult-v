import { NextRequest, NextResponse } from 'next/server';
import { generateAutoTags } from '../lib/llm-service';
import { createApiErrorResponse } from '../lib/api-logger';

export interface AutoTagsHandlerDeps {
  getProductWithTags: (normalizedId: string) => Promise<{
    id: number;
    title: string;
    description: string | null;
    existingTags: string[];
  } | null>;
  getAvailableTags: () => Promise<string[]>;
}

export function createAutoTagsHandler(deps: AutoTagsHandlerDeps) {
  return async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const { id } = await params;

      const product = await deps.getProductWithTags(id);

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      const availableTags = await deps.getAvailableTags();

      const result = await generateAutoTags({
        title: product['title'],
        ...(product['description'] && { description: product['description'] }),
        existingTags: product.existingTags,
        availableTags,
      });

      if (!result) {
        return NextResponse.json({ error: 'Failed to generate tags' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        productId: id,
        existingTags: product.existingTags,
        ...result,
      });
    } catch (error) {
      return createApiErrorResponse(error, 'Internal server error', 500, {
        endpoint: '/api/products/[id]/auto-tags',
      });
    }
  };
}
