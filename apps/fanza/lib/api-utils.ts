// Re-export from @adult-v/shared
export type {
  PaginationParams,
  ValidationResult,
  PriceRange,
} from '@adult-v/shared/lib/api-utils';

export {
  validatePagination,
  validateId,
  validateSearchQuery,
  validatePriceRange,
  createErrorResponse,
} from '@adult-v/shared/lib/api-utils';
