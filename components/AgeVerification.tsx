'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

const AGE_VERIFICATION_KEY = 'age_verified';
const AGE_REQUIREMENTS = {
  ja: 18, // 日本: 18歳以上
  en: 18, // 英語圏(主にアメリカ): 18歳以上
  zh: 18, // 中国: 18歳以上
} as const;

interface AgeVerificationProps {
  locale: string;
  children: React.ReactNode;
}

export default function AgeVerification({ locale, children }: AgeVerificationProps) {
  const t = useTranslations('ageVerification');
  const [isVerified, setIsVerified] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const minAge = AGE_REQUIREMENTS[locale as keyof typeof AGE_REQUIREMENTS] || 18;

  // クライアントマウント後にlocalStorageから状態を読み込む
  useEffect(() => {
    const storedValue = localStorage.getItem(AGE_VERIFICATION_KEY) === 'true';
    if (storedValue) {
      setIsVerified(true);
    }
    setIsClient(true);
  }, []);

  const handleConfirm = () => {
    localStorage.setItem(AGE_VERIFICATION_KEY, 'true');
    setIsVerified(true);
  };

  const handleDeny = () => {
    // 外部サイトへリダイレクト
    window.location.href = 'https://www.google.com';
  };

  // クライアントマウント前は何も表示しない（ちらつき防止）
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  // 年齢認証済みの場合は子要素を表示
  if (isVerified) {
    return <>{children}</>;
  }

  // 年齢認証モーダル
  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-8 border border-gray-700">
        {/* 警告アイコン */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-amber-600 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white"
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
        <h1 className="text-2xl font-bold text-white text-center mb-4">
          {t('title')}
        </h1>

        {/* メッセージ */}
        <div className="space-y-4 mb-8">
          <p className="text-gray-300 text-center">
            {t('message')}
          </p>
          <p className="text-lg font-semibold text-white text-center">
            {t('question').replace('{age}', minAge.toString())}
          </p>
          <p className="text-sm text-amber-400 text-center">
            {t('warning').replace('{age}', minAge.toString())}
          </p>
        </div>

        {/* ボタン */}
        <div className="space-y-3">
          <button
            onClick={handleConfirm}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            {t('confirm').replace('{age}', minAge.toString())}
          </button>
          <button
            onClick={handleDeny}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            {t('deny')}
          </button>
        </div>

        {/* フッター注意書き */}
        <p className="text-xs text-gray-500 text-center mt-6">
          {t('legalNotice', { defaultValue: 'このサイトにアクセスすることで、利用規約とプライバシーポリシーに同意したものとみなされます。' })}
        </p>
      </div>
    </div>
  );
}
