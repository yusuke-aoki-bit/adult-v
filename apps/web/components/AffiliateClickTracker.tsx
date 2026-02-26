'use client';

import { useEffect } from 'react';

/**
 * アフィリエイトリンクのクリックを全て捕捉してGA4に送信
 * rel="sponsored" を持つ外部リンクのクリックを自動トラッキング
 * 商品詳細ページに配置することで、全CTAのクリックを計測
 */
export default function AffiliateClickTracker() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[rel*="sponsored"]');
      if (!link) return;

      const href = link.href;
      if (!href || !href.startsWith('http')) return;

      // CTAの位置を特定
      const ctaLocation = detectCtaLocation(link);

      if (typeof window.gtag === 'function') {
        window.gtag('event', 'affiliate_click', {
          url: href,
          provider: extractProvider(href),
          cta_location: ctaLocation,
          is_sale: link.closest('[class*="red-"]') !== null || link.textContent?.includes('セール') || false,
        });
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, []);

  return null;
}

/** リンクのDOM位置からCTAの種類を判定 */
function detectCtaLocation(link: HTMLAnchorElement): string {
  // StickyCta（別途トラッキング済みだが重複しても問題なし）
  if (link.closest('[class*="fixed"]')) return 'sticky_cta';
  // ファーストビュー購入ボタン（大きなCTA）
  if (link.closest('[class*="py-4"]')?.closest('[class*="mt-4"]')) return 'firstview_cta';
  // 価格比較セクション
  if (link.closest('#price-comparison')) return 'price_comparison';
  // セール緊急CTA
  if (link.closest('[class*="border-red-500"]')) return 'sale_urgency_cta';
  // 他社購入リンク（小さなピルボタン）
  if (link.closest('[class*="border-t"]')?.querySelector('[class*="text-xs"]')) return 'alt_provider';
  return 'other';
}

/** URLからプロバイダー名を推定 */
function extractProvider(url: string): string {
  if (url.includes('duga.jp') || url.includes('click.duga.jp')) return 'DUGA';
  if (url.includes('mgstage.com')) return 'MGS';
  if (url.includes('dmm.co.jp') || url.includes('al.dmm.co.jp')) return 'FANZA';
  if (url.includes('sokmil.com')) return 'SOKMIL';
  if (url.includes('fc2.com')) return 'FC2';
  if (url.includes('caribbeancom.com')) return 'caribbeancom';
  if (url.includes('1pondo.tv')) return '1pondo';
  if (url.includes('heyzo.com')) return 'HEYZO';
  if (url.includes('10musume.com')) return '10musume';
  if (url.includes('pacopacomama.com')) return 'pacopacomama';
  if (url.includes('tokyo-hot.com')) return 'tokyohot';
  if (url.includes('b10f.jp')) return 'B10F';
  if (url.includes('japanska.com')) return 'JAPANSKA';
  if (url.includes('clear-tv.com')) return 'DTI';
  return 'unknown';
}
