'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { localizedHref, locales, defaultLocale, type Locale } from '../../i18n';

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

const FALLBACK_GENRES = [
  { id: 1, name: '巨乳' },
  { id: 2, name: '美少女' },
  { id: 3, name: '人妻' },
  { id: 4, name: '熟女' },
  { id: 5, name: 'OL' },
  { id: 6, name: '制服' },
  { id: 7, name: 'ギャル' },
  { id: 8, name: 'ナース' },
];

interface FooterActress {
  id: number;
  name: string;
}

interface FooterLink {
  id: number | string;
  name: string;
}

interface FooterLinksData {
  genres: FooterLink[];
  series: FooterLink[];
  makers: FooterLink[];
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

// カスタムフック: フッター内部リンクデータを取得
function useFooterLinks(): FooterLinksData {
  const [links, setLinks] = useState<FooterLinksData>({
    genres: FALLBACK_GENRES,
    series: [],
    makers: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/footer-links', {
          next: { revalidate: 3600 },
        });
        if (res.ok) {
          const data = await res.json();
          setLinks({
            genres: data.genres?.length > 0 ? data.genres : FALLBACK_GENRES,
            series: data.series || [],
            makers: data.makers || [],
          });
        }
      } catch {
        // エラー時はフォールバックを維持
      }
    };
    fetchData();
  }, []);

  return links;
}

// 共通翻訳インターフェース
export interface FooterTranslation {
  siteName: string;
  description: string;
  legal: string;
  privacy: string;
  terms: string;
  contact: string;
  contactDescription: string;
  disclaimer2257: string;
  admin: string;
  copyright: string;
  // オプショナル（サイトによって異なる）
  popularActresses?: string;
  affiliateNotice?: string;
  copyrightNotice?: string;
  // 内部リンクセクション用
  popularGenres?: string;
  popularSeries?: string;
  popularMakers?: string;
}

export interface FooterBaseProps {
  /** 翻訳を取得する関数 */
  getTranslation: (locale: string) => FooterTranslation;
  /** パートナーバナーを表示するか */
  showPartnerBanners?: boolean;
  /** 人気女優リストを表示するか */
  showActressList?: boolean;
  /** 内部リンクセクション（ジャンル・シリーズ・メーカー）を表示するか */
  showInternalLinks?: boolean;
  /** パートナーバナーコンポーネント */
  PartnerBanners?: React.ComponentType;
  /** カラム数（3 or 4） */
  columns?: 3 | 4;
}

/**
 * 共有Footerベースコンポーネント
 * 言語取得は?hl=パラメータから統一的に行う
 */
export function FooterBase({
  getTranslation,
  showPartnerBanners = false,
  showActressList = false,
  showInternalLinks = false,
  PartnerBanners,
  columns = 3,
}: FooterBaseProps) {
  const searchParams = useSearchParams();

  // ?hl= パラメータから現在の言語を取得
  const hlParam = searchParams.get('hl');
  const locale = (hlParam && locales.includes(hlParam as Locale) ? hlParam : defaultLocale) as string;
  const t = getTranslation(locale);

  const actresses = useFooterActresses();
  const footerLinks = useFooterLinks();

  const gridCols = columns === 4
    ? 'grid-cols-1 md:grid-cols-4'
    : 'grid-cols-1 md:grid-cols-3';

  return (
    <footer className="theme-footer mt-auto">
      <div className="container mx-auto px-4 py-8">
        {/* サイト情報 */}
        <div className={`grid ${gridCols} gap-8`}>
          <div>
            <h2 className="theme-footer-heading font-bold text-lg mb-2">{t.siteName}</h2>
            <p className="text-sm theme-text-muted">
              {t.description}
            </p>
          </div>

          {/* 人気女優リンク（SEO用内部リンク強化・GSCデータで動的更新） */}
          {showActressList && t.popularActresses && (
            <div>
              <h3 className="theme-footer-heading font-semibold mb-3">{t.popularActresses}</h3>
              <ul className="space-y-1.5 text-sm">
                {actresses.slice(0, 8).map((actress) => (
                  <li key={actress.id}>
                    <Link
                      href={localizedHref(`/actress/${actress.id}`, locale)}
                      className="theme-footer-link transition-colors"
                    >
                      {actress.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 人気ジャンルリンク（SEO内部リンク強化） */}
          {showInternalLinks && (
            <div>
              <h3 className="theme-footer-heading font-semibold mb-3">
                {t.popularGenres || (locale === 'ja' ? '人気ジャンル' : 'Popular Genres')}
              </h3>
              <ul className="space-y-1.5 text-sm">
                {footerLinks.genres.slice(0, 8).map((genre) => (
                  <li key={genre.id}>
                    <Link
                      href={localizedHref(`/products?include=${genre.id}`, locale)}
                      className="theme-footer-link transition-colors"
                    >
                      {genre.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 法的ページリンク */}
          <div>
            <h3 className="theme-footer-heading font-semibold mb-3">{t.legal}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={localizedHref('/privacy', locale)} className="theme-footer-link transition-colors">
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/terms', locale)} className="theme-footer-link transition-colors">
                  {t.terms}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/legal-compliance', locale)} className="theme-footer-link transition-colors">
                  {locale === 'ja' ? '法的コンプライアンス' : 'Legal Compliance'}
                </Link>
              </li>
            </ul>
          </div>

          {/* お問い合わせ */}
          <div>
            <h3 className="theme-footer-heading font-semibold mb-3">{t.contact}</h3>
            <p className="text-sm theme-text-muted">
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

        {/* 人気シリーズ・メーカーセクション（SEO内部リンク強化） */}
        {showInternalLinks && (footerLinks.series.length > 0 || footerLinks.makers.length > 0) && (
          <div className="border-t theme-footer-border mt-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 人気シリーズ */}
              {footerLinks.series.length > 0 && (
                <div>
                  <h3 className="theme-footer-heading font-semibold mb-3">
                    {t.popularSeries || (locale === 'ja' ? '人気シリーズ' : 'Popular Series')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {footerLinks.series.slice(0, 5).map((series) => (
                      <Link
                        key={series.id}
                        href={localizedHref(`/series/${series.id}`, locale)}
                        className="text-xs px-2 py-1 rounded theme-footer-link theme-footer-tag transition-colors"
                      >
                        {series.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 人気メーカー */}
              {footerLinks.makers.length > 0 && (
                <div>
                  <h3 className="theme-footer-heading font-semibold mb-3">
                    {t.popularMakers || (locale === 'ja' ? '人気メーカー' : 'Popular Studios')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {footerLinks.makers.slice(0, 5).map((maker) => (
                      <Link
                        key={maker.id}
                        href={localizedHref(`/makers/${maker.id}`, locale)}
                        className="text-xs px-2 py-1 rounded theme-footer-link theme-footer-tag transition-colors"
                      >
                        {maker.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* アフィリエイト開示 or 著作権通知 & 2257免責 */}
        <div className="border-t theme-footer-border mt-8 pt-6 text-xs theme-text-muted space-y-3">
          {t.affiliateNotice && (
            <p className="leading-relaxed">
              {t.affiliateNotice}
            </p>
          )}
          {t.copyrightNotice && (
            <p className="leading-relaxed">
              {t.copyrightNotice}
            </p>
          )}
          <p className="leading-relaxed">
            {t.disclaimer2257}
          </p>
        </div>

        {/* パートナーバナー表示 */}
        {showPartnerBanners && PartnerBanners && (
          <div className="border-t theme-footer-border mt-6 pt-6">
            <PartnerBanners />
          </div>
        )}

        {/* 管理ページ・コピーライト */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-4 text-sm theme-text-muted">
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

export default FooterBase;
