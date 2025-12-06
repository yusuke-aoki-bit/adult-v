# クローラー構成

## アクティブなクローラー（使用するもの）

### 商品クローラー
| ファイル | ASP | 説明 | バリデーション | レビュー | AI |
|----------|-----|------|---------------|----------|-----|
| `crawl-mgs.ts` | MGS | MGS商品詳細ページをクロール | ✅ | ✅ | ✅ |
| `crawl-dti-sites.ts` | DTI | 一本道/カリビアンコム等をクロール | ✅ | - | ✅ |
| `crawl-duga-api.ts` | DUGA | DUGA APIから商品取得 + ページスクレイピング | ✅ | ✅ | ✅ |
| `crawl-fc2.ts` | FC2 | FC2コンテンツマーケットをクロール | ✅ | - | ✅ |
| `crawl-japanska.ts` | Japanska | Japanskaをクロール（メイン） | ✅ | - | ✅ |
| `crawl-b10f-csv.ts` | b10f | b10f CSVから商品取得 | ✅ | - | ✅ |

- **レビュー**: MGS/DUGAに対応。他ASPはレビュー情報が公開されていないため非対応。
- **AI機能**: 全クローラー対応（Gemini APIによる説明文生成・タグ抽出）。`--no-ai`オプションで無効化可能。

### 演者情報クローラー
| ファイル | 説明 |
|----------|------|
| `crawl-wiki-performers.ts` | Wiki系サイトから演者情報を取得 |
| `crawl-wiki-parallel.ts` | 並列でWiki情報を取得 |
| `crawl-wikipedia-ja.ts` | 日本語Wikipediaから演者情報を取得 |
| `crawl-avwiki-tokyo.ts` | AV Wikiから演者情報を取得 |

### データインポート
| ファイル | 説明 |
|----------|------|
| `crawl-b10f-csv.ts` | B10F CSVファイルからインポート |
| `crawl-dti-fc2blog.ts` | DTI FC2ブログからインポート |
| `crawl-fc2-video.ts` | FC2動画情報をインポート |

## ヘルパースクリプト
| ファイル | 説明 |
|----------|------|
| `crawl-mgs-bulk.ts` | MGSの複数商品を一括クロール |
| `crawl-mgs-list.ts` | MGS一覧ページから商品URLを抽出してクロール |

## 共通ライブラリ

### lib/performer-validation.ts
演者名のバリデーションと正規化を行う共通ライブラリ。
全クローラーで使用すること。

```typescript
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../../lib/performer-validation';
```

主な関数:
- `isValidPerformerName(name)`: 名前が有効かチェック
- `normalizePerformerName(name)`: 名前を正規化
- `isValidPerformerForProduct(name, title)`: 商品との整合性チェック
- `parsePerformerNames(rawText)`: カンマ区切りなどの文字列をパース

### lib/crawler-utils.ts
クローラー共通ユーティリティ：
- `validateProductData()`: 商品データの検証（トップページ検出）
- `detectRedirect()`: リダイレクト検出
- `isTopPageHtml()`: HTMLがトップページかどうかを検出
- `sanitizeProductData()`: 商品データのサニタイズ
- `fetchPerformersFromGoogleSearch()`: Google検索で女優名を補完

### lib/google-apis.ts
Google APIs統合ライブラリ：
- `generateProductDescription()`: AI商品説明生成（Gemini API）
- `extractProductTags()`: タグ自動抽出（ジャンル/属性/プレイ/シチュエーション）
- `analyzeReviews()`: レビュー感情分析・要約
- `searchPerformerByProductCode(productCode)`: 商品コードから女優名を検索
- `searchActressReading(actressName)`: 女優名から読み仮名を取得
- `customSearch(query, options)`: カスタム検索実行
- `analyzeImage()`: 画像分析（Vision API）
- `translateText()`: 翻訳（Translation API）

## 使い方

### MGS商品のクロール
```bash
# 単一商品（AI機能有効）
npx tsx scripts/crawlers/crawl-mgs.ts https://www.mgstage.com/product/product_detail/259LUXU-1010/

# AI機能を無効化
npx tsx scripts/crawlers/crawl-mgs.ts --no-ai https://www.mgstage.com/product/product_detail/259LUXU-1010/

# 複数商品（バッチ）
npx tsx scripts/crawlers/crawl-mgs-bulk.ts 259LUXU-1010 259LUXU-1011 259LUXU-1012
```

**注意**: MGSに存在しないレーベル（STARS, CAWDなど）の商品IDを指定しないでください。
MGSはプレステージグループの商品のみ取り扱っています。

### DTIサイトのクロール
```bash
# 特定サイトのクロール（AI機能有効）
npx tsx scripts/crawlers/crawl-dti-sites.ts --site 1pondo --limit 100

# AI機能を無効化
npx tsx scripts/crawlers/crawl-dti-sites.ts --site 1pondo --limit 100 --no-ai

# 全サイトのクロール
npx tsx scripts/crawlers/crawl-dti-sites.ts
```

対応サイト:
- 一本道 (1pondo)
- カリビアンコム (caribbeancom)
- カリビアンコムプレミアム (caribbeancompr)
- HEYZO
- 天然むすめ (10musume)
- パコパコママ (pacopacomama)
- 他多数

### DUGAのクロール
```bash
# 通常クロール（レビュー取得あり、AI機能有効）
npx tsx scripts/crawlers/crawl-duga-api.ts --limit=100 --offset=0

# レビュー取得をスキップ（高速）
npx tsx scripts/crawlers/crawl-duga-api.ts --limit=100 --skip-reviews

# AI機能を無効化
npx tsx scripts/crawlers/crawl-duga-api.ts --limit=100 --no-ai
```

DUGAクローラーは以下のデータを取得します：
- 商品情報: DUGA API経由
- サンプル画像: API (thumbnail配列)
- サンプル動画: API (samplemovie配列)
- レビュー/評価: 商品ページスクレイピング

### 演者情報のクロール
```bash
# Wiki系サイトから
npx tsx scripts/crawlers/crawl-wiki-performers.ts

# 並列処理
npx tsx scripts/crawlers/crawl-wiki-parallel.ts
```

### 女優名補完（Google Search API）
クローラーで女優名が取得できなかった商品に対して、Google検索で補完します。

```bash
# 女優名未取得の商品に対して補完を実行
npx tsx scripts/backfill/backfill-performers-google-search.ts --limit=100

# Dry Run（実際には保存しない）
npx tsx scripts/backfill/backfill-performers-google-search.ts --dry-run

# 特定ASPのみ処理
npx tsx scripts/backfill/backfill-performers-google-search.ts --asp=MGS --limit=50
```

## 環境変数

### 必須
- `DATABASE_URL`: PostgreSQL接続文字列

### Google APIs（AI機能用）
- `GOOGLE_API_KEY`: Google Cloud APIキー
- `GEMINI_API_KEY`: Gemini APIキー（AI説明文生成用、未設定時はGOOGLE_API_KEYにフォールバック）
- `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`: カスタム検索エンジンID
- `GOOGLE_SERVICE_ACCOUNT_KEY`: サービスアカウントJSON（Indexing/Analytics API用）

### ASP認証
- `DUGA_APP_ID`: DUGA API アプリID
- `DUGA_AGENT_ID`: DUGA API エージェントID

**設定確認:** `npx tsx scripts/check-api-config.js`

**注意:** Google Custom Search APIは1日100クエリまで無料。それ以上は有料プラン。

## トラブルシューティング

### MGSで商品が見つからない
MGSに存在しない商品URLにアクセスすると、トップページのHTMLが返されます。
クローラーはこれを検出して自動的にスキップします。

以下のレーベルはMGSに存在しません（DMM専売）:
- STARS (SODスター)
- CAWD (kawaii*)
- SSIS/SSNI (S1)
- IPX/IPZ (IDEA POCKET)
- MIDV/MIDE (ムーディーズ)
- その他多数

### 演者名が正しくパースされない
`lib/performer-validation.ts` のバリデーションルールを確認してください。
無効な名前パターンは自動的にフィルタリングされます。

### raw_html_data に不要なデータがある
`scripts/cleanup-invalid-mgs-by-prefix.ts` で特定プレフィックスのデータを削除できます。
