'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { localizedHref, locales, defaultLocale, type Locale } from '../../i18n';

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
// Hydration対策: isReadyがtrueになるまでレンダリングしない
function useFooterActresses(): { actresses: FooterActress[]; isReady: boolean } {
  const [actresses, setActresses] = useState<FooterActress[]>([]);
  const [isReady, setIsReady] = useState(false);

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
        // エラー時は空配列を維持
      } finally {
        setIsReady(true);
      }
    };
    fetchData();
  }, []);

  return { actresses, isReady };
}

// カスタムフック: フッター内部リンクデータを取得
// Hydration対策: isReadyがtrueになるまでレンダリングしない
function useFooterLinks(): { links: FooterLinksData; isReady: boolean } {
  const [links, setLinks] = useState<FooterLinksData>({
    genres: [],
    series: [],
    makers: [],
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/footer-links', {
          next: { revalidate: 3600 },
        });
        if (res.ok) {
          const data = await res.json();
          setLinks({
            genres: data.genres || [],
            series: data.series || [],
            makers: data.makers || [],
          });
        }
      } catch {
        // エラー時は空配列を維持
      } finally {
        setIsReady(true);
      }
    };
    fetchData();
  }, []);

  return { links, isReady };
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
  // コンテンツ発見セクション用
  discoverContent?: string;
  discover?: string;
  categories?: string;
  calendar?: string;
  statistics?: string;
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

const footerTexts = {
  ja: { popularGenres: '人気ジャンル', discoverContent: 'コンテンツを探す', todaysPick: '今日の1本', birthdays: '誕生日カレンダー', annualBest: '年間ベスト', weeklyTrends: '週間トレンド', rookies: '新人デビュー', hiddenGems: '隠れた名作', aiSearch: 'AI検索', discover: '発見', community: 'コミュニティ', publicLists: '公開リスト', listRankings: 'リストランキング', reviewers: 'レビュアー', voteRankings: 'ランキング投票', statistics: '統計', legalCompliance: '法的コンプライアンス', popularSeries: '人気シリーズ', popularMakers: '人気メーカー' },
  en: { popularGenres: 'Popular Genres', discoverContent: 'Discover Content', todaysPick: "Today's Pick", birthdays: 'Birthdays', annualBest: 'Annual Best', weeklyTrends: 'Weekly Trends', rookies: 'Rookies', hiddenGems: 'Hidden Gems', aiSearch: 'AI Search', discover: 'Discover', community: 'Community', publicLists: 'Public Lists', listRankings: 'List Rankings', reviewers: 'Reviewers', voteRankings: 'Vote Rankings', statistics: 'Statistics', legalCompliance: 'Legal Compliance', popularSeries: 'Popular Series', popularMakers: 'Popular Studios' },
} as const;
function getFooterText(locale: string) { return footerTexts[locale as keyof typeof footerTexts] || footerTexts.ja; }

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
  const ft = getFooterText(locale);

  const { actresses, isReady: actressesReady } = useFooterActresses();
  const { links: footerLinks, isReady: linksReady } = useFooterLinks();

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
          {showActressList && t.popularActresses && actressesReady && actresses.length > 0 && (
            <div>
              <h3 className="theme-footer-heading font-semibold mb-3">{t.popularActresses}</h3>
              <ul className="space-y-1.5 text-sm">
                {actresses.slice(0, 8).map((actress) => (
                  <li key={actress['id']}>
                    <Link
                      href={localizedHref(`/actress/${actress['id']}`, locale)}
                      className="theme-footer-link transition-colors"
                    >
                      {actress['name']}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 人気ジャンルリンク（SEO内部リンク強化） */}
          {showInternalLinks && linksReady && footerLinks.genres.length > 0 && (
            <div>
              <h3 className="theme-footer-heading font-semibold mb-3">
                {t.popularGenres || ft.popularGenres}
              </h3>
              <ul className="space-y-1.5 text-sm">
                {footerLinks.genres.slice(0, 8).map((genre) => (
                  <li key={genre['id']}>
                    <Link
                      href={localizedHref(`/products?include=${genre['id']}`, locale)}
                      className="theme-footer-link transition-colors"
                    >
                      {genre['name']}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* コンテンツ発見セクション */}
          <div>
            <h3 className="theme-footer-heading font-semibold mb-3">
              {t.discoverContent || ft.discoverContent}
            </h3>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href={localizedHref('/daily-pick', locale)} className="theme-footer-link transition-colors">
                  {ft.todaysPick}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/birthdays', locale)} className="theme-footer-link transition-colors">
                  {ft.birthdays}
                </Link>
              </li>
              <li>
                <Link href={localizedHref(`/best/${new Date().getFullYear() - 1}`, locale)} className="theme-footer-link transition-colors">
                  {ft.annualBest}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/weekly-report', locale)} className="theme-footer-link transition-colors">
                  {ft.weeklyTrends}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/rookies', locale)} className="theme-footer-link transition-colors">
                  {ft.rookies}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/hidden-gems', locale)} className="theme-footer-link transition-colors">
                  {ft.hiddenGems}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/search/semantic', locale)} className="theme-footer-link transition-colors">
                  {ft.aiSearch}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/discover', locale)} className="theme-footer-link transition-colors">
                  {t.discover || ft.discover}
                </Link>
              </li>
            </ul>
          </div>

          {/* コミュニティセクション */}
          <div>
            <h3 className="theme-footer-heading font-semibold mb-3">
              {ft.community}
            </h3>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href={localizedHref('/lists', locale)} className="theme-footer-link transition-colors">
                  {ft.publicLists}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/lists/ranking', locale)} className="theme-footer-link transition-colors">
                  {ft.listRankings}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/reviewers', locale)} className="theme-footer-link transition-colors">
                  {ft.reviewers}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/vote', locale)} className="theme-footer-link transition-colors">
                  {ft.voteRankings}
                </Link>
              </li>
              <li>
                <Link href={localizedHref('/statistics', locale)} className="theme-footer-link transition-colors">
                  {t.statistics || ft.statistics}
                </Link>
              </li>
            </ul>
          </div>

          {/* 法的ページリンク */}
          <div>
            <h3 className="theme-footer-heading font-semibold mb-3">{t.legal}</h3>
            <ul className="space-y-1.5 text-xs">
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
                  {ft.legalCompliance}
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
        {showInternalLinks && linksReady && (footerLinks.series.length > 0 || footerLinks.makers.length > 0) && (
          <div className="border-t theme-footer-border mt-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 人気シリーズ */}
              {footerLinks.series.length > 0 && (
                <div>
                  <h3 className="theme-footer-heading font-semibold mb-3">
                    {t.popularSeries || ft.popularSeries}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {footerLinks.series.slice(0, 5).map((series) => (
                      <Link
                        key={series['id']}
                        href={localizedHref(`/series/${series['id']}`, locale)}
                        className="text-xs px-2 py-1 rounded theme-footer-link theme-footer-tag transition-colors"
                      >
                        {series['name']}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 人気メーカー */}
              {footerLinks.makers.length > 0 && (
                <div>
                  <h3 className="theme-footer-heading font-semibold mb-3">
                    {t.popularMakers || ft.popularMakers}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {footerLinks.makers.slice(0, 5).map((maker) => (
                      <Link
                        key={maker['id']}
                        href={localizedHref(`/makers/${maker['id']}`, locale)}
                        className="text-xs px-2 py-1 rounded theme-footer-link theme-footer-tag transition-colors"
                      >
                        {maker['name']}
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
