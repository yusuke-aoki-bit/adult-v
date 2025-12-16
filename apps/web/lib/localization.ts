// Re-export from @adult-v/shared
export type { SupportedLocale } from '@adult-v/shared/lib/localization';
export {
  getLocalizedTitle,
  getLocalizedDescription,
  getLocalizedPerformerName,
  getLocalizedPerformerBio,
  getLocalizedTagName,
  getLocalizedTagDescription,
  getLocalizedAiReview,
  normalizeLocale,
} from '@adult-v/shared/lib/localization';

// Re-export ActressAiReview type from localization for backward compatibility
// (original file defined it locally, now it's imported from types/product in shared)
export type { ActressAiReview } from '@adult-v/shared/types/product';
