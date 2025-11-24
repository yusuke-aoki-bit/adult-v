'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

// Metadata for age verification page - prevent indexing
export const metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

function AgeVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = (verified: boolean) => {
    if (verified) {
      setIsVerifying(true);
      // Set cookie for age verification
      document.cookie = 'age-verified=true; path=/; max-age=31536000'; // 1 year

      // Get redirect URL or default to home
      const redirect = searchParams.get('redirect') || '/ja';

      // Small delay for better UX
      setTimeout(() => {
        router.push(redirect);
      }, 300);
    } else {
      // Redirect to a safe external site
      window.location.href = 'https://www.google.com';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            年齢確認
          </h1>
          <p className="text-gray-300 text-sm leading-relaxed">
            このサイトはアダルトコンテンツを含みます。<br />
            18歳以上の方のみご利用いただけます。
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleVerify(true)}
            disabled={isVerifying}
            className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-rose-800 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {isVerifying ? '確認中...' : '18歳以上です'}
          </button>

          <button
            onClick={() => handleVerify(false)}
            disabled={isVerifying}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-200 font-medium py-3 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            18歳未満です
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            このサイトを利用することで、利用規約に同意したものとみなされます。
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AgeVerification() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-4">
              年齢確認
            </h1>
            <p className="text-gray-300 text-sm leading-relaxed">
              読み込み中...
            </p>
          </div>
        </div>
      </div>
    }>
      <AgeVerificationContent />
    </Suspense>
  );
}
