/**
 * Google API設定テストスクリプト
 */
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/indexing'];

async function testGoogleApi() {
  console.log('=== Google API Config Test ===\n');

  // 1. 環境変数チェック
  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  console.log('1. GOOGLE_SERVICE_ACCOUNT_KEY_FILE:', keyFilePath || '(not set)');

  if (!keyFilePath) {
    console.log('❌ 環境変数が設定されていません');
    return;
  }

  // 2. ファイル存在チェック
  const fullPath = path.resolve(keyFilePath);
  const fileExists = fs.existsSync(fullPath);
  console.log('2. Key file exists:', fileExists ? '✅ Yes' : '❌ No');
  console.log('   Full path:', fullPath);

  if (!fileExists) {
    console.log('❌ キーファイルが見つかりません');
    return;
  }

  // 3. キーファイル読み込み
  try {
    const keyFile = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    console.log('3. Key file parsed: ✅');
    console.log('   Project ID:', keyFile.project_id);
    console.log('   Client email:', keyFile.client_email);
  } catch (e) {
    console.log('3. Key file parse: ❌', e);
    return;
  }

  // 4. 認証テスト
  try {
    const keyFile = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: SCOPES,
    });

    await auth.authorize();
    console.log('4. Authentication: ✅ Success');

    // 5. Indexing API テスト（URLメタデータ取得）
    const indexing = google.indexing({ version: 'v3', auth });

    // テストURL
    const testUrl = 'https://www.adult-v.com/ja';

    try {
      const metadata = await indexing.urlNotifications.getMetadata({
        url: testUrl,
      });
      console.log('5. Indexing API: ✅ Working');
      console.log('   Test URL:', testUrl);
      console.log('   Response:', JSON.stringify(metadata.data, null, 2));
    } catch (apiError: any) {
      if (apiError.code === 403) {
        console.log('5. Indexing API: ⚠️ Permission denied');
        console.log('   サービスアカウントにSearch Consoleのオーナー権限が必要です');
        console.log('   Email to add:', keyFile.client_email);
      } else if (apiError.code === 404) {
        console.log('5. Indexing API: ✅ Connected (URL not indexed yet)');
      } else {
        console.log('5. Indexing API: ❌ Error');
        console.log('   Code:', apiError.code);
        console.log('   Message:', apiError.message);
      }
    }
  } catch (authError) {
    console.log('4. Authentication: ❌ Failed');
    console.log('   Error:', authError);
  }
}

testGoogleApi().catch(console.error);
