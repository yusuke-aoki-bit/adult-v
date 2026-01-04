/**
 * Base dependency injection types for API handlers
 */

/**
 * Base Drizzle ORM dependencies shared across handlers
 */
export interface BaseDrizzleHandlerDeps {
  getDb: () => unknown;
  eq: (a: unknown, b: unknown) => unknown;
  and: (...args: unknown[]) => unknown;
  sql: unknown;
}

/**
 * Extended deps for handlers that work with user data tables
 */
export interface UserDataHandlerDeps extends BaseDrizzleHandlerDeps {
  table: unknown;
}

/**
 * Generic type for adding vote information to any entity
 */
export type WithVote<T, VoteType extends string> = T & {
  userVote?: VoteType | null;
};

/**
 * Common vote types used across the application
 */
export type HelpfulVote = 'helpful' | 'not_helpful';
export type UpDownVote = 'up' | 'down';
