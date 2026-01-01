/**
 * Google Search Console インデックス状況確認
 */

import { google } from 'googleapis';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const SITE_URL = 'sc-domain:adult-v.com';

async function main() {
  console.log('🔍 Search Console インデックス状況確認\n');
  console.log(`サイト: ${SITE_URL}\n`);

  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: 'projects/adult-v/secrets/google-service-account-key/versions/latest',
  });
  const credentials = JSON.parse(version.payload?.data?.toString() || '{}');

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  // 過去28日間
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 27);

  const dateStartStr = startDate.toISOString().split('T')[0];
  const dateEndStr = endDate.toISOString().split('T')[0];

  console.log(`📅 期間: ${dateStartStr} 〜 ${dateEndStr}\n`);

  // 1. 全体サマリー
  console.log('📈 全体パフォーマンス:');
  const summaryResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: dateStartStr,
      endDate: dateEndStr,
      dimensions: [],
    },
  });

  const summary = summaryResponse.data.rows?.[0];
  if (summary) {
    console.log(`   クリック数: ${summary.clicks?.toLocaleString() || 0}`);
    console.log(`   表示回数: ${summary.impressions?.toLocaleString() || 0}`);
    console.log(`   CTR: ${((summary.ctr || 0) * 100).toFixed(2)}%`);
    console.log(`   平均順位: ${(summary.position || 0).toFixed(1)}`);
  }

  // 2. ページ別データ
  console.log('\n📄 ページインデックス状況:');
  const pageResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: dateStartStr,
      endDate: dateEndStr,
      dimensions: ['page'],
      rowLimit: 25000,
    },
  });

  const pages = pageResponse.data.rows || [];
  console.log(`   検索結果に表示されたページ数: ${pages.length.toLocaleString()}`);

  // ページタイプ別集計
  const stats = {
    home: { count: 0, clicks: 0, impressions: 0 },
    products: { count: 0, clicks: 0, impressions: 0 },
    actress: { count: 0, clicks: 0, impressions: 0 },
    categories: { count: 0, clicks: 0, impressions: 0 },
    series: { count: 0, clicks: 0, impressions: 0 },
    makers: { count: 0, clicks: 0, impressions: 0 },
    statistics: { count: 0, clicks: 0, impressions: 0 },
    saleCalendar: { count: 0, clicks: 0, impressions: 0 },
    other: { count: 0, clicks: 0, impressions: 0 },
  };

  for (const page of pages) {
    const p = page as any;
    const url = p.keys[0] as string;
    const clicks = p.clicks || 0;
    const impressions = p.impressions || 0;

    let category: keyof typeof stats = 'other';

    if (url.match(/\/products\/[^/]+$/)) {
      category = 'products';
    } else if (url.match(/\/actress\/\d+/)) {
      category = 'actress';
    } else if (url.match(/\/categories/) || url.match(/\/products\?/)) {
      category = 'categories';
    } else if (url.match(/\/series/)) {
      category = 'series';
    } else if (url.match(/\/makers/)) {
      category = 'makers';
    } else if (url.match(/\/statistics/)) {
      category = 'statistics';
    } else if (url.match(/\/sale-calendar/)) {
      category = 'saleCalendar';
    } else if (url.match(/adult-v\.com\/?$/) || url.match(/adult-v\.com\/[a-z]{2}\/?$/)) {
      category = 'home';
    }

    stats[category].count++;
    stats[category].clicks += clicks;
    stats[category].impressions += impressions;
  }

  console.log('\n📊 ページタイプ別統計:');
  console.log('   タイプ             | ページ数 | クリック | 表示回数');
  console.log('   -------------------|----------|----------|----------');

  const formatRow = (name: string, s: typeof stats.home) => {
    const padName = name.padEnd(18);
    const padCount = s.count.toLocaleString().padStart(8);
    const padClicks = s.clicks.toLocaleString().padStart(8);
    const padImpressions = s.impressions.toLocaleString().padStart(9);
    return `   ${padName} | ${padCount} | ${padClicks} | ${padImpressions}`;
  };

  console.log(formatRow('トップページ', stats.home));
  console.log(formatRow('商品ページ', stats.products));
  console.log(formatRow('女優ページ', stats.actress));
  console.log(formatRow('カテゴリ/一覧', stats.categories));
  console.log(formatRow('シリーズ', stats.series));
  console.log(formatRow('メーカー', stats.makers));
  console.log(formatRow('統計', stats.statistics));
  console.log(formatRow('セールカレンダー', stats.saleCalendar));
  console.log(formatRow('その他', stats.other));

  // 3. TOP10ページ
  const topPages = [...pages]
    .sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 10);

  console.log('\n🌟 クリック数TOP10:');
  for (let i = 0; i < topPages.length; i++) {
    const p = topPages[i] as any;
    const url = p.keys[0].replace('https://adult-v.com', '');
    const shortUrl = url.length > 45 ? url.substring(0, 45) + '...' : url;
    console.log(`   ${(i + 1).toString().padStart(2)}. ${shortUrl}`);
    console.log(`       クリック: ${p.clicks}, 表示: ${p.impressions?.toLocaleString()}, 順位: ${p.position?.toFixed(1)}`);
  }

  // 4. 表示回数が多いのに順位が低いページ（改善余地あり）
  const improvable = [...pages]
    .filter((p: any) => p.impressions >= 500 && p.position > 15)
    .sort((a: any, b: any) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 5);

  if (improvable.length > 0) {
    console.log('\n⚠️  改善余地のあるページ (表示500以上、順位15以下):');
    for (const p of improvable) {
      const page = p as any;
      const url = page.keys[0].replace('https://adult-v.com', '');
      const shortUrl = url.length > 45 ? url.substring(0, 45) + '...' : url;
      console.log(`   - ${shortUrl}`);
      console.log(`     表示: ${page.impressions?.toLocaleString()}, 順位: ${page.position?.toFixed(1)}, CTR: ${((page.ctr || 0) * 100).toFixed(2)}%`);
    }
  }

  // 5. デバイス別
  console.log('\n📱 デバイス別パフォーマンス:');
  const deviceResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: dateStartStr,
      endDate: dateEndStr,
      dimensions: ['device'],
    },
  });

  for (const row of deviceResponse.data.rows || []) {
    const r = row as any;
    const device = r.keys[0];
    const deviceName = device === 'MOBILE' ? 'モバイル' : device === 'DESKTOP' ? 'デスクトップ' : 'タブレット';
    console.log(`   ${deviceName}: クリック ${r.clicks?.toLocaleString()}, 表示 ${r.impressions?.toLocaleString()}, 順位 ${r.position?.toFixed(1)}`);
  }

  console.log('\n✅ 確認完了');
}

main().catch(console.error);
