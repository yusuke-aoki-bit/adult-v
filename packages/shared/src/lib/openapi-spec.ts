import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Must extend before creating any schemas
extendZodWithOpenApi(z);

// ── Schema definitions (mirror api-schemas.ts but created after extension) ──

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(12).max(96).default(48),
  offset: z.coerce.number().int().min(0).default(0),
});

const idSchema = z
  .string()
  .trim()
  .min(1, 'Valid ID is required')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format');

const searchQuerySchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((val) => val || undefined);

const sortOrderSchema = z
  .enum(['newest', 'oldest', 'rating', 'price_asc', 'price_desc', 'popular', 'relevance'])
  .default('newest');

const localeSchema = z.enum(['ja', 'en', 'zh', 'zh-TW', 'ko']).default('ja');

const productListParamsSchema = paginationSchema.extend({
  sort: sortOrderSchema.optional(),
  category: z.string().trim().optional(),
  maker: z.string().trim().optional(),
  performer: z.string().trim().optional(),
  q: searchQuerySchema,
});

const userReviewSchema = z.object({
  productId: z.coerce.number().int().positive(),
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

const userCorrectionSchema = z.object({
  targetType: z.enum(['product', 'performer']),
  targetId: z.coerce.number().int().positive(),
  fieldName: z.string().trim().min(1).max(100),
  currentValue: z.string().optional(),
  suggestedValue: z.string().trim().min(1).max(1000),
  reason: z.string().trim().max(500).optional(),
});

const userTagSuggestionSchema = z.object({
  productId: z.coerce.number().int().positive(),
  tagName: z.string().trim().min(1).max(100),
});

const priceAlertSchema = z.object({
  productId: z.coerce.number().int().positive(),
  targetPrice: z.coerce.number().positive(),
  notifyOnAnySale: z.coerce.boolean().default(false),
});

// ── Registry ─────────────────────────────────────────────────────

const registry = new OpenAPIRegistry();

registry.register('Pagination', paginationSchema);
registry.register('SortOrder', sortOrderSchema);
registry.register('Locale', localeSchema);
registry.register('ProductListParams', productListParamsSchema);
registry.register('UserReview', userReviewSchema);
registry.register('UserCorrection', userCorrectionSchema);
registry.register('UserTagSuggestion', userTagSuggestionSchema);
registry.register('PriceAlert', priceAlertSchema);

// ── Paths ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/products',
  summary: 'List products with filtering and pagination',
  request: { query: productListParamsSchema },
  responses: {
    200: { description: 'Paginated product list' },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/products/{id}',
  summary: 'Get a single product by ID',
  request: { params: z.object({ id: idSchema }) },
  responses: {
    200: { description: 'Product details with sources, performers, tags' },
    404: { description: 'Product not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/products/{id}/price-history',
  summary: 'Get price history for a product',
  request: { params: z.object({ id: idSchema }) },
  responses: { 200: { description: 'Price history data points' } },
});

registry.registerPath({
  method: 'post',
  path: '/api/products/{id}/reviews',
  summary: 'Submit a product review',
  request: {
    params: z.object({ id: idSchema }),
    body: { content: { 'application/json': { schema: userReviewSchema } } },
  },
  responses: {
    200: { description: 'Review submitted successfully' },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/corrections',
  summary: 'Submit a data correction',
  request: {
    body: { content: { 'application/json': { schema: userCorrectionSchema } } },
  },
  responses: {
    201: { description: 'Correction submitted' },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/products/{id}/tag-suggestions',
  summary: 'Suggest a tag for a product',
  request: {
    params: z.object({ id: idSchema }),
    body: { content: { 'application/json': { schema: userTagSuggestionSchema } } },
  },
  responses: { 200: { description: 'Tag suggestion submitted' } },
});

registry.registerPath({
  method: 'post',
  path: '/api/price-alerts',
  summary: 'Create a price alert',
  request: {
    body: { content: { 'application/json': { schema: priceAlertSchema } } },
  },
  responses: {
    200: { description: 'Price alert created' },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/search/autocomplete',
  summary: 'Search autocomplete suggestions',
  request: {
    query: z.object({ q: searchQuerySchema, locale: localeSchema }),
  },
  responses: { 200: { description: 'Autocomplete results (products, performers, tags)' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/actresses',
  summary: 'List performers with pagination',
  request: { query: paginationSchema },
  responses: { 200: { description: 'Paginated performer list' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/actresses/{id}',
  summary: 'Get performer details',
  request: { params: z.object({ id: idSchema }) },
  responses: {
    200: { description: 'Performer profile with career analysis' },
    404: { description: 'Performer not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/recommendations',
  summary: 'Get product recommendations based on favorites',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            productIds: z.array(z.number().int().positive()),
            limit: z.number().int().min(1).max(48).default(12),
          }),
        },
      },
    },
  },
  responses: { 200: { description: 'Recommended products' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/sales',
  summary: 'List products currently on sale',
  request: { query: paginationSchema },
  responses: { 200: { description: 'Products with active sales' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/rankings',
  summary: 'Get product rankings',
  request: {
    query: paginationSchema.extend({
      period: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
    }),
  },
  responses: { 200: { description: 'Ranked products' } },
});

// ── Generate document ────────────────────────────────────────────

export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Adult Viewer API',
      version: '1.0.0',
      description: 'API reference for product, performer, and user content endpoints',
    },
    servers: [
      { url: 'https://adult-v--adult-v.asia-east1.hosted.app', description: 'Production (web)' },
      { url: 'https://adult-v--adult-v-1.asia-east1.hosted.app', description: 'Production (fanza)' },
      { url: 'http://localhost:3000', description: 'Local development' },
    ],
  });
}
