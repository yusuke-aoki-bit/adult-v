'use client';

import Link from 'next/link';
import { DugaCredit } from './credits/DugaCredit';
import { SokmilCredit } from './credits/SokmilCredit';
import { MgsCredit } from './credits/MgsCredit';
import { DtiCredit } from './credits/DtiCredit';
import { B10fCredit } from './credits/B10fCredit';
import { Fc2Credit } from './credits/Fc2Credit';
import { JapanskaCredit } from './credits/JapanskaCredit';
import { getFooterTranslation } from '@/lib/hooks/useFooterTranslations';

export default function Footer({ locale = 'ja' }: { locale?: string }) {
  const t = getFooterTranslation(locale);
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="container mx-auto px-4 py-8">
        {/* サイト情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h2 className="text-white font-bold text-lg mb-2">{t.siteName}</h2>
            <p className="text-sm text-gray-400">
              {t.description}
            </p>
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
