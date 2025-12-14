'use client';

import { setStorageKeyPrefix } from '@adult-v/shared/lib/ab-testing';

// FANZAサイト用のプレフィックスを設定
setStorageKeyPrefix('fanza_ab_test_');

// Re-export from @adult-v/shared
export type { ExperimentVariant } from '@adult-v/shared/lib/ab-testing';
export {
  experiments,
  getVariant,
  trackExperimentEvent,
  trackCtaClick,
  trackImpression,
  resetAllExperiments,
  forceVariant,
  getAllVariants,
  setStorageKeyPrefix,
} from '@adult-v/shared/lib/ab-testing';
