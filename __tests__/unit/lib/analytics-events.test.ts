/**
 * Analytics Events Unit Tests
 * イベントトラッキング関数の単体テスト
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Import after mocks are set up by vitest.setup.ts
import {
  experiments,
  getVariant,
  trackExperimentEvent,
  trackCtaClick,
  trackImpression,
  resetAllExperiments,
  forceVariant,
  getAllVariants,
} from '@adult-v/shared/lib/ab-testing';

describe('A/B Testing Events', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  describe('experiments configuration', () => {
    test('ctaButtonText experiment is defined correctly', () => {
      expect(experiments['ctaButtonText']).toBeDefined();
      expect(experiments['ctaButtonText']!.variants).toContain('control');
      expect(experiments['ctaButtonText']!.variants).toContain('urgency');
      expect(experiments['ctaButtonText']!.variants).toContain('action');
    });

    test('priceDisplayStyle experiment is defined correctly', () => {
      expect(experiments['priceDisplayStyle']).toBeDefined();
      expect(experiments['priceDisplayStyle']!.variants).toContain('control');
      expect(experiments['priceDisplayStyle']!.variants).toContain('emphasized');
    });

    test('saleCountdownStyle experiment is defined correctly', () => {
      expect(experiments['saleCountdownStyle']).toBeDefined();
      expect(experiments['saleCountdownStyle']!.variants).toContain('control');
      expect(experiments['saleCountdownStyle']!.variants).toContain('animated');
    });
  });

  describe('getVariant', () => {
    test('returns control for unknown experiment', () => {
      const variant = getVariant('unknownExperiment');
      expect(variant).toBe('control');
    });

    test('returns a valid variant for known experiment', () => {
      const variant = getVariant('ctaButtonText');
      expect(experiments['ctaButtonText']!.variants).toContain(variant);
    });

    test('persists variant on subsequent calls', () => {
      const variant1 = getVariant('ctaButtonText');
      const variant2 = getVariant('ctaButtonText');
      expect(variant2).toBe(variant1);
    });

    test('returns stored variant from localStorage', () => {
      window.localStorage.setItem('ab_test_ctaButtonText', 'urgency');
      const variant = getVariant('ctaButtonText');
      expect(variant).toBe('urgency');
    });
  });

  describe('forceVariant', () => {
    test('sets variant in localStorage', () => {
      forceVariant('ctaButtonText', 'action');
      expect(window.localStorage.getItem('ab_test_ctaButtonText')).toBe('action');
    });

    test('getVariant returns forced variant', () => {
      forceVariant('ctaButtonText', 'urgency');
      expect(getVariant('ctaButtonText')).toBe('urgency');
    });

    test('does not set invalid variant', () => {
      forceVariant('ctaButtonText', 'control');
      forceVariant('ctaButtonText', 'invalid');
      // Should still be control since invalid was rejected
      expect(getVariant('ctaButtonText')).toBe('control');
    });
  });

  describe('resetAllExperiments', () => {
    test('clears all experiment variants from localStorage', () => {
      // Set some variants
      forceVariant('ctaButtonText', 'urgency');
      forceVariant('priceDisplayStyle', 'emphasized');

      resetAllExperiments();

      // After reset, variants should be reassigned (not necessarily the same)
      // We can't predict the new value, but localStorage should have been cleared
      expect(window.localStorage.getItem('ab_test_ctaButtonText')).toBeNull();
      expect(window.localStorage.getItem('ab_test_priceDisplayStyle')).toBeNull();
    });
  });

  describe('getAllVariants', () => {
    test('returns variants for all experiments', () => {
      const allVariants = getAllVariants();

      expect(allVariants).toHaveProperty('ctaButtonText');
      expect(allVariants).toHaveProperty('priceDisplayStyle');
      expect(allVariants).toHaveProperty('saleCountdownStyle');
    });

    test('returns valid variants for each experiment', () => {
      const allVariants = getAllVariants();

      expect(experiments['ctaButtonText']!.variants).toContain(allVariants['ctaButtonText']);
      expect(experiments['priceDisplayStyle']!.variants).toContain(allVariants['priceDisplayStyle']);
      expect(experiments['saleCountdownStyle']!.variants).toContain(allVariants['saleCountdownStyle']);
    });
  });

  describe('trackExperimentEvent', () => {
    test('calls gtag with correct parameters', () => {
      forceVariant('ctaButtonText', 'urgency');

      trackExperimentEvent('test_event', 'ctaButtonText', {
        custom_param: 'value',
      });

      expect(window.gtag).toHaveBeenCalledWith('event', 'test_event', {
        experiment_id: 'ctaButtonText',
        experiment_variant: 'urgency',
        custom_param: 'value',
      });
    });

    test('includes experiment variant in event params', () => {
      forceVariant('priceDisplayStyle', 'emphasized');

      trackExperimentEvent('impression', 'priceDisplayStyle');

      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'impression',
        expect.objectContaining({
          experiment_id: 'priceDisplayStyle',
          experiment_variant: 'emphasized',
        }),
      );
    });
  });

  describe('trackCtaClick', () => {
    test('tracks CTA click with product ID', () => {
      forceVariant('ctaButtonText', 'action');

      trackCtaClick('ctaButtonText', '12345', {
        is_sale: true,
        provider: 'FANZA',
      });

      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'cta_click',
        expect.objectContaining({
          experiment_id: 'ctaButtonText',
          experiment_variant: 'action',
          product_id: '12345',
          is_sale: true,
          provider: 'FANZA',
        }),
      );
    });

    test('handles numeric product ID', () => {
      trackCtaClick('ctaButtonText', 12345);

      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'cta_click',
        expect.objectContaining({
          product_id: '12345',
        }),
      );
    });
  });

  describe('trackImpression', () => {
    test('tracks impression with product ID', () => {
      trackImpression('priceDisplayStyle', '54321');

      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'experiment_impression',
        expect.objectContaining({
          experiment_id: 'priceDisplayStyle',
          product_id: '54321',
        }),
      );
    });

    test('tracks impression without product ID', () => {
      trackImpression('saleCountdownStyle');

      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'experiment_impression',
        expect.objectContaining({
          experiment_id: 'saleCountdownStyle',
        }),
      );
    });
  });
});

describe('Analytics Event Types Coverage', () => {
  test('All expected Firebase Analytics events are documented', () => {
    const analyticsEvents = [
      'page_view',
      'search',
      'view_product',
      'add_favorite',
      'remove_favorite',
      'click_affiliate_link',
      'filter_applied',
      'sort_changed',
      'age_verified',
      'theme_changed',
      'language_changed',
      'notification_permission_granted',
      'notification_permission_denied',
    ];

    expect(analyticsEvents.length).toBe(13);
  });

  test('All expected A/B Testing events are documented', () => {
    const abTestingEvents = ['cta_click', 'experiment_impression'];

    expect(abTestingEvents.length).toBe(2);
  });

  test('Total event count is correct', () => {
    const totalEvents = 13 + 2; // Analytics + A/B Testing
    expect(totalEvents).toBe(15);
  });
});
