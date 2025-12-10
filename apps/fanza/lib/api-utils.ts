import { NextResponse } from 'next/server';

/**
 * API utility functions for validation and common operations
 */

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: NextResponse;
  params?: PaginationParams;
}

/**
 * Parse and validate pagination parameters
 */
export function validatePagination(searchParams: URLSearchParams): ValidationResult {
  const limitStr = searchParams.get('limit');
  const offsetStr = searchParams.get('offset');

  // Parse with parseInt for more strict validation
  const limit = limitStr ? parseInt(limitStr, 10) : 100;
  const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

  // Check for NaN
  if (isNaN(limit) || isNaN(offset)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      ),
    };
  }

  // Validate ranges
  if (limit < 30 || limit > 1000) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Limit must be between 30 and 1000' },
        { status: 400 }
      ),
    };
  }

  if (offset < 0) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Offset must be greater than or equal to 0' },
        { status: 400 }
      ),
    };
  }

  return {
    valid: true,
    params: { limit, offset },
  };
}

/**
 * Validate ID parameter
 */
export function validateId(id: string | undefined): ValidationResult {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Valid ID is required' },
        { status: 400 }
      ),
    };
  }

  // Basic sanitization check - IDs should be alphanumeric with some allowed characters
  const idPattern = /^[a-zA-Z0-9_-]+$/;
  if (!idPattern.test(id)) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      ),
    };
  }

  return { valid: true };
}

/**
 * Validate search query
 */
export function validateSearchQuery(query: string | null): string | undefined {
  if (!query) return undefined;

  // Trim and limit length
  const sanitized = query.trim().slice(0, 200);

  return sanitized || undefined;
}

/**
 * Validate price range
 */
export interface PriceRange {
  minPrice?: number;
  maxPrice?: number;
}

export function validatePriceRange(priceRange: string | null): PriceRange {
  if (!priceRange || priceRange === 'all') {
    return {};
  }

  if (priceRange === '3000') {
    return { minPrice: 3000 };
  }

  const parts = priceRange.split('-');
  if (parts.length !== 2) {
    return {};
  }

  const min = parseInt(parts[0], 10);
  const max = parseInt(parts[1], 10);

  if (isNaN(min) || isNaN(max)) {
    return {};
  }

  return {
    minPrice: min >= 0 ? min : undefined,
    maxPrice: max > 0 ? max : undefined,
  };
}

/**
 * Create error response with logging
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  error?: unknown
): NextResponse {
  if (error) {
    console.error(message, error);
  }

  return NextResponse.json({ error: message }, { status });
}
