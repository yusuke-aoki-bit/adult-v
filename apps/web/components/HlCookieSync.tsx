'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const VALID_LOCALES = ['ja', 'en', 'zh', 'zh-TW', 'ko'];

/**
 * URLの ?hl= パラメータからNEXT_LOCALEクッキーを設定するクライアントコンポーネント。
 * ミドルウェアでSet-Cookieを返すとCache-Control: privateが強制されるため、
 * クライアント側でdocument.cookieを使用して設定する。
 */
export default function HlCookieSync() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const hl = searchParams.get('hl');
    if (hl && VALID_LOCALES.includes(hl)) {
      document.cookie = `NEXT_LOCALE=${hl}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
    }
  }, [searchParams]);

  return null;
}
