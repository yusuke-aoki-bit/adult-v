'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

// Cookie名をAPIと統一（httpOnly Cookieはサーバーサイドで検証）
const AGE_VERIFICATION_COOKIE = 'age-verified';
const AGE_REQUIREMENTS = {
  ja: 18, // 日本: 18歳以上
  en: 18, // 英語圏(主にアメリカ): 18歳以上
  zh: 18, // 中国: 18歳以上
} as const;

interface AgeVerificationProps {
  locale: string;
  children: React.ReactNode;
  initialVerified?: boolean; // サーバーサイドからの初期値
}

export default function AgeVerification({ locale, children, initialVerified = false }: AgeVerificationProps) {
  const t = useTranslations('ageVerification');
  // 初期値をサーバーサイドから受け取ることでCLS防止
  const [isVerified, setIsVerified] = useState(initialVerified);
  const [showModal, setShowModal] = useState(!initialVerified);
  const [isLoading, setIsLoading] = useState(false);

  const minAge = AGE_REQUIREMENTS[locale as keyof typeof AGE_REQUIREMENTS] || 18;

  // クライアント側でクッキーを再確認（サーバーとクライアントの同期）
  // 注: httpOnly Cookieはdocument.cookieからは読めないため、
  // initialVerifiedがtrueの場合はサーバーサイドで検証済み
  useEffect(() => {
    // サーバーサイドで認証済みの場合は何もしない
    if (initialVerified) {
      setIsVerified(true);
      setShowModal(false);
    }
  }, [initialVerified]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      // サーバーサイドAPIでhttpOnly Cookieを設定
      const response = await fetch('/api/age-verify', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (response.ok) {
        setIsVerified(true);
        setShowModal(false);
      }
    } catch (error) {
      console.error('Age verification failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeny = () => {
    // 外部サイトへリダイレクト
    window.location.href = 'https://www.google.com';
  };

  // 年齢認証済みの場合は子要素を表示
  if (isVerified) {
    return <>{children}</>;
  }

  // モーダルを表示しない場合（サーバーサイドで認証済みと判定された場合）
  if (!showModal) {
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
            disabled={isLoading}
            className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            {isLoading ? '...' : t('confirm').replace('{age}', minAge.toString())}
          </button>
          <button
            onClick={handleDeny}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            {t('deny')}
          </button>
        </div>

        {/* フッター注意書き */}
        <p className="text-xs text-gray-400 text-center mt-6">
          {t('legalNotice', { defaultValue: 'このサイトにアクセスすることで、利用規約とプライバシーポリシーに同意したものとみなされます。' })}
        </p>
      </div>
    </div>
  );
}
