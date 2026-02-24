'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSiteTheme } from '../contexts/SiteThemeContext';

const AGE_REQUIREMENTS = {
  ja: 18, // 日本: 18歳以上
  en: 18, // 英語圏(主にアメリカ): 18歳以上
  zh: 18, // 中国: 18歳以上
} as const;

type AgeVerificationTheme = 'dark' | 'light';

interface AgeVerificationProps {
  locale: string;
  children: React.ReactNode;
  initialVerified?: boolean;
  /** テーマ: dark (web用), light (fanza用) */
  theme?: AgeVerificationTheme;
}

const themeConfig = {
  dark: {
    overlay: 'bg-gray-900',
    modal: 'bg-gray-800 border-gray-700',
    iconBg: 'bg-amber-600',
    title: 'text-white',
    message: 'text-gray-300',
    question: 'text-white',
    warning: 'text-amber-400',
    confirmBtn: 'bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-fuchsia-400 text-white',
    denyBtn: 'bg-gray-700 hover:bg-gray-600 text-gray-300',
    footer: 'text-gray-400',
  },
  light: {
    overlay: 'bg-gray-100',
    modal: 'bg-white border-gray-200',
    iconBg: 'bg-amber-500',
    title: 'text-gray-900',
    message: 'text-gray-600',
    question: 'text-gray-900',
    warning: 'text-amber-600',
    confirmBtn: 'bg-rose-700 hover:bg-rose-800 disabled:bg-rose-400 text-white',
    denyBtn: 'bg-gray-200 hover:bg-gray-300 text-gray-700',
    footer: 'text-gray-500',
  },
};

export default function AgeVerification({
  locale,
  children,
  initialVerified = false,
  theme: themeProp,
}: AgeVerificationProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const t = useTranslations('ageVerification');
  const config = themeConfig[theme];

  const [isVerified, setIsVerified] = useState(initialVerified);
  const [isChecked, setIsChecked] = useState(initialVerified);
  const [isLoading, setIsLoading] = useState(false);

  const minAge = AGE_REQUIREMENTS[locale as keyof typeof AGE_REQUIREMENTS] || 18;

  // クライアント側でCookieを確認（non-httpOnly cookieを直接読む）
  // isChecked完了までモーダルを表示しない（ちらつき防止）
  useEffect(() => {
    if (initialVerified) {
      setIsVerified(true);
      setIsChecked(true);
      return;
    }
    // non-httpOnly cookieをクライアント側で読み取り
    const cookies = document.cookie.split(';').map((c) => c.trim());
    const ageVerified = cookies.some((c) => c.startsWith('age-verified=true'));
    if (ageVerified) {
      setIsVerified(true);
    }
    setIsChecked(true);
  }, [initialVerified]);

  // Cookie確認完了後、未認証ならモーダル表示
  const showModal = isChecked && !isVerified;

  // モーダル表示中はスクロールを防止
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/age-verify', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (response.ok) {
        setIsVerified(true);
      }
    } catch (error) {
      console.error('Age verification failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeny = () => {
    window.location.href = 'https://www.google.com';
  };

  // SEO対策: childrenは常にDOMに含める（Googlebotがコンテンツをインデックスできるように）
  // モーダルは視覚的にオーバーレイで表示し、ユーザーの操作をブロックする
  return (
    <>
      {showModal && (
        <div className={`fixed inset-0 ${config.overlay} z-50 flex items-center justify-center p-4`}>
          <div className={`${config.modal} w-full max-w-md rounded-lg border p-8 shadow-2xl`}>
            {/* 警告アイコン */}
            <div className="mb-6 flex justify-center">
              <div className={`h-16 w-16 ${config.iconBg} flex items-center justify-center rounded-full`}>
                <svg
                  className="h-10 w-10 text-white"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* タイトル */}
            <h1 className={`text-2xl font-bold ${config['title']} mb-4 text-center`}>{t('title')}</h1>

            {/* メッセージ */}
            <div className="mb-8 space-y-4">
              <p className={`${config.message} text-center`}>{t('message')}</p>
              <p className={`text-lg font-semibold ${config.question} text-center`}>
                {t('question').replace('{age}', minAge.toString())}
              </p>
              <p className={`text-sm ${config.warning} text-center`}>
                {t('warning').replace('{age}', minAge.toString())}
              </p>
            </div>

            {/* ボタン */}
            <div className="space-y-3">
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className={`w-full ${config.confirmBtn} rounded-lg px-6 py-3 font-semibold transition-colors duration-200`}
              >
                {isLoading ? '...' : t('confirm').replace('{age}', minAge.toString())}
              </button>
              <button
                onClick={handleDeny}
                className={`w-full ${config.denyBtn} rounded-lg px-6 py-3 font-semibold transition-colors duration-200`}
              >
                {t('deny')}
              </button>
            </div>

            {/* フッター注意書き */}
            <p className={`text-xs ${config.footer} mt-6 text-center`}>
              {t('legalNotice', {
                defaultValue:
                  'このサイトにアクセスすることで、利用規約とプライバシーポリシーに同意したものとみなされます。',
              })}
            </p>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
