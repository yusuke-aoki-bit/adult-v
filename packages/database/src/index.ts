// @adult-v/database package exports
export * from './schema';
export * from './types';
export { db, getDb, closeDb } from './client';

// Re-export drizzle-orm utilities to ensure consistent types
export { eq, sql, desc, asc, and, or, gt, gte, lt, lte, ne, inArray, isNull, isNotNull, between, like, ilike, count } from 'drizzle-orm';
