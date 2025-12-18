'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DugaCredit } from './credits/DugaCredit';
import { SokmilCredit } from './credits/SokmilCredit';
import { MgsCredit } from './credits/MgsCredit';
import { DtiCredit } from './credits/DtiCredit';
import { B10fCredit } from './credits/B10fCredit';
import { Fc2Credit } from './credits/Fc2Credit';
import { JapanskaCredit } from './credits/JapanskaCredit';
import { getFooterTranslation } from '@/lib/hooks/useFooterTranslations';

// フォールバック用: GSCデータがない場合の静的リスト
const FALLBACK_ACTRESSES = [
  { id: 61646, name: '新城由衣' },
  { id: 61645, name: '緒方千乃' },
  { id: 20898, name: '羽田真里' },
  { id: 25188, name: '仲間あずみ' },
  { id: 66312, name: '白杞りり' },
  { id: 30618, name: '吉岡蓮美' },
  { id: 14631, name: '青木桃' },
  { id: 47684, name: '森田みゆ' },
];

interface FooterActress {
  id: number;
  name: string;
}

// カスタムフック: フッター女優データを取得（キャッシュ付き）
function useFooterActresses(): FooterActress[] {
  const [actresses, setActresses] = useState<FooterActress[]>(FALLBACK_ACTRESSES);

  useEffect(() => {
    // APIからデータを取得（1時間キャッシュ）
    const fetchData = async () => {
      try {
        const res = await fetch('/api/footer-actresses', {
          next: { revalidate: 3600 }, // 1時間キャッシュ
        });
        if (res.ok) {
          const data = await res.json();
          if (data.actresses?.length > 0) {
            setActresses(data.actresses);
          }
        }
      } catch {
        // エラー時はフォールバックを維持
      }
    };
    fetchData();
  }, []);

  return actresses;
}

export default function Footer({ locale = 'ja' }: { locale?: string }) {
  const t = getFooterTranslation(locale);
  const actresses = useFooterActresses();

  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="container mx-auto px-4 py-8">
        {/* サイト情報 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h2 className="text-white font-bold text-lg mb-2">{t.siteName}</h2>
            <p className="text-sm text-gray-400">
              {t.description}
            </p>
          </div>

          {/* 人気女優リンク（SEO用内部リンク強化・GSCデータで動的更新） */}
          <div>
            <h3 className="text-white font-semibold mb-3">{t.popularActresses || '人気女優'}</h3>
            <ul className="space-y-1.5 text-sm">
              {actresses.slice(0, 8).map((actress) => (
                <li key={actress.id}>
                  <Link
                    href={`/${locale}/actress/${actress.id}`}
                    className="text-gray-400 hover:text-pink-400 transition-colors"
                  >
                    {actress.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 法的ページリンク */}
          <div>
            <h3 className="text-white font-semibold mb-3">{t.legal}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${locale}/privacy`} className="text-gray-400 hover:text-white transition-colors">
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="text-gray-400 hover:text-white transition-colors">
                  {t.terms}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/legal-compliance`} className="text-gray-400 hover:text-white transition-colors">
                  {locale === 'ja' ? '法的コンプライアンス' : 'Legal Compliance'}
                </Link>
              </li>
            </ul>
          </div>

          {/* お問い合わせ */}
          <div>
            <h3 className="text-white font-semibold mb-3">{t.contact}</h3>
            <p className="text-sm text-gray-400">
              {t.contactDescription}
            </p>
            <a
              href="mailto:adult.vvvv@gmail.com"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              adult.vvvv@gmail.com
            </a>
          </div>
        </div>

        {/* アフィリエイト開示 & 2257免責 */}
        <div className="border-t border-gray-800 mt-8 pt-6 text-xs text-gray-400 space-y-3">
          <p className="leading-relaxed">
            {t.affiliateNotice}
          </p>
          <p className="leading-relaxed">
            {t.disclaimer2257}
          </p>
        </div>

        {/* パートナーバナー表示 - グリッドレイアウトで固定サイズ (180x50) */}
        <div className="border-t border-gray-800 mt-6 pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 justify-items-center">
            <div className="w-[180px] h-[50px] flex items-center justify-center">
              <DugaCredit />
            </div>
            <div className="w-[180px] h-[50px] flex items-center justify-center">
              <SokmilCredit variant="88x31" />
            </div>
            <div className="w-[180px] h-[50px] flex items-center justify-center">
              <MgsCredit />
            </div>
            <div className="w-[180px] h-[50px] flex items-center justify-center">
              <DtiCredit />
            </div>
            <div className="w-[180px] h-[50px] flex items-center justify-center">
              <B10fCredit />
            </div>
            <div className="w-[180px] h-[50px] flex items-center justify-center">
              <Fc2Credit />
            </div>
            <div className="w-[180px] h-[50px] flex items-center justify-center">
              <JapanskaCredit />
            </div>
          </div>
        </div>

        {/* 管理ページ・コピーライト */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-4 text-sm text-gray-400">
          <Link
            href="/admin/stats"
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            {t.admin}
          </Link>
          <span className="hidden md:inline">|</span>
          <p>{t.copyright.replace('{year}', String(new Date().getFullYear()))}</p>
        </div>
      </div>
    </footer>
  );
}
