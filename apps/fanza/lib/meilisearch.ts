/**
 * Meilisearch client configuration
 * Re-exports from shared package
 */
export {
  getMeilisearchClient,
  PRODUCTS_INDEX,
  initializeProductsIndex,
} from '@adult-v/shared/lib/meilisearch';

export type { MeilisearchProduct } from '@adult-v/shared/lib/meilisearch';
