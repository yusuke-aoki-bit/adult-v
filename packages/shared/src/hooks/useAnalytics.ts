'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  logEvent,
  setAnalyticsUserProperties,
  type AnalyticsEventName,
  type AnalyticsEventParams,
} from '../lib/firebase';

/**
 * Firebase Analyticsフック
 * - タイプセーフなイベントロギング
 * - ページビュートラッキング
 * - ユーザープロパティ設定
 */
export function useAnalytics() {
  const trackEvent = useCallback(
    <T extends AnalyticsEventName>(eventName: T, params?: AnalyticsEventParams[T]) => {
      logEvent(eventName, params);
    },
    []
  );

  const trackPageView = useCallback((pagePath: string, pageTitle?: string) => {
    logEvent('page_view', {
      page_path: pagePath,
      ...(pageTitle && { page_title: pageTitle }),
    });
  }, []);

  const trackSearch = useCallback((searchTerm: string, resultsCount?: number) => {
    logEvent('search', {
      search_term: searchTerm,
      ...(resultsCount !== undefined && { results_count: resultsCount }),
    });
  }, []);

  const trackProductView = useCallback(
    (productId: string, productTitle?: string, provider?: string) => {
      logEvent('view_product', {
        product_id: productId,
        ...(productTitle && { product_title: productTitle }),
        ...(provider && { provider }),
      });
    },
    []
  );

  const trackAffiliateClick = useCallback(
    (productId: string, provider: string, destinationUrl?: string) => {
      logEvent('click_affiliate_link', {
        product_id: productId,
        provider,
        ...(destinationUrl && { destination_url: destinationUrl }),
      });
    },
    []
  );

  const trackFilterApplied = useCallback((filterType: string, filterValue: string) => {
    logEvent('filter_applied', { filter_type: filterType, filter_value: filterValue });
  }, []);

  const trackSortChanged = useCallback((sortBy: string) => {
    logEvent('sort_changed', { sort_by: sortBy });
  }, []);

  const trackAgeVerified = useCallback(() => {
    logEvent('age_verified', {});
  }, []);

  const trackThemeChanged = useCallback((theme: 'dark' | 'light') => {
    logEvent('theme_changed', { theme });
  }, []);

  const trackLanguageChanged = useCallback((language: string) => {
    logEvent('language_changed', { language });
  }, []);

  const setUserProperties = useCallback((properties: Record<string, string>) => {
    setAnalyticsUserProperties(properties);
  }, []);

  return {
    trackEvent,
    trackPageView,
    trackSearch,
    trackProductView,
    trackAffiliateClick,
    trackFilterApplied,
    trackSortChanged,
    trackAgeVerified,
    trackThemeChanged,
    trackLanguageChanged,
    setUserProperties,
  };
}

/**
 * ページビュー自動トラッキングフック
 * コンポーネントのマウント時に自動的にページビューを記録
 */
export function usePageViewTracking(pagePath: string, pageTitle?: string) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      logEvent('page_view', {
        page_path: pagePath,
        ...(pageTitle && { page_title: pageTitle }),
      });
      hasTracked.current = true;
    }
  }, [pagePath, pageTitle]);
}

/**
 * 製品ビュー自動トラッキングフック
 * 製品詳細ページでの閲覧を記録
 */
export function useProductViewTracking(
  productId: string | undefined,
  productTitle?: string,
  provider?: string
) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (productId && !hasTracked.current) {
      logEvent('view_product', {
        product_id: productId,
        ...(productTitle && { product_title: productTitle }),
        ...(provider && { provider }),
      });
      hasTracked.current = true;
    }
  }, [productId, productTitle, provider]);
}
