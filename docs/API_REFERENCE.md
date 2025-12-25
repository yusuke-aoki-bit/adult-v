# API リファレンス

このドキュメントは、Adult-V プロジェクトで使用する各ASP（アフィリエイトサービスプロバイダー）のAPI情報、制約事項、およびリファレンス情報をまとめたものです。

## 目次

- [共通注意事項](#共通注意事項)
- [DUGA (APEX)](#duga-apex)
- [Sokmil](#sokmil)
- [MGS (Prestige)](#mgs-prestige)
- [DMM](#dmm)
- [DTI Services](#dti-services)
- [同時掲載制限](#同時掲載制限)

---

## 共通注意事項

### データベース接続

```bash
DATABASE_URL=postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres
```

**注意**: パスワードに `!` が含まれる場合、bash環境では以下のように対応:
- URL エンコード: `AdultV2024%21Secure`
- または単一引用符で囲む: `'AdultV2024!Secure'`

### GCP プロジェクト情報

```
PROJECT_ID: adult-v-446607
REGION: asia-northeast1
SERVICE_ACCOUNT: 646431984228-compute@developer.gserviceaccount.com
```

---

## DUGA (APEX)

### API情報

**公式ドキュメント**: https://duga.jp/aff/member/webservice/

```bash
DUGA_APP_ID=WzsUOEt2124UD65BqsHU
DUGA_AGENT_ID=48611-01  # アフィリエイトID (代理店ID)
DUGA_BANNER_ID=01       # バナーID (01～99)
```

### API仕様

- **ベースURL**: `https://duga.jp/aff/webservice/`
- **レート制限**: 60リクエスト/60秒
- **認証**: APP_ID による認証

### 主要エンドポイント

#### 1. 商品リスト取得

```
GET /item_list
```

**パラメータ**:
- `app_id` (必須): アプリケーションID
- `agent_id` (必須): アフィリエイトID
- `banner_id` (必須): バナーID
- `offset`: 取得開始位置 (デフォルト: 0)
- `limit`: 取得件数 (最大: 100)
- `sort`: ソート順 (`new`, `rank`, `price_asc`, `price_desc`)

#### 2. 商品詳細取得

```
GET /item_detail
```

**パラメータ**:
- `app_id` (必須)
- `agent_id` (必須)
- `banner_id` (必須)
- `item_id` (必須): 商品ID (例: `alpha/0272`)

### アフィリエイトリンク形式

```
https://click.duga.jp/ppv/{item_id}/{agent_id}
```

例: `https://click.duga.jp/ppv/alpha/0272/48611-01`

### 利用規約

**クレジット表示義務**: https://duga.jp/aff/member/html/api-credit.html

- すべてのAPI利用サイト・アプリに以下のクレジット表示が必須:
  ```
  「このサイトはDUGA Webサービスを利用しています」
  ```

**API利用規約**: https://duga.jp/aff/member/html/api-rule.html

### 商品ID形式

- **正規化ID**: `alpha-0272` (データベース保存形式)
- **オリジナルID**: `alpha/0272` (API/アフィリエイト形式)

---

## Sokmil

### API情報

**公式ドキュメント**: https://sokmil-ad.com/member/api

```bash
SOKMIL_API_KEY=70c75ce3a36c1f503f2515ff094d6f60
```

### API仕様

- **ベースURL**: `https://sokmil-ad.com/api/`
- **認証**: API Key による認証
- **レスポンス形式**: JSON

### 主要エンドポイント

#### 1. 商品リスト取得

```
GET /products
```

**パラメータ**:
- `api_key` (必須): APIキー
- `page`: ページ番号
- `per_page`: 1ページあたりの取得件数
- `sort`: ソート順

#### 2. 商品詳細取得

```
GET /products/{product_id}
```

### 利用規約

**クレジット表示義務**: 必須

- すべてのAPI利用サイト・アプリに以下の表示が必須:
  ```
  「提供: ソクミル」
  または
  「Powered by Sokmil」
  ```

---

## MGS (Prestige)

### API情報

```bash
MGS_API_KEY=xxxxx  # 要取得
```

### 特記事項

- **公式API**: 現在は主にスクレイピングで対応
- MGS動画 (旧プレステージ) の商品データを取得
- 一部の系列レーベル (SIRO, STARS, ABP等) も含む

### スクレイピング対象URL

```
https://www.mgstage.com/product/product_detail/{product_id}/
```

例: `https://www.mgstage.com/product/product_detail/300MAAN-1028/`

### 商品ID形式

- シリーズ別プレフィックス:
  - `300MAAN-`: 素人系
  - `SIRO-`: シロウト TV
  - `STARS-`: SODクリエイト STARS
  - `ABP-`: プレステージ Absolutely Perfect

---

## DMM

### API情報

**公式ドキュメント**: https://affiliate.dmm.com/api/

```bash
DMM_API_ID=xxxxx
DMM_AFFILIATE_ID=xxxxx
```

### API仕様

- **ベースURL**: `https://api.dmm.com/affiliate/v3/`
- **認証**: API_ID + Affiliate_ID
- **レスポンス形式**: JSON / XML

### 主要エンドポイント

#### 1. 商品検索

```
GET /ItemList
```

**パラメータ**:
- `api_id` (必須)
- `affiliate_id` (必須)
- `site`: サイトコード (例: `FANZA`)
- `service`: サービスコード (例: `digital`)
- `floor`: フロアコード (例: `videoa`)
- `hits`: 取得件数 (最大: 100)
- `offset`: 取得開始位置

#### 2. 商品詳細

```
GET /ItemInfo
```

### レート制限

- 1秒あたり最大3リクエスト

### 利用規約

- クレジット表示義務あり
- 詳細は公式ドキュメント参照

---

## DTI Services

### 対象サービス

DTI Servicesは以下の複数のアダルトサイトを運営:

1. **一本道 (1pondo)** - https://www.1pondo.tv/
2. **カリビアンコム (Caribbeancom)** - https://www.caribbeancom.com/
3. **カリビアンコムプレミアム** - https://www.caribbeancompr.com/
4. **HEYZO** - https://www.heyzo.com/
5. **天然むすめ (10musume)** - https://www.10musume.com/
6. **パコパコママ (Pacopacomama)** - https://www.pacopacomama.com/
7. **人妻斬り (Hitozumagiri)** - https://www.hitozuma-giri.com/
8. **エッチな0930 (Etchi na 0930)** - https://www.av-e-body.com/
9. **エッチな4610 (Etchi na 4610)** - https://www.av-4610.com/

### 実装情報

**クローラー**: `scripts/crawlers/crawl-dti-sites.ts`

#### 対応済みサイト

| サイト | Site ID | URL形式 | ID形式 | 実装状況 |
|--------|---------|---------|--------|---------|
| 一本道 (1pondo) | 2470 | `https://www.1pondo.tv/movies/{id}/` | MMDDYY_NNN | ✅ 実装済・検証済 |
| カリビアンコム | 2478 | `https://www.caribbeancom.com/moviepages/{id}/index.html` | MMDDYY_NNN | ⚠️ 実装済・要調整 (startId) |
| カリビアンコムプレミアム | 2477 | `https://www.caribbeancompr.com/moviepages/{id}/index.html` | MMDDYY_NNN | ✅ 実装済・検証済 |
| HEYZO | 2665 | `https://www.heyzo.com/moviepages/{id}/index.html` | NNNN (0001~9999) | ✅ 実装済・検証済 |
| 天然むすめ (10musume) | 2471 | `https://www.10musume.com/moviepages/{id}/index.html` | MMDDYY_NNN | ⚠️ 実装済・要調整 (startId) |
| パコパコママ (Pacopacomama) | 2472 | `https://www.pacopacomama.com/moviepages/{id}/index.html` | MMDDYY_NNN | ⚠️ 実装済・要調整 (startId) |
| 人妻斬り (Hitozumagiri) | 2473 | `https://www.hitozuma-giri.com/moviepages/{id}/index.html` | MMDDYY_NNN | ⚠️ 実装済・要調整 (startId) |
| エッチな0930 (Etchi na 0930) | 2474 | `https://www.av-e-body.com/moviepages/{id}/index.html` | MMDDYY_NNN | ⚠️ 実装済・要調整 (startId) |
| エッチな4610 (Etchi na 4610) | 2475 | `https://www.av-4610.com/moviepages/{id}/index.html` | MMDDYY_NNN | ⚠️ 実装済・要調整 (startId) |

**注意**: ⚠️マークのサイトはstartId (開始日) の調整が必要です。現在の設定 (010124_001 = 2024年1月1日) では商品が見つかりません。より古い日付からのクロールが必要です。

#### 一本道 JSON API

一本道は商品詳細情報を取得できるJSON APIを提供しています:

```
GET https://www.1pondo.tv/dyn/phpauto/movie_details/movie_id/{id}.json
```

**レスポンス例**:
```json
{
  "ActressesJa": ["女優名1", "女優名2"],
  "Title": "作品タイトル",
  "Desc": "作品説明",
  "Release": "2025-11-23 10:00:00",
  "ThumbHigh": "https://...",
  "ThumbUltra": "https://...",
  "SampleFiles": [
    {"url": "https://..."} // ⚠️ これはサンプルVIDEOのURL (画像ではない)
  ]
}
```

**注意**: `SampleFiles` はサンプル**動画**のURLであり、サンプル画像ではありません。

#### サンプル画像の取得 (gallery.zip)

一本道のサンプル画像は `gallery.zip` として提供されています:

```
GET https://www.1pondo.tv/assets/sample/{id}/gallery.zip
```

**実装方法**:
1. gallery.zip をダウンロード
2. ZIP内のJPG/PNG画像ファイルを抽出
3. 各画像のURLを `https://www.1pondo.tv/assets/sample/{id}/{filename}` として構築
4. `product_images` テーブルに `image_type='sample'` として保存

**例**:
```typescript
const galleryZipUrl = `https://www.1pondo.tv/assets/sample/111924_001/gallery.zip`;
const response = await fetch(galleryZipUrl);
const zipBuffer = Buffer.from(await response.arrayBuffer());
const zip = new AdmZip(zipBuffer);
const zipEntries = zip.getEntries();

const sampleImages: string[] = [];
for (const entry of zipEntries) {
  if (!entry.isDirectory && entry.entryName.match(/\.(jpg|jpeg|png)$/i)) {
    const imageUrl = `https://www.1pondo.tv/assets/sample/111924_001/${entry.entryName}`;
    sampleImages.push(imageUrl);
  }
}
```

**同様のパターンを持つサイト**:
- 天然むすめ: `https://www.10musume.com/assets/sample/{id}/gallery.zip`
- パコパコママ: `https://www.pacopacomama.com/assets/sample/{id}/gallery.zip`
- カリビアンコムプレミアム: `https://www.caribbeancompr.com/moviepages/{id}/gallery.zip`
- HEYZO: `https://www.heyzo.com/moviepages/{id}/gallery.zip`

### スクレイピング仕様

#### エンコーディング

DTIサイトは **EUC-JP** を使用しています:
- 自動エンコーディング検出機能を実装
- iconv-liteで適切にデコード

#### レート制限

- **500ms/リクエスト** (2リクエスト/秒)
- 連続404は50回まで許容

#### アフィリエイトリンク生成

```typescript
function generateDTILink(originalUrl: string): string {
  // clear-tv.com 形式のアフィリエイトリンクを生成
  return `https://clear-tv.com/click.php?url=${encodeURIComponent(originalUrl)}`;
}
```

### クローラー実行

```bash
# 一本道を10商品クロール
DATABASE_URL='...' npx tsx scripts/crawlers/crawl-dti-sites.ts --site 1pondo --limit 10

# カリビアンコムを100商品クロール
DATABASE_URL='...' npx tsx scripts/crawlers/crawl-dti-sites.ts --site caribbeancom --limit 100

# 全サイトを一括クロール
DATABASE_URL='...' npx tsx scripts/crawlers/crawl-dti-sites.ts
```

### 利用規約

- クレジット表示義務あり (各サイトのロゴまたはサイト名)
- robots.txtを遵守
- 詳細は各サイトの利用規約を参照

---

## 同時掲載制限

### ⚠️ 重要: DMM と DTI Services の排他制限

**DMM** と **DTI Services** は、同一サイト・アプリ上で**同時に掲載することが禁止**されています。

#### 制限内容

```
❌ 禁止: DMMとDTI Services両方のコンテンツを同じサイトに掲載
✅ 許可: DMMまたはDTI Servicesのどちらか一方のみを掲載
```

#### 対象サービス

- **DMM (FANZA)**: すべてのDMMアフィリエイト商品
- **DTI Services**: 上記9サービスすべて

#### 実装上の対応

現在の実装では:
- **DTI Services の商品のみを掲載**
- DMMのAPIキーは `.env.example` に記載のみ
- 実際のクローラーやAPIコールは実装しない

#### 将来的な対応

もしDMMを掲載したい場合:
1. DTI Services の全商品をデータベースから削除
2. DTI Services のクローラーをすべて停止
3. DMMのAPIを有効化
4. サイト上のDTI Services クレジット表示を削除

### 参考リンク

- DMM アフィリエイト利用規約: https://affiliate.dmm.com/entry/term/
- DTI Services 各サービスの利用規約は各サイト参照

---

## キャッシュ設定

```bash
CACHE_TTL_PRICE=3600      # 価格キャッシュ: 1時間
CACHE_TTL_THUMBNAIL=86400  # サムネイルキャッシュ: 24時間
CACHE_TTL_STOCK=1800       # 在庫情報キャッシュ: 30分
```

---

## クローラーのスケジュール

### Cloud Scheduler設定

| クローラー | スケジュール | 並列数 | ステータス |
|----------|------------|--------|----------|
| DUGA | 5分ごと | 10並列 | ENABLED |
| MGS | 5分ごと | 10並列 | ENABLED |
| Sokmil | 毎日3:00 (JST) | 1 | 未デプロイ |
| b10f | 毎日4:00 (JST) | 1 | 未デプロイ |
| Performer Dedup | 毎日3:00 (JST) | 1 | ENABLED |

### スケジューラーセットアップ

```bash
bash scripts/setup-all-schedulers.sh
```

---

## トラブルシューティング

### 1. DATABASE_URL with special characters

**問題**: パスワードに `!` が含まれている場合、bashが履歴展開として解釈してしまう

**解決策**:
```bash
# 方法1: URLエンコード
DATABASE_URL='postgresql://adult-v:AdultV2024%21Secure@34.27.234.120:5432/postgres'

# 方法2: 単一引用符
DATABASE_URL='postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres'
```

### 2. レート制限エラー

各ASPのレート制限を超えた場合:
- DUGAの場合: 60秒待機後にリトライ
- Cloud Schedulerの実行間隔を調整

### 3. クレジット表示漏れ

各ASPのクレジット表示義務を必ず確認し、サイトのフッターなどに明記すること。

---

## 更新履歴

- 2025-01-26: 初版作成
  - DUGA, Sokmil, MGS, DMM, DTI Servicesの情報を追加
  - DMM/DTI Services同時掲載制限を明記
  - クローラースケジュール情報を追加
