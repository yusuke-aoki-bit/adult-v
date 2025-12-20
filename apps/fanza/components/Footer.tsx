'use client';

import Link from 'next/link';
import { getFooterTranslation } from '@/lib/hooks/useFooterTranslations';

export default function Footer({ locale = 'ja' }: { locale?: string }) {
  const t = getFooterTranslation(locale);
  return (
    <footer className="theme-footer border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        {/* サイト情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h2 className="theme-footer-heading font-bold text-lg mb-2">{t.siteName}</h2>
            <p className="text-sm theme-footer-link">
              {t.description}
            </p>
          </div>

          {/* 法的ページリンク */}
          <div>
            <h3 className="theme-footer-heading font-semibold mb-3">{t.legal}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${locale}/privacy`} className="theme-footer-link transition-colors">
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="theme-footer-link transition-colors">
                  {t.terms}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/legal-compliance`} className="theme-footer-link transition-colors">
                  {locale === 'ja' ? '法的コンプライアンス' : 'Legal Compliance'}
                </Link>
              </li>
            </ul>
          </div>

          {/* お問い合わせ */}
          <div>
            <h3 className="theme-footer-heading font-semibold mb-3">{t.contact}</h3>
            <p className="text-sm theme-footer-link">
              {t.contactDescription}
            </p>
            <a
              href="mailto:adult.vvvv@gmail.com"
              className="text-sm theme-footer-email transition-colors"
            >
              adult.vvvv@gmail.com
            </a>
          </div>
        </div>

        {/* 著作権遵守 & 2257免責 */}
        <div className="border-t theme-footer-border mt-8 pt-6 text-xs space-y-3">
          <p className="leading-relaxed theme-footer-link">
            {t.copyrightNotice}
          </p>
          <p className="leading-relaxed theme-footer-link">
            {t.disclaimer2257}
          </p>
        </div>

        {/* 管理ページ・コピーライト */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-4 text-sm">
          <Link
            href="/admin/stats"
            className="theme-footer-link transition-colors"
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
