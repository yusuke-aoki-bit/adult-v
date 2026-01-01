/**
 * Google Search Console インデックス状況確認スクリプト
 *
 * 使い方:
 *   npx tsx scripts/check-gsc-index-status.ts
 *
 * 必要な環境変数:
 *   - GOOGLE_APPLICATION_CREDENTIALS または google-service-account-key シークレット
 *   - GSC_SITE_URL: Search Consoleに登録されたサイトURL (デフォルト: sc-domain:adult-v.web.app)
 */

import { google } from 'googleapis';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const PROJECT_ID = 'adult-v';

// 確認対象のサイト
const SITES = [
  { name: 'Adult-V (Firebase)', url: 'sc-domain:adult-v.web.app' },
  { name: 'Adult-V (Cloud Run)', url: 'sc-domain:adult-v-web-513507652700.asia-northeast1.run.app' },
  { name: 'FANZA版', url: 'sc-domain:fanzaviewer.com' },
];

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
  });
  return version.payload?.data?.toString() || '';
}

async function main() {
  console.log('🔍 Google Search Console インデックス状況確認\n');

  // シークレットから認証情報を取得
  let credentials: any;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // ローカル環境: 環境変数からファイルパスを読む
    const fs = await import('fs');
    credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  } else {
    // Cloud環境: Secret Managerから取得
    const serviceAccountKey = await getSecret('google-service-account-key');
    credentials = JSON.parse(serviceAccountKey);
  }

  console.log(`🔑 サービスアカウント: ${credentials.client_email}\n`);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  // 過去28日間のデータ
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 27);

  const dateStartStr = startDate.toISOString().split('T')[0];
  const dateEndStr = endDate.toISOString().split('T')[0];

  console.log(`📅 期間: ${dateStartStr} 〜 ${dateEndStr}\n`);

  // 各サイトのデータを取得
  for (const site of SITES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ${site.name}`);
    console.log(`   URL: ${site.url}`);
    console.log('='.repeat(60));

    try {
      // 1. 全体のサマリー
      const summaryResponse = await searchconsole.searchanalytics.query({
        siteUrl: site.url,
        requestBody: {
          startDate: dateStartStr,
          endDate: dateEndStr,
          dimensions: [],
        },
      });

      const summary = summaryResponse.data.rows?.[0];
      if (summary) {
        console.log('\n📈 全体パフォーマンス:');
        console.log(`   クリック数: ${summary.clicks?.toLocaleString() || 0}`);
        console.log(`   表示回数: ${summary.impressions?.toLocaleString() || 0}`);
        console.log(`   CTR: ${((summary.ctr || 0) * 100).toFixed(2)}%`);
        console.log(`   平均掲載順位: ${(summary.position || 0).toFixed(1)}`);
      }

      // 2. ページ別データ（インデックス確認用）
      const pageResponse = await searchconsole.searchanalytics.query({
        siteUrl: site.url,
        requestBody: {
          startDate: dateStartStr,
          endDate: dateEndStr,
          dimensions: ['page'],
          rowLimit: 5000,
        },
      });

      const pages = pageResponse.data.rows || [];
      console.log(`\n📄 インデックス状況:`);
      console.log(`   検索結果に表示されたページ数: ${pages.length.toLocaleString()}`);

      // ページタイプ別に集計
      const pageStats = {
        home: 0,
        products: 0,
        actress: 0,
        categories: 0,
        series: 0,
        makers: 0,
        statistics: 0,
        other: 0,
      };

      for (const page of pages) {
        const url = (page as any).keys[0] as string;
        if (url.match(/\/products\/[^/]+$/)) {
          pageStats.products++;
        } else if (url.match(/\/actress\/\d+/)) {
          pageStats.actress++;
        } else if (url.match(/\/categories/)) {
          pageStats.categories++;
        } else if (url.match(/\/series/)) {
          pageStats.series++;
        } else if (url.match(/\/makers/)) {
          pageStats.makers++;
        } else if (url.match(/\/statistics/)) {
          pageStats.statistics++;
        } else if (url.match(/\/$/) || url.match(/\/[a-z]{2}$/)) {
          pageStats.home++;
        } else {
          pageStats.other++;
        }
      }

      console.log('\n   ページタイプ別:');
      console.log(`   - トップページ: ${pageStats.home}`);
      console.log(`   - 商品ページ: ${pageStats.products}`);
      console.log(`   - 女優ページ: ${pageStats.actress}`);
      console.log(`   - カテゴリ: ${pageStats.categories}`);
      console.log(`   - シリーズ: ${pageStats.series}`);
      console.log(`   - メーカー: ${pageStats.makers}`);
      console.log(`   - 統計: ${pageStats.statistics}`);
      console.log(`   - その他: ${pageStats.other}`);

      // 3. 高パフォーマンスページ TOP 10
      const topPages = pages
        .sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0))
        .slice(0, 10);

      if (topPages.length > 0) {
        console.log('\n🌟 クリック数TOP10ページ:');
        for (let i = 0; i < topPages.length; i++) {
          const p = topPages[i] as any;
          const url = p.keys[0];
          // URLを短縮表示
          const shortUrl = url.replace(/https?:\/\/[^/]+/, '').substring(0, 50);
          console.log(`   ${i + 1}. ${shortUrl}${url.length > 50 ? '...' : ''}`);
          console.log(`      クリック: ${p.clicks}, 表示: ${p.impressions}, 順位: ${p.position?.toFixed(1)}`);
        }
      }

      // 4. 低パフォーマンス（要改善）ページ
      const lowPerformance = pages
        .filter((p: any) => p.impressions >= 100 && p.position > 20)
        .sort((a: any, b: any) => (b.impressions || 0) - (a.impressions || 0))
        .slice(0, 5);

      if (lowPerformance.length > 0) {
        console.log('\n⚠️  要改善ページ (表示100以上、順位20以下):');
        for (const p of lowPerformance) {
          const page = p as any;
          const url = page.keys[0];
          const shortUrl = url.replace(/https?:\/\/[^/]+/, '').substring(0, 50);
          console.log(`   - ${shortUrl}${url.length > 50 ? '...' : ''}`);
          console.log(`     表示: ${page.impressions}, 順位: ${page.position?.toFixed(1)}, CTR: ${((page.ctr || 0) * 100).toFixed(2)}%`);
        }
      }

    } catch (error: any) {
      if (error.code === 403) {
        console.log('\n❌ アクセス権限がありません。Search Consoleでサービスアカウントを追加してください。');
      } else if (error.code === 404) {
        console.log('\n❌ サイトが見つかりません。URLが正しいか確認してください。');
      } else {
        console.log(`\n❌ エラー: ${error.message}`);
      }
    }
  }

  console.log('\n\n✨ 確認完了');
}

main().catch(console.error);
