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
  const [consent, setConsent] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [showBanner, setShowBanner] = useState(false);

  const t = translations[locale as keyof typeof translations] || translations.ja;

  useEffect(() => {
    // Check if consent was already given
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (savedConsent === 'accepted') {
      setConsent('accepted');
      setShowBanner(false);
    } else if (savedConsent === 'declined') {
      setConsent('declined');
      setShowBanner(false);
    } else {
      // Show banner after a short delay to avoid layout shift
      setTimeout(() => setShowBanner(true), 1000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setConsent('accepted');
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'declined');
    setConsent('declined');
    setShowBanner(false);
  };

  return (
    <>
      {/* Google Analytics - only load if consent given */}
      {consent === 'accepted' && gaId && (
        <>
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
        </>
      )}

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
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
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
