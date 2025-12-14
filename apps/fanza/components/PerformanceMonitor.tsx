'use client';

import { useEffect } from 'react';

/**
 * Core Web Vitals Performance Monitor
 * Tracks LCP, INP, CLS and reports to analytics
 */
export default function PerformanceMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Only run in production
    if (process.env.NODE_ENV !== 'production') return;

    // Import web-vitals dynamically
    import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      // Largest Contentful Paint (LCP) - Target: < 2.5s
      onLCP((metric) => {
        console.log('[Core Web Vitals] LCP:', metric.value, 'ms');
        // Send to analytics
        if (window.gtag) {
          window.gtag('event', 'web_vitals', {
            event_category: 'Web Vitals',
            event_label: 'LCP',
            value: Math.round(metric.value),
            non_interaction: true,
          });
        }
      });

      // Interaction to Next Paint (INP) - Target: < 200ms
      onINP((metric) => {
        console.log('[Core Web Vitals] INP:', metric.value, 'ms');
        if (window.gtag) {
          window.gtag('event', 'web_vitals', {
            event_category: 'Web Vitals',
            event_label: 'INP',
            value: Math.round(metric.value),
            non_interaction: true,
          });
        }
      });

      // Cumulative Layout Shift (CLS) - Target: < 0.1
      onCLS((metric) => {
        console.log('[Core Web Vitals] CLS:', metric.value);
        if (window.gtag) {
          window.gtag('event', 'web_vitals', {
            event_category: 'Web Vitals',
            event_label: 'CLS',
            value: Math.round(metric.value * 1000),
            non_interaction: true,
          });
        }
      });

      // First Contentful Paint (FCP) - Target: < 1.8s
      onFCP((metric) => {
        console.log('[Core Web Vitals] FCP:', metric.value, 'ms');
        if (window.gtag) {
          window.gtag('event', 'web_vitals', {
            event_category: 'Web Vitals',
            event_label: 'FCP',
            value: Math.round(metric.value),
            non_interaction: true,
          });
        }
      });

      // Time to First Byte (TTFB) - Target: < 800ms
      onTTFB((metric) => {
        console.log('[Core Web Vitals] TTFB:', metric.value, 'ms');
        if (window.gtag) {
          window.gtag('event', 'web_vitals', {
            event_category: 'Web Vitals',
            event_label: 'TTFB',
            value: Math.round(metric.value),
            non_interaction: true,
          });
        }
      });
    });
  }, []);

  return null;
}

