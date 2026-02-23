/**
 * Centralized translation system for shared components.
 * All inline translation dictionaries are extracted here for maintainability.
 */

export type Locale = 'ja' | 'en' | 'zh' | 'zh-TW' | 'ko';

export type TranslationRecord<T extends Record<string, unknown>> = Record<Locale | string, T>;

/**
 * Get translations for a specific locale with fallback to Japanese.
 */
export function getTranslation<T extends Record<string, unknown>>(
  translations: TranslationRecord<T>,
  locale: string,
): T {
  return (translations[locale as Locale] || translations['ja']) as T;
}

// Re-export all translation modules
export * from './ai';
export * from './product';
export * from './ui';
export * from './user';
export * from './performer';
export * from './sections';
export * from './filters';
