'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

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
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-800 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-3xl font-bold text-white">年齢確認</h1>
          <p className="text-sm leading-relaxed text-gray-300">
            このサイトはアダルトコンテンツを含みます。
            <br />
            18歳以上の方のみご利用いただけます。
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleVerify(true)}
            disabled={isVerifying}
            className="w-full rounded-lg bg-rose-600 px-4 py-3 font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-800"
          >
            {isVerifying ? '確認中...' : '18歳以上です'}
          </button>

          <button
            onClick={() => handleVerify(false)}
            disabled={isVerifying}
            className="w-full rounded-lg bg-gray-700 px-4 py-3 font-medium text-gray-200 transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-800"
          >
            18歳未満です
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">このサイトを利用することで、利用規約に同意したものとみなされます。</p>
        </div>
      </div>
    </div>
  );
}

export default function AgeVerification() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
          <div className="w-full max-w-md rounded-2xl bg-gray-800 p-8 shadow-xl">
            <div className="mb-8 text-center">
              <h1 className="mb-4 text-3xl font-bold text-white">年齢確認</h1>
              <p className="text-sm leading-relaxed text-gray-300">読み込み中...</p>
            </div>
          </div>
        </div>
      }
    >
      <AgeVerificationContent />
    </Suspense>
  );
}
