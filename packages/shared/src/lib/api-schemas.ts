import { z } from 'zod';

/**
 * Zod validation schemas for API parameters.
 *
 * These schemas provide type-safe validation for API endpoints.
 * For new API handlers, prefer these over the manual validators in api-utils.ts.
 *
 * Usage:
 *   const result = paginationSchema.safeParse({ limit: '20', offset: '0' });
 *   if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
 *   const { limit, offset } = result.data;
 *
 * Or with parseSearchParams helper:
 *   const parsed = parseSearchParams(paginationSchema, url.searchParams);
 *   if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
 */

// ── Pagination ──────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(12).max(96).default(48),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ── ID ──────────────────────────────────────────────────────────────────────

export const idSchema = z
  .string()
  .trim()
  .min(1, 'Valid ID is required')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format');

// ── Search ──────────────────────────────────────────────────────────────────

export const searchQuerySchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((val) => val || undefined);

// ── Price Range ─────────────────────────────────────────────────────────────

export const priceRangeSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (!val || val === 'all') return {};
    if (val === '3000') return { minPrice: 3000 as number };
    const parts = val.split('-');
    if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined) return {};
    const min = Number(parts[0]);
    const max = Number(parts[1]);
    if (isNaN(min) || isNaN(max)) return {};
    return {
      ...(min >= 0 ? { minPrice: min } : {}),
      ...(max > 0 ? { maxPrice: max } : {}),
    };
  });

export type PriceRangeInput = z.infer<typeof priceRangeSchema>;

// ── Sort / Order ────────────────────────────────────────────────────────────

export const sortOrderSchema = z
  .enum(['newest', 'oldest', 'rating', 'price_asc', 'price_desc', 'popular', 'relevance'])
  .default('newest');

export const localeSchema = z.enum(['ja', 'en', 'zh', 'zh-TW', 'ko']).default('ja');

// ── Common Product Listing Params ───────────────────────────────────────────

export const productListParamsSchema = paginationSchema.extend({
  sort: sortOrderSchema.optional(),
  category: z.string().trim().optional(),
  maker: z.string().trim().optional(),
  performer: z.string().trim().optional(),
  q: searchQuerySchema,
  priceRange: priceRangeSchema,
});

export type ProductListParams = z.infer<typeof productListParamsSchema>;

// ── User Content Schemas ────────────────────────────────────────────────────

export const userReviewSchema = z.object({
  productId: z.coerce.number().int().positive(),
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export type UserReviewInput = z.infer<typeof userReviewSchema>;

export const userCorrectionSchema = z.object({
  targetType: z.enum(['product', 'performer']),
  targetId: z.coerce.number().int().positive(),
  fieldName: z.string().trim().min(1).max(100),
  currentValue: z.string().optional(),
  suggestedValue: z.string().trim().min(1).max(1000),
  reason: z.string().trim().max(500).optional(),
});

export type UserCorrectionInput = z.infer<typeof userCorrectionSchema>;

export const userTagSuggestionSchema = z.object({
  productId: z.coerce.number().int().positive(),
  tagName: z.string().trim().min(1).max(100),
});

export type UserTagSuggestionInput = z.infer<typeof userTagSuggestionSchema>;

// ── Price Alert ─────────────────────────────────────────────────────────────

export const priceAlertSchema = z.object({
  productId: z.coerce.number().int().positive(),
  targetPrice: z.coerce.number().positive(),
  notifyOnAnySale: z.coerce.boolean().default(false),
});

export type PriceAlertInput = z.infer<typeof priceAlertSchema>;

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Parse URLSearchParams against a Zod schema.
 * Returns the validated data or an error object.
 *
 * @example
 * const parsed = parseSearchParams(paginationSchema, url.searchParams);
 * if ('error' in parsed) {
 *   return NextResponse.json({ error: parsed.error }, { status: 400 });
 * }
 * const { limit, offset } = parsed;
 */
export function parseSearchParams<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams,
): z.infer<T> | { error: string } {
  const obj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  const result = schema.safeParse(obj);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation error' };
  }
  return result.data;
}

/**
 * Parse a JSON request body against a Zod schema.
 * Returns the validated data or an error object.
 *
 * @example
 * const parsed = await parseRequestBody(userReviewSchema, request);
 * if ('error' in parsed) {
 *   return NextResponse.json({ error: parsed.error }, { status: 400 });
 * }
 */
export async function parseRequestBody<T extends z.ZodType>(
  schema: T,
  request: Request,
): Promise<z.infer<T> | { error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return { error: result.error.issues[0]?.message ?? 'Validation error' };
    }
    return result.data;
  } catch {
    return { error: 'Invalid JSON body' };
  }
}
