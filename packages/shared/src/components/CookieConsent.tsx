'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

const COOKIE_CONSENT_KEY = 'cookie_consent';

interface CookieConsentProps {
  gaId?: string;
  locale?: string;
}

const translations = {
  ja: {
    message: '当サイトでは、サイトの利用状況を把握するためにGoogle Analyticsを使用しています。',
    accept: '同意する',
    decline: '拒否する',
    learnMore: '詳細',
  },
  en: {
    message: 'This site uses Google Analytics to understand how the site is used.',
    accept: 'Accept',
    decline: 'Decline',
    learnMore: 'Learn more',
  },
  zh: {
    message: '本站使用Google Analytics来了解网站的使用情况。',
    accept: '同意',
    decline: '拒绝',
    learnMore: '了解更多',
  },
  ko: {
    message: '이 사이트는 Google Analytics를 사용하여 사이트 이용 현황을 파악합니다.',
    accept: '동의',
    decline: '거부',
    learnMore: '자세히',
  },
};

export default function CookieConsent({ gaId, locale = 'ja' }: CookieConsentProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [consentInitialized, setConsentInitialized] = useState(false);

  const t = translations[locale as keyof typeof translations] || translations.ja;

  useEffect(() => {
    // Check if consent was already given
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (savedConsent === 'accepted' || savedConsent === 'declined') {
      setShowBanner(false);
    } else {
      // Show banner after a short delay to avoid layout shift
      setTimeout(() => setShowBanner(true), 1000);
    }
    setConsentInitialized(true);
  }, []);

  // Update consent when user makes a choice
  const updateConsent = (granted: boolean) => {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: granted ? 'granted' : 'denied',
        ad_storage: granted ? 'granted' : 'denied',
        ad_user_data: granted ? 'granted' : 'denied',
        ad_personalization: granted ? 'granted' : 'denied',
      });
    }
  };

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    updateConsent(true);
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'declined');
    updateConsent(false);
    setShowBanner(false);
  };

  // Get initial consent state for gtag config
  const getInitialConsentState = () => {
    if (typeof window !== 'undefined') {
      const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
      return savedConsent === 'accepted' ? 'granted' : 'denied';
    }
    return 'denied';
  };

  if (!gaId) return null;

  return (
    <>
      {/* Google Consent Mode v2 - Default to denied, then update based on user choice */}
      <Script
        id="google-consent-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}

            // Set default consent state (denied until user accepts)
            // regions: EEA + UK countries where GDPR applies
            gtag('consent', 'default', {
              analytics_storage: 'denied',
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              wait_for_update: 500,
              regions: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB']
            });

            // For non-EEA/UK regions, grant by default (no consent required)
            gtag('consent', 'default', {
              analytics_storage: 'granted',
              ad_storage: 'granted',
              ad_user_data: 'granted',
              ad_personalization: 'granted'
            });

            // Check localStorage for previous consent and update accordingly
            (function() {
              try {
                var consent = localStorage.getItem('${COOKIE_CONSENT_KEY}');
                if (consent === 'accepted') {
                  gtag('consent', 'update', {
                    analytics_storage: 'granted',
                    ad_storage: 'granted',
                    ad_user_data: 'granted',
                    ad_personalization: 'granted'
                  });
                } else if (consent === 'declined') {
                  gtag('consent', 'update', {
                    analytics_storage: 'denied',
                    ad_storage: 'denied',
                    ad_user_data: 'denied',
                    ad_personalization: 'denied'
                  });
                }
              } catch(e) {}
            })();
          `,
        }}
      />

      {/* Google Analytics Tag */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              anonymize_ip: true
            });
          `,
        }}
      />

      {/* Cookie Consent Banner */}
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900 border-t border-gray-700 shadow-lg">
          <div className="container mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-300 text-center sm:text-left">
              {t.message}{' '}
              <a
                href={`/${locale}/privacy`}
                className="text-rose-400 hover:text-rose-300 underline"
              >
                {t.learnMore}
              </a>
            </p>
            <div className="flex gap-3 flex-shrink-0">
              <button
                onClick={handleDecline}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                {t.decline}
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white rounded transition-colors"
              >
                {t.accept}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
