'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { getTranslation, cookieConsentTranslations } from '../lib/translations';

const COOKIE_CONSENT_KEY = 'cookie_consent';

interface CookieConsentProps {
  gaId?: string;
  locale?: string;
}

export default function CookieConsent({ gaId, locale = 'ja' }: CookieConsentProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [consentInitialized, setConsentInitialized] = useState(false);

  const t = getTranslation(cookieConsentTranslations, locale);

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
      <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
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
        <div className="fixed right-0 bottom-0 left-0 z-50 border-t border-gray-700 bg-gray-900 p-4 shadow-lg">
          <div className="container mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-center text-sm text-gray-300 sm:text-left">
              {t.message}{' '}
              <a href={`/${locale}/privacy`} className="text-rose-400 underline hover:text-rose-300">
                {t.learnMore}
              </a>
            </p>
            <div className="flex shrink-0 gap-3">
              <button
                onClick={handleDecline}
                className="px-4 py-2 text-sm text-gray-300 transition-colors hover:text-white"
              >
                {t.decline}
              </button>
              <button
                onClick={handleAccept}
                className="rounded bg-rose-600 px-4 py-2 text-sm text-white transition-colors hover:bg-rose-500"
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
