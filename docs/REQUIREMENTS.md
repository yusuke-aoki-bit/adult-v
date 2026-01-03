# 要件定義と対応状況

## 要件一覧

| # | 要件 | 対応状況 | 備考 |
|---|------|---------|------|
| 1 | 各ASPの全商品を順次収集 | ✅ 対応済み | 全ASPで--full-scan対応 |
| 2 | 品番IDやタイトルと演者の紐づけ情報を収集 | ⚠️ 部分対応 | Wiki優先、ASP直接情報の活用余地あり |
| 3 | ASPの商品と演者の紐づけ | ✅ 対応済み | product_performersテーブル |
| 4 | ASP間での同一商品の紐づけ | ✅ 対応済み | normalized_product_id |
| 5 | セール情報を収集 | ✅ 対応済み | product_salesテーブル |
| 6 | 付加情報を収集（価格・時間・説明） | ✅ 対応済み | 各フィールド実装済み |
| 7 | 上記すべてを各言語に翻訳 | ✅ 対応済み | 5言語対応（ja/en/zh/zh-TW/ko） |
| 8 | UI/UXに展開 | ✅ 対応済み | 商品詳細・演者・検索対応 |

---

## 1. 各ASPの全商品を順次収集

### 対応ASP一覧

| ASP | クローラー | 全商品収集オプション | Cloud Run Job |
|-----|-----------|-------------------|---------------|
| DUGA | `crawl-duga-api-v2.ts` | `--full-scan --year=YYYY` | crawl-duga |
| FANZA | `crawl-fanza.ts` | `--full-scan --max-pages=N` | fanza-daily |
| MGS | `crawl-mgs-list.ts` | `--category-crawl` / `--full-scan` | mgs-full-crawl, mgs-series-scan |
| SOKMIL | `crawl-sokmil-api-v2.ts` | `--page=N --max-pages=N` | crawl-sokmil |
| FC2 | `crawl-fc2-video.ts` | `--page=N` | crawl-fc2 |
| Japanska | `crawl-japanska.ts` | `--page=N --limit=N` | crawl-japanska |
| b10f | `crawl-b10f-csv.ts` | CSV全件処理 | crawl-b10f |
| Tokyo-Hot | `crawl-tokyohot.ts` | `--start-page=N --end-page=N` | crawl-tokyohot |
| Caribbean | `crawl-caribbean.ts` | `--start-date --end-date` | - |
| 1pondo | `crawl-1pondo.ts` | `--start-date --end-date` | - |

### 実装詳細

```
packages/crawlers/src/
├── products/           # 商品クローラー
│   ├── crawl-duga-api-v2.ts
│   ├── crawl-fanza.ts
│   ├── crawl-mgs.ts
│   ├── crawl-sokmil-api-v2.ts
│   ├── crawl-fc2-video.ts
│   └── ...
└── enrichment/
    └── crawl-mgs-list.ts   # MGS一覧クローラー
```

---

## 2. 品番IDやタイトルと演者の紐づけ情報を収集

### 実装済み

- **Wikiソース**: `packages/crawlers/src/performers/wiki-sources/`
  - AV Wiki, Seesaa Wiki, Wikipedia日本語版, Erodougazo
- **保存先**: `wiki_crawl_data`テーブル（品番 → 演者名）
- **クローラー連携**: クロール時にWikiデータを参照

### 課題

- ASPが直接提供する演者情報の活用が不十分
- FANZAの女優ID/情報取得が不足

---

## 3. ASPの商品と演者の紐づけ

### DBスキーマ

```sql
product_performers (
  product_id  INTEGER REFERENCES products(id),
  performer_id INTEGER REFERENCES performers(id),
  PRIMARY KEY (product_id, performer_id)
)
```

### 実装

- `savePerformersBatch()` - バッチ保存
- `savePerformersWithWikiPriority()` - Wiki優先マージ
- `performer_aliases` - 演者別名対応

---

## 4. ASP間での同一商品の紐づけ

### 統一ID方式

```
products.normalized_product_id = "{品番}".toLowerCase()
例: "stars-865", "abw-123", "300mium-1234"
```

### ASP別情報

```sql
product_sources (
  product_id         INTEGER REFERENCES products(id),
  asp_name           TEXT,              -- 'FANZA', 'DUGA', 'MGS', etc.
  original_product_id TEXT,             -- ASP固有のID
  affiliate_url      TEXT,
  price              INTEGER,
  ...
)
```

---

## 5. セール情報を収集

### DBスキーマ

```sql
product_sales (
  id               SERIAL PRIMARY KEY,
  asp_name         TEXT NOT NULL,
  product_id       TEXT NOT NULL,
  regular_price    INTEGER,
  sale_price       INTEGER,
  discount_percent INTEGER,
  sale_type        TEXT,      -- 'timesale', 'campaign', 'clearance'
  sale_name        TEXT,
  start_at         TIMESTAMP,
  end_at           TIMESTAMP,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP
)
```

### 実装

- `saveSaleInfo()` - `packages/crawlers/src/lib/sale-helper.ts`
- 各クローラーから呼び出し
- 期限切れセールの自動非アクティブ化

---

## 6. 付加情報を収集

### 価格

```sql
product_sources.price      -- 代表価格
product_prices (           -- 詳細価格
  source_id   INTEGER,
  price_type  TEXT,        -- 'download', 'streaming', 'hd', 'sd'
  price       INTEGER,
  currency    TEXT         -- 'JPY', 'USD'
)
```

### 動画時間

```sql
products.duration          -- 再生時間（分）
```

### 説明文

```sql
products.description       -- 日本語
products.description_en    -- 英語
products.description_zh    -- 中国語簡体
products.description_zh_tw -- 中国語繁体
products.description_ko    -- 韓国語
```

### 画像

```sql
product_images (
  product_id     INTEGER,
  image_url      TEXT,
  image_type     TEXT,     -- 'thumbnail', 'package', 'sample'
  display_order  INTEGER,
  asp_name       TEXT
)
```

### 動画

```sql
product_videos (
  product_id     INTEGER,
  video_url      TEXT,
  video_type     TEXT,     -- 'sample', 'streaming', 'download'
  quality        TEXT,     -- '1080p', '720p', '480p', '4K'
  file_size      BIGINT,
  format         TEXT      -- 'mp4', 'wmv', 'm3u8'
)
```

---

## 7. 多言語翻訳

### 対応言語

| コード | 言語 |
|-------|------|
| ja | 日本語（元言語） |
| en | 英語 |
| zh | 中国語簡体字 |
| zh-TW | 中国語繁体字 |
| ko | 韓国語 |

### 翻訳対象

- 商品タイトル: `title_en`, `title_zh`, `title_zh_tw`, `title_ko`
- 説明文: `description_en`, etc.
- 演者名: `name_en`, etc.
- 演者バイオ: `bio_en`, etc.
- タグ名: `name_en`, etc.

### 翻訳エンジン

1. **DeepL API** - メイン（高品質）
2. **Lingva Translate** - フォールバック
3. **Google Cloud Translation API** - Cloud Run環境

### 実装

```
packages/crawlers/src/lib/translate.ts           # 翻訳API
packages/shared/src/lib/translate.ts             # 共有翻訳ロジック
packages/crawlers/src/enrichment/translation-backfill.ts  # バックフィル
```

---

## 8. UI/UX展開

### ページ構成

| ページ | パス | 機能 |
|-------|------|------|
| 商品詳細 | `/[locale]/products/[id]` | 多言語タイトル、複数ASP価格比較、セール表示 |
| 演者詳細 | `/[locale]/actress/[performerId]` | 多言語プロフィール、出演作品リスト |
| 商品一覧 | `/[locale]/products` | フィルタ、ソート、検索 |
| 検索 | `/[locale]/search` | Meilisearch統合、多言語検索 |

### コンポーネント

```
packages/shared/src/components/
├── ProductCard/           # 商品カード
├── ActressCard/           # 演者カード
├── PriceDisplay/          # 価格表示（セール対応）
├── LanguageSwitcher/      # 言語切り替え
└── ...
```

### ローカライゼーション

```typescript
// packages/shared/src/lib/localization.ts
getLocalizedTitle(product, locale)
getLocalizedDescription(product, locale)
getLocalizedPerformerName(performer, locale)
```

---

## 実行コマンド例

### 全商品収集

```bash
# DUGA 2024年
npx tsx packages/crawlers/src/products/crawl-duga-api-v2.ts --full-scan --year=2024

# FANZA
npx tsx packages/crawlers/src/products/crawl-fanza.ts --full-scan --max-pages=1000

# MGSカテゴリ
npx tsx packages/crawlers/src/enrichment/crawl-mgs-list.ts --category-crawl --max-pages=500
```

### 翻訳バックフィル

```bash
npx tsx packages/crawlers/src/enrichment/translation-backfill.ts --type=products --limit=1000
```

### 演者紐づけ

```bash
npx tsx packages/crawlers/src/enrichment/performer-linking/link-performers.ts
```

---

## Cloud Run Jobs

| ジョブ名 | 用途 | スケジュール |
|---------|------|-------------|
| fanza-daily | FANZA日次更新 | 毎日 |
| mgs-daily | MGS日次更新 | 毎日 |
| mgs-full-crawl | MGS全商品収集 | 手動 |
| crawl-duga | DUGA日次更新 | 毎日 |
| crawl-sokmil | SOKMIL更新 | 毎日 |
| enrich-performers | 演者情報充実化 | 手動 |
| link-wiki-performers | Wiki演者紐づけ | 手動 |

---

## 9. SEO対策

### 対応状況: ✅ 対応済み

| 項目 | 状況 | 実装ファイル |
|------|------|-------------|
| メタデータ最適化 | ✅ | `packages/shared/src/lib/seo.ts` |
| 構造化データ（JSON-LD） | ✅ | Product, Person, FAQ, BreadcrumbList, VideoObject, Review |
| サイトマップ | ✅ | `apps/web/app/sitemap*.ts` |
| OGP/Twitter Cards | ✅ | `generateBaseMetadata()` |
| hreflang多言語対応 | ✅ | 5言語（ja/en/zh/zh-TW/ko） |
| robots.txt | ✅ | `apps/web/app/robots.ts` |

### 構造化データ（JSON-LD）対応一覧

| スキーマタイプ | 用途 | ページ |
|--------------|------|-------|
| Product | 商品情報、価格、評価 | 商品詳細 |
| Person | 演者情報 | 演者詳細 |
| VideoObject | サンプル動画 | 商品詳細 |
| FAQPage | よくある質問 | 商品・演者・ホーム |
| BreadcrumbList | パンくずリスト | 全ページ |
| WebSite | サイト情報 | レイアウト |
| Organization | 運営者情報 | レイアウト |
| Review/CriticReview | AIレビュー | 商品詳細 |
| ItemList | 作品一覧 | 演者詳細 |
| AggregateOffer | 複数ASP価格比較 | 商品詳細 |
| HowTo | 視聴方法 | 商品詳細 |
| CollectionPage | コレクション | 一覧ページ |

### サイトマップ構成

```
apps/web/app/
├── sitemap.xml/route.ts           # メインサイトマップ
├── sitemap-index.ts               # サイトマップインデックス
├── sitemap-static.xml/route.ts    # 静的ページ
├── sitemap-products-[chunk].xml/  # 商品（分割）
├── sitemap-actresses-[chunk].xml/ # 演者（分割）
└── sitemap-tags.xml/route.ts      # タグ
```

### robots.txt ボット別設定

| ボット | 設定 |
|-------|------|
| Googlebot | 許可（CSS/JS/画像含む） |
| Bingbot | 許可（crawlDelay: 1秒） |
| Baiduspider | 許可（中国語対応） |
| Naverbot | 許可（韓国語対応） |
| AhrefsBot等 | ブロック（SEOボット） |
| GPTBot等 | 許可（AI学習用、2秒間隔）|

### SEOメタデータ生成

```typescript
// packages/shared/src/lib/seo.ts
generateBaseMetadata(title, description, image, path, keywords, locale)
generateOptimizedDescription(title, actressName, tags, releaseDate, productId, options)
generateProductSchema(name, description, image, url, price, brand, rating, salePrice, currency, sku)
generatePersonSchema(name, description, image, url, options)
generateFAQSchema(faqs)
```

### 多言語SEO

- **canonical URL**: `?hl=`パラメータ方式（ja/en/zh/zh-TW/ko）
- **hreflang**: 全5言語 + x-default
- **言語別FAQ**: 各言語で最適化されたFAQ生成
- **ロケール別キーワード**: 言語ごとにSEOキーワード設定

---

## 10. UI/UX機能一覧

### ページ構成

| ページ | パス | 主要機能 |
|-------|------|---------|
| ホーム | `/` | 女優一覧、フィルター、最近見た作品、おすすめ |
| 商品一覧 | `/products` | 高度なフィルター、ソート、ページネーション |
| 商品詳細 | `/products/[id]` | 画像ギャラリー、動画、価格比較、AIレビュー |
| 女優詳細 | `/actress/[id]` | キャリア分析、出演作品、関連女優 |
| 発見モード | `/discover` | Tinder風スワイプUI |
| お気に入り | `/favorites` | 作品/女優のお気に入り管理 |
| 統計 | `/statistics` | ランキング、トレンドチャート |
| カレンダー | `/calendar` | リリースカレンダー |
| 予算管理 | `/budget` | 月間予算、ウォッチリスト |
| プロフィール | `/profile` | 嗜好分析、視聴履歴 |
| メーカー | `/makers` | メーカー/レーベル一覧 |
| シリーズ | `/series` | シリーズ一覧 |
| カテゴリ | `/categories` | ジャンル/タグ一覧 |

### フィルター・検索機能

| 機能 | 説明 |
|------|------|
| ASPフィルター | 複数選択・除外対応（FANZA, MGS, DUGA等） |
| ジャンルフィルター | 対象/除外の組み合わせ |
| 女優属性フィルター | 血液型、カップサイズ、身長範囲 |
| サンプルフィルター | 動画有無、画像有無 |
| 出演タイプ | 単体/複数出演 |
| セールフィルター | セール中のみ表示 |
| リリース日範囲 | 開始日〜終了日 |
| ソート | リリース日、価格、評価、タイトル、出演数 |
| プリセット保存 | フィルター設定の保存/読み込み |
| 品番検索 | SSIS-865等の品番で直接検索 |
| 自然言語検索 | キーワード検索 |

### ユーザー機能

| 機能 | ストレージ | 説明 |
|------|-----------|------|
| お気に入り | LocalStorage + Firebase | 作品/女優のお気に入り登録 |
| 視聴履歴 | LocalStorage + Firebase | 最大20件、日記形式 |
| 後で見る | LocalStorage | ウォッチリスト管理 |
| 視聴済みマーク | Firebase | 視聴完了記録 |
| 予算管理 | LocalStorage | 月間予算設定、コスト計算 |
| 嗜好分析 | Firebase | 10カテゴリのレーダーチャート |
| クラウド同期 | Firebase | 複数デバイス間同期 |

### 商品詳細ページ機能

| 機能 | 説明 |
|------|------|
| 画像ギャラリー | スワイプ対応、ライトボックス |
| サンプル動画 | 動的読み込みプレイヤー |
| 価格比較 | 複数ASP間の価格表示 |
| セール表示 | 残り時間、割引率 |
| AIレビュー | AI生成の作品分析（システム事前生成） |
| シーンタイムライン | シーン情報表示 |
| コスパ分析 | 分あたり価格計算 |
| 関連商品 | 同演者・同メーカー・同シリーズ |
| 固定CTA | モバイル下部/デスクトップ右 |
| SNSシェア | Twitter, LINE等 |

### 女優詳細ページ機能

| 機能 | 説明 |
|------|------|
| ヒーロー画像 | 高解像度プロフィール画像 |
| キャリアタイムライン | デビュー〜現在/引退 |
| AI分析レビュー | AI生成の女優分析（システム事前生成） |
| クロスASP情報 | 複数ASPでの出演状況 |
| 人気作品TOP5 | 評価・レビュー数順 |
| セール中作品 | 現在セール中の作品 |
| 関連女優 | 共演者一覧 |
| 類似女優 | ジャンルベースの推奨 |
| 引退警告 | 活動停止の場合に表示 |

### 統計・分析機能

| 機能 | 説明 |
|------|------|
| 月別リリース推移 | 折れ線グラフ |
| ジャンル分布 | 円グラフ |
| 女優ランキング | 出演数TOP20 |
| メーカーシェア | メーカー別占有率 |
| デビュートレンド | 年別デビュー数 |
| 年別統計 | 年ごとの作品数推移 |
| プリファレンス分析 | 10カテゴリレーダーチャート |
| ウォッチリスト分析 | 購入計画のコスト分析 |

### パフォーマンス最適化

| 技術 | 適用箇所 |
|------|---------|
| ISR | ホーム(60秒)、商品詳細(600秒)、カテゴリ(3600秒) |
| 動的読み込み | 動画プレイヤー、関連商品、AIレビュー、価格セクション |
| 仮想スクロール | 商品グリッド（react-window） |
| 画像最適化 | Next.js Image、WebP、Blur placeholder |
| コード分割 | ページ・コンポーネント単位 |

### レスポンシブデザイン

| 画面サイズ | グリッド列数 | 特徴 |
|-----------|-------------|------|
| モバイル (sm) | 2列 | ハンバーガーメニュー、下部固定CTA |
| タブレット (md) | 3列 | - |
| ノートPC (lg) | 4列 | - |
| デスクトップ (xl) | 5列 | サイドフィルター |
| ワイド (2xl) | 6列 | ホバーエフェクト |

### インタラクション

| 機能 | 説明 |
|------|------|
| スワイプ | 画像ギャラリー、発見モード |
| アコーディオン | フィルター、詳細情報セクション |
| モーダル | ライトボックス、検索オートコンプリート |
| アニメーション | スケルトン、セール緊急バッジ、ヘッダー表示/非表示 |
| 無限スクロール | 商品一覧（オプション） |
| プログレスバー | ページ遷移時 |

### コンポーネント構成

```
packages/shared/src/components/   # 共有コンポーネント（56個）
├── Header/                       # ヘッダー（検索バー、ナビ、言語切替）
├── Footer/                       # フッター（人気女優、ジャンルリンク）
├── ProductCard/                  # 商品カード（セール、レーティング）
├── ActressCard/                  # 女優カード（出演数、トレンド）
├── Pagination/                   # ページネーション
├── VirtualProductGrid/           # 仮想スクロールグリッド
├── SearchBar/                    # 検索バー
├── FilterSortBar/                # フィルター・ソートバー
├── ImageLightbox/                # 画像ライトボックス
├── StickyCta/                    # 固定購入ボタン
├── sections/                     # セクションコンポーネント
│   ├── RecentlyViewedSection/    # 最近見た作品
│   ├── ForYouRecommendationsSection/  # おすすめ
│   └── WeeklyHighlightsSection/  # 今週の注目
├── stats/                        # 統計チャート
│   ├── ReleasesTrendChart/       # リリース推移
│   ├── GenreDistributionChart/   # ジャンル分布
│   └── CalendarGrid/             # カレンダー
└── ...

apps/web/components/              # アプリ固有コンポーネント（81個）
├── ProductListFilter/            # 商品フィルター
├── ActressListFilter/            # 女優フィルター
├── ProductImageGallery/          # 画像ギャラリー
├── ProductVideoPlayer/           # 動画プレイヤー
├── EnhancedAiReview/             # AIレビュー
├── SceneTimeline/                # シーンタイムライン
├── PreferenceChart/              # 嗜好レーダーチャート
├── BudgetTracker/                # 予算トラッカー
├── ActressCareerTimeline/        # キャリアタイムライン
└── ...
```

### 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 14+, React 18 |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 状態管理 | React Context, LocalStorage |
| データベース | PostgreSQL (Drizzle ORM) |
| 認証・同期 | Firebase (Firestore, Auth) |
| チャート | Recharts |
| 仮想スクロール | react-window |
| 国際化 | next-intl |
| 検索 | Meilisearch |

---

## 11. マルチサイト構成（apps/web vs apps/fanza）

### 概要

同一コードベースで2つのサイトを運用するマルチサイト構成。

| 項目 | apps/web (メインサイト) | apps/fanza (FANZAサブドメイン) |
|------|------------------------|------------------------------|
| URL | adult-v.com | f.adult-v.com |
| ポート | 3000 | 3001 |
| 対象ASP | 全ASP（FANZA, MGS, DUGA, SOKMIL等） | FANZAのみ |
| テーマカラー | Indigo (#6366f1) | Pink (#ec4899) |
| ブランド名 | Adult-V | FANZA Reviews |
| 相互リンク | FANZAサイトへリンク可 | 他ASPへのリンク不可 |

### サイトモード判定

```typescript
// lib/site-config.ts
export function getSiteMode(hostname?: string): SiteMode {
  // 1. 環境変数 SITE_MODE で強制設定
  // 2. ホスト名判定（f.で始まる → fanza）
  // 3. ローカル開発: localhost:3001 → fanza
  // デフォルト: adult-v
}
```

### 設定の違い

| 設定項目 | adult-v | fanza |
|---------|---------|-------|
| `aspFilter` | `null`（全ASP） | `['FANZA']` |
| `crossLinkEnabled` | `true` | `false` |
| `primaryColor` | Indigo | Pink |
| SEOタイトル | 厳選アダルト動画レビュー | FANZA作品専門レビュー |

### 実装の共有

```
apps/
├── web/                    # メインサイト (adult-v.com)
│   ├── app/                # ページ・API
│   ├── components/         # サイト固有コンポーネント
│   └── lib/site-config.ts  # サイト設定
├── fanza/                  # FANZAサイト (f.adult-v.com)
│   ├── app/                # ページ・API（webとほぼ同一構造）
│   ├── components/         # サイト固有コンポーネント
│   └── lib/site-config.ts  # サイト設定
└── ...

packages/
└── shared/                 # 両サイト共通
    ├── components/         # 共有コンポーネント（56個）
    ├── lib/                # 共有ロジック
    └── db-queries/         # 共有DBクエリ
```

### 開発コマンド

```bash
# メインサイト (localhost:3000)
npm run dev:web

# FANZAサイト (localhost:3001)
npm run dev:fanza
# または
SITE_MODE=fanza npm run dev
```

### ビルド・デプロイ

```bash
# メインサイト
npm run build:web

# FANZAサイト
npm run build:fanza
```

### ASPフィルター動作

- **adult-v**: 全ASPの商品を表示、価格比較機能あり
- **fanza**: FANZAの商品のみ表示、他ASPへのリンクなし

### 相互リンク

- **adult-v → fanza**: 商品詳細ページで「FANZAサイトで見る」リンク表示
- **fanza → adult-v**: FANZAアフィリエイト規約遵守のためリンクなし

### テーマカスタマイズ

各サイトでテーマカラーが異なるため、コンポーネントは`getSiteConfig()`から取得した色を使用。

```typescript
const config = getSiteConfig();
// config.primaryColor: '#6366f1' or '#ec4899'
// config.accentColor: '#8b5cf6' or '#f43f5e'
```

---

## 12. 監視・分析機能

### Sentry エラー監視

| 項目 | 説明 |
|------|------|
| 統合 | `@sentry/nextjs` |
| 設定ファイル | `sentry.*.config.ts`, `instrumentation*.ts` |
| カバレッジ | Server, Client, Edge |
| エラートラッキング | 自動キャプチャ、カスタムエラー送信 |

### Google Analytics 4

| 項目 | 説明 |
|------|------|
| 統合 | `gtag.js` |
| 設定 | `packages/shared/src/lib/google-analytics.ts` |
| カスタムイベント | 購入クリック、お気に入り追加、視聴完了 |
| コンバージョン | CTAクリック、ASP遷移 |

### A/Bテストフレームワーク

```typescript
// packages/shared/src/lib/ab-testing.ts
experiments: {
  ctaButtonText: ['control', 'urgency', 'action'],
  priceDisplayStyle: ['control', 'emphasized'],
  saleCountdownStyle: ['control', 'animated'],
  ctaPlacement: ['default', 'above_fold', 'sticky'],
  trustBadge: ['control', 'prominent'],
  urgencyLevel: ['subtle', 'moderate', 'prominent'],
}
```

- GA4連携でバリアント別CTR計測
- LocalStorageでバリアント固定
- 重み付けランダム割り当て

---

## 13. PWA・通知機能

### PWAサポート

| 項目 | 説明 |
|------|------|
| Service Worker | `public/sw.js` |
| インストーラー | `PWAInstaller.tsx` |
| マニフェスト | `manifest.json` |
| オフライン | 基本ページキャッシュ |
| 多言語対応 | ja/en/zh/ko |

### プッシュ通知

| API | 説明 |
|-----|------|
| `/api/notifications/subscribe` | 購読登録 |
| `/api/notifications/unsubscribe` | 購読解除 |

---

## 14. プライバシー・コンプライアンス

### Cookie同意

| 項目 | 説明 |
|------|------|
| コンポーネント | `CookieConsent.tsx` |
| GDPR対応 | 同意前のトラッキング制限 |
| 設定保存 | LocalStorage |

### 年齢確認

| 項目 | 説明 |
|------|------|
| ページ | `/age-verification` |
| API | `/api/age-verify` |
| Cookie | 18歳以上確認済みフラグ |

---

## 15. 検索機能

### Meilisearch全文検索

| 項目 | 説明 |
|------|------|
| 設定 | `packages/shared/src/lib/meilisearch.ts` |
| インデックス | `products` |
| 特徴 | 50ms以下レスポンス、タイポ許容、日本語対応 |
| ファセット | 女優、タグ、プロバイダー |
| インデクサー | `scripts/index-products-to-meilisearch.ts` |

### 検索対象フィールド

```typescript
interface MeilisearchProduct {
  id, normalizedProductId, originalProductIds[],
  title, titleEn, titleKo, titleZh,
  description, releaseDate, thumbnailUrl,
  performers[], performerIds[],
  tags[], tagIds[],
  providers[], price, rating
}
```

---

## 16. データ保存・キャッシュ

### Google Cloud Storage

| 用途 | 説明 |
|------|------|
| Raw HTML保存 | クロール元HTMLの保存（再解析用） |
| ヘルパー | `packages/crawlers/src/lib/gcs-crawler-helper.ts` |

### データベーステーブル（主要）

| テーブル | 説明 |
|---------|------|
| `products` | 商品マスタ（名寄せ後） |
| `product_sources` | ASP別商品情報 |
| `product_prices` | 価格タイプ別価格 |
| `product_sales` | セール情報 |
| `performers` | 出演者マスタ |
| `performer_aliases` | 別名（芸名変更等） |
| `performer_external_ids` | 外部サイトID |
| `product_performers` | 商品-出演者紐付け |
| `tags` | タグ/ジャンル |
| `product_tags` | 商品-タグ紐付け |
| `product_images` | サンプル画像 |
| `product_videos` | サンプル動画 |
| `product_reviews` | ユーザーレビュー |
| `product_rating_summary` | 評価サマリ |
| `raw_html_data` | 生HTML保存 |

---

## 17. 演者情報収集ソース

### Wikiソース

| ソース | ファイル |
|--------|---------|
| AV-Wiki.net | `crawl-avwiki-net.ts` |
| AV-Wiki.tokyo | `crawl-avwiki-tokyo.ts` |
| Seesaa Wiki | `crawl-seesaawiki-performers.ts` |
| Wikipedia日本語 | `crawl-wikipedia-ja.ts` |
| エロ動画ZO | `crawl-erodougazo-performers.ts` |

### プロファイルソース

| ソース | ファイル |
|--------|---------|
| SOKMIL | `crawl-sokmil-actors.ts` |
| Gravurefit | `crawl-gravurefit-performers.ts` |
| みんなのAV | `crawl-minnano-av-performers.ts` |

### 演者紐付けジョブ

| ジョブ | 説明 |
|-------|------|
| `link-wiki-performers` | Wiki情報と演者紐付け |
| `enrich-performers` | 演者情報充実化 |

---

## 18. API一覧

### 商品API

| エンドポイント | 説明 |
|---------------|------|
| `GET /api/products` | 商品一覧 |
| `GET /api/products/[id]` | 商品詳細 |
| `GET /api/products/[id]/prices` | 価格情報 |
| `GET /api/products/[id]/price-history` | 価格履歴 |
| `GET /api/products/[id]/sale-prediction` | セール予測 |
| `GET /api/products/[id]/viewing-patterns` | 視聴パターン |
| `GET /api/products/search` | 検索 |
| `GET /api/products/search-by-id` | 品番検索 |
| `GET /api/products/related` | 関連商品 |

### 女優API

| エンドポイント | 説明 |
|---------------|------|
| `GET /api/actresses` | 女優一覧 |
| `GET /api/actresses/[id]` | 女優詳細 |
| `GET /api/performers/[id]/bundle` | 女優バンドル情報 |

### ランキング・統計API

| エンドポイント | 説明 |
|---------------|------|
| `GET /api/ranking/products` | 商品ランキング |
| `GET /api/ranking/actresses` | 女優ランキング |
| `GET /api/stats/sales` | セール統計 |
| `GET /api/stats/asp` | ASP統計 |
| `GET /api/stats/daily-releases` | 日別リリース |
| `GET /api/stats/calendar-detail` | カレンダー詳細 |

### その他API

| エンドポイント | 説明 |
|---------------|------|
| `GET /api/recommendations` | おすすめ |
| `GET /api/recommendations/actresses` | 女優おすすめ |
| `GET /api/weekly-highlights` | 週間ハイライト |
| `GET /api/discover` | 発見モード |
| `GET /api/sale-calendar` | セールカレンダー |
| `GET /api/sales/for-you` | パーソナライズセール |
| `GET /api/makers` | メーカー一覧 |
| `GET /api/makers/[makerId]` | メーカー詳細 |
| `GET /api/series/[seriesId]` | シリーズ詳細 |
| `GET /api/search/autocomplete` | オートコンプリート |
| `GET /api/footer-actresses` | フッター女優 |
| `GET /api/footer-links` | フッターリンク |

### 管理API

| エンドポイント | 説明 |
|---------------|------|
| `GET /api/admin/stats` | 管理統計 |
| `GET /api/admin/jobs` | ジョブ管理 |
| `GET /api/embed/stats` | 埋め込み統計 |
| `GET /api/analytics` | アナリティクス |

### Cron API（定期実行）

| エンドポイント | 説明 |
|---------------|------|
| `/api/cron/crawl-*` | 各ASPクロール |
| `/api/cron/enhance-content` | コンテンツ強化 |
| `/api/cron/seo-enhance` | SEO強化 |
| `/api/cron/normalize-performers` | 演者正規化 |
| `/api/cron/performer-pipeline` | 演者パイプライン |
| `/api/cron/content-enrichment-pipeline` | コンテンツ充実パイプライン |
| `/api/cron/cleanup` | クリーンアップ |

---

## 19. コードベース最適化（2025年1月実施）

### 概要

2サイト間（apps/web、apps/fanza）で発生していた大量のコード重複を解消し、パフォーマンスと保守性を向上。

### Phase 1: ui-common完全廃止

**削除パッケージ**: `packages/ui-common`

**移行先**: `packages/shared`

| 移行コンテンツ | 移行先 |
|--------------|--------|
| 5 hooks (useDebounce等) | `packages/shared/src/hooks/` |
| 7 components | `packages/shared/src/components/` |

### Phase 2: lib共通化

**対象**: 30ファイルの重複lib

**作業内容**:
- `apps/web/lib/*.ts` と `apps/fanza/lib/*.ts` の共通ファイルを `packages/shared/src/lib/` に統合
- 各アプリからは re-export 形式で参照

**統合ファイル例**:
- `affiliate.ts`, `api-utils.ts`, `asp-totals.ts`
- `bot-detection.ts`, `cache.ts`, `firebase.ts`
- `google-analytics.ts`, `meilisearch.ts`, `sale-helper.ts`
- `seo-utils.ts`, `image-utils.ts`, `localization.ts`
- `provider-utils.ts`, `structured-data.ts`, `translate.ts`

### Phase 3: N+1クエリ修正

**対象API**: `/api/performers/[id]/relations`

**修正内容**:
```typescript
// Before: N+1 (costars.map内で個別クエリ)
const relationsWithProducts = await Promise.all(
  costars.map(async (costar) => {
    const products = await db.execute(sql`...`);
    return { ...costar, products };
  })
);

// After: 1クエリでバッチ取得（CTE + ROW_NUMBER）
const allProducts = await db.execute(sql`
  WITH ranked_products AS (
    SELECT DISTINCT
      pp2.performer_id as costar_id,
      p.id, p.title, p.release_date,
      ROW_NUMBER() OVER (PARTITION BY pp2.performer_id ORDER BY p.release_date DESC) as rn
    FROM products p
    INNER JOIN product_performers pp1 ON p.id = pp1.product_id
    INNER JOIN product_performers pp2 ON p.id = pp2.product_id
    WHERE pp1.performer_id = ${performerId}
      AND pp2.performer_id = ANY(${costarIds}::int[])
  )
  SELECT * FROM ranked_products WHERE rn <= 3
`);
```

### Phase 4: APIキャッシュ追加

| API | TTL | キャッシュキー形式 |
|-----|-----|-------------------|
| `/api/trends` | 5分 | `trends:{site}:{period}:{locale}` |
| `/api/products/compare` | 10分 | `compare:{site}:{ids}` |
| `/api/performers/[id]/relations` | 30分 | `relations:{site}:{performerId}:{limit}` |

**実装**:
```typescript
import { getCache, setCache, generateCacheKey } from '@adult-v/shared/lib/cache';

const cacheKey = generateCacheKey('trends:web', { period, locale });
const cached = await getCache<TrendsResponse>(cacheKey);
if (cached) return NextResponse.json(cached);

// ... データ取得 ...
await setCache(cacheKey, response, CACHE_TTL);
```

### Phase 5: APIルート共通化

**作成ハンドラー数**: 21個

**パッケージ**: `packages/shared/src/api-handlers/`

**パターン**:
```typescript
// packages/shared/src/api-handlers/createTrendsHandler.ts
export function createTrendsHandler(deps: { getDb: () => DbClient }) {
  return async function GET(request: NextRequest) {
    // 共通ロジック
  };
}

// apps/web/app/api/trends/route.ts
import { createTrendsHandler } from '@adult-v/shared/api-handlers';
import { getDb } from '@/lib/db';
export const GET = createTrendsHandler({ getDb });
```

**共通化済みハンドラー一覧**:
- `createActressDetailHandler` - 女優詳細
- `createActressesHandler` - 女優一覧
- `createProductsHandler` - 商品一覧
- `createProductDetailHandler` - 商品詳細
- `createSearchHandler` - 検索
- `createRecommendationsHandler` - おすすめ
- その他15ハンドラー

### Phase 6: 型安全性向上

**修正箇所**:

| ファイル | 修正内容 |
|---------|---------|
| `packages/shared/src/lib/cache.ts` | `any` → `RedisClientType \| null` |
| `packages/shared/src/db-queries/core-queries.ts` | `sourcesMap: Map<number, any>` → `Map<number, BatchSourceData \| undefined>` |

### 削減効果

| 項目 | 削減量 |
|------|--------|
| lib重複コード | ~3,000行 |
| APIルート重複 | ~5,000行 |
| コンポーネント重複 | ~2,000行 |
| db/queries重複 | ~1,500行 |
| **合計** | **~11,500行** |

### パフォーマンス改善

| 改善項目 | 効果 |
|---------|------|
| N+1クエリ解消 | relations API: 20+クエリ → 2クエリ |
| Redisキャッシュ | trends/compare/relations APIのレスポンス高速化 |
| バッチ取得 | 関連データの一括取得でDB負荷軽減 |

### Tailwind CSS標準化

| 変更前 | 変更後 |
|--------|--------|
| `flex-shrink-0` | `shrink-0` |
| `aspect-[3/4]` | `aspect-3/4` |
| `bg-gradient-to-*` | `bg-linear-to-*` (Tailwind 4) |

---

## 20. ユーザー向け主要機能（2025年1月追加）

### 概要

ユーザー体験を向上させる7つの主要機能を実装。すべてLocalStorageベースでサーバーレス動作。

### 20.1 商品比較機能

**ファイル**:
- `packages/shared/src/components/ProductCompare.tsx`
- `packages/shared/src/components/CompareButton.tsx`
- `packages/shared/src/components/CompareFloatingBar.tsx`
- `packages/shared/src/hooks/useCompareList.ts`

**機能**:
| 項目 | 説明 |
|------|------|
| 最大比較数 | 4商品 |
| 比較項目 | 価格、再生時間、発売日、評価、出演者、ジャンル |
| 共通ハイライト | 共通出演者・ジャンルを強調表示 |
| 最安価格表示 | 複数ASP間の最安価格を自動検出 |
| 永続化 | LocalStorage (`product_compare_list`) |

**ページ**: `/compare`

### 20.2 一括選択機能

**ファイル**:
- `packages/shared/src/hooks/useBulkSelection.ts`
- `packages/shared/src/components/BulkActionBar.tsx`
- `packages/shared/src/components/SelectableCard.tsx`

**機能**:
| 項目 | 説明 |
|------|------|
| 最大選択数 | 50アイテム |
| 全選択/解除 | ワンクリック操作 |
| 選択モード | トグルで有効/無効 |
| アクションバー | 選択時に下部表示 |
| テーマ対応 | ダーク/ライト |

### 20.3 ホームセクションカスタマイズ

**ファイル**:
- `packages/shared/src/hooks/useHomeSections.ts`
- `packages/shared/src/components/HomeSectionManager.tsx`

**デフォルトセクション**:
| ID | 名称 | デフォルト表示 |
|----|------|---------------|
| `sales` | セール情報 | ✓ |
| `ai-search` | AI検索 | ✓ |
| `recently-viewed` | 最近見た作品 | ✓ |
| `profile` | 好みプロファイル | ✓ |
| `recommendations` | おすすめ | ✓ |
| `weekly-highlights` | 今週の注目 | ✓ |
| `trending` | トレンド | ✓ |
| `new-releases` | 新作 | ✓ |

**機能**:
- 各セクションの表示/非表示切り替え
- ドラッグ&ドロップで順序変更
- デフォルトにリセット
- LocalStorage永続化 (`home_section_preferences`)

### 20.4 スワイプジェスチャー

**ファイル**:
- `packages/shared/src/hooks/useSwipeGesture.ts`
- `packages/shared/src/components/SwipeableCarousel.tsx`

**仕様**:
| 項目 | 値 |
|------|-----|
| 最小スワイプ距離 | 50px |
| タイムアウト | 500ms |
| 対応方向 | 4方向（上下左右） |
| 優先度 | 水平 > 垂直 |

**用途**:
- 画像ギャラリー
- 発見モード（Tinder風）
- カルーセルナビゲーション

### 20.5 視聴習慣ダッシュボード

**ファイル**:
- `packages/shared/src/hooks/useViewingDiary.ts`
- `packages/shared/src/components/ViewingHabitsDashboard.tsx`

**記録データ**:
```typescript
interface DiaryEntry {
  productId: string;
  title: string;
  imageUrl: string | null;
  aspName: string;
  performerName?: string;
  performerId?: number | string;
  tags?: string[];
  duration?: number;      // 分
  rating?: number;        // 1-5
  note?: string;
  viewedAt: number;       // timestamp
}
```

**統計機能**:
| 統計 | 説明 |
|------|------|
| 月別集計 | 視聴数、総時間、平均評価 |
| 年間統計 | 年間視聴数、TOP10出演者/ジャンル |
| 曜日パターン | 7日間の視聴分布 |
| ストリーク | 現在/最長連続視聴日数 |

**ストレージ**: LocalStorage (`viewing_diary_{siteMode}`)、最大500件

**ページ**: `/diary`

### 20.6 お気に入り/ウォッチリスト

**ファイル**:
- `packages/shared/src/hooks/useFavorites.ts`
- `packages/shared/src/hooks/useWatchLater.ts`
- `packages/shared/src/components/FavoriteButton.tsx`
- `packages/shared/src/components/WatchLaterButton.tsx`

**お気に入り**:
| 項目 | 説明 |
|------|------|
| 対象 | 商品/出演者 |
| タイプ分類 | `product` / `actress` |
| ストレージ | `adult-v-favorites` |

**ウォッチリスト**:
| 項目 | 説明 |
|------|------|
| 最大数 | 100件 |
| 超過時 | FIFO（古い順削除） |
| ストレージ | `watch-later-list` |

**ページ**: `/favorites`, `/watchlist`

### 20.7 価格アラート

**ファイル**:
- `packages/shared/src/hooks/usePriceAlerts.ts`
- `packages/shared/src/components/PriceAlertButton.tsx`
- `packages/shared/src/components/SaleAlertButton.tsx`

**アラート設定**:
```typescript
interface PriceAlert {
  productId: string;
  normalizedProductId: string;
  title: string;
  thumbnailUrl: string | null;
  currentPrice: number;
  targetPrice: number;
  notifyOnAnySale: boolean;
  createdAt: number;
}
```

**通知設定（useNotificationPreferences）**:
- セールアラート（有効/無効）
- 価格低下通知
- 新作通知
- おすすめ通知

**ページ**: `/alerts`

### 20.8 DBスキーマ追加（2025年1月）

**マイグレーション実施済み**:

| ファイル | 内容 |
|---------|------|
| `0032_add_price_history.sql` | 価格履歴テーブル |
| `0033_add_sale_patterns.sql` | セールパターンテーブル |

**price_history テーブル**:
```sql
CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    product_source_id INTEGER REFERENCES product_sources(id),
    price INTEGER NOT NULL,
    sale_price INTEGER,
    discount_percent INTEGER,
    recorded_at TIMESTAMP DEFAULT NOW()
);
```

**sale_patterns テーブル**:
```sql
CREATE TABLE sale_patterns (
    id SERIAL PRIMARY KEY,
    product_source_id INTEGER REFERENCES product_sources(id),
    performer_id INTEGER REFERENCES performers(id),
    maker_id INTEGER REFERENCES tags(id),
    pattern_type VARCHAR(50) NOT NULL,
    month_distribution JSONB,
    day_of_week_distribution JSONB,
    avg_discount_percent DECIMAL(5,2),
    sale_frequency_per_year DECIMAL(5,2),
    last_sale_date DATE
);
```

**product_views 追加カラム**:
```sql
ALTER TABLE product_views ADD COLUMN session_id VARCHAR(255);
CREATE INDEX idx_product_views_session_id ON product_views(session_id);
```

### 20.9 テスト追加

**新規テストファイル**:

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| `useCompareList.test.ts` | 16 | 比較リストフック |
| `useBulkSelection.test.ts` | 19 | 一括選択フック |
| `useHomeSections.test.ts` | 15 | ホームセクションフック |
| `useSwipeGesture.test.ts` | 13 | スワイプジェスチャー |
| `BulkActionBar.test.tsx` | 17 | アクションバー |
| `ViewingHabitsDashboard.test.tsx` | 18 | ダッシュボード |
| `CompareButton.test.tsx` | 16 | 比較ボタン |
| `price-history.test.ts` | 15 | 価格履歴クエリ |
| `schema-consistency.test.ts` | 9 | DBスキーマ整合性 |

**総テスト数**: 680テスト（32ファイル）

---

## 21. 開発環境

### ローカルサーバー起動

```bash
npm run dev:web    # MGS版 (localhost:3000)
npm run dev:fanza  # FANZA版 (localhost:3001)
```

### 言語設定

GETパラメータ `hl` で指定：

| 言語 | URL |
|------|-----|
| 日本語 | http://localhost:3000?hl=ja |
| 英語 | http://localhost:3000?hl=en |
| 中国語(簡) | http://localhost:3000?hl=zh |
| 中国語(繁) | http://localhost:3000?hl=zh-TW |
| 韓国語 | http://localhost:3000?hl=ko |

### テスト実行

```bash
npm test                           # 全テスト
npm test -- --run __tests__/unit/  # ユニットテストのみ
```

### ビルド

```bash
npm run build:web    # MGS版
npm run build:fanza  # FANZA版
```

---

## 22. ユーザー貢献機能（2025年1月追加）

### 概要

ユーザー参加型プラットフォームとして、レビュー投稿・タグ提案・出演者提案機能を実装。AI自動審査により不適切なコンテンツを自動検出。

### 22.1 ユーザーレビュー機能

**ファイル**:
- `packages/shared/src/api-handlers/user-reviews.ts`
- `packages/shared/src/components/UserContributions/UserReviewForm.tsx`
- `packages/shared/src/components/UserContributions/UserReviewList.tsx`

**DBスキーマ**:
```sql
CREATE TABLE user_reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id VARCHAR(255) NOT NULL,
    rating DECIMAL(3, 1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    content TEXT NOT NULL,
    helpful_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_review_votes (
    id SERIAL PRIMARY KEY,
    review_id INTEGER NOT NULL REFERENCES user_reviews(id),
    user_id VARCHAR(255) NOT NULL,
    vote_type VARCHAR(20) NOT NULL, -- 'helpful', 'not_helpful'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (review_id, user_id)
);
```

**機能**:
| 項目 | 説明 |
|------|------|
| 評価範囲 | 1〜5（0.5刻み対応） |
| 最小文字数 | 10文字以上 |
| 重複防止 | 同一ユーザーは1商品につき1レビュー |
| 投票機能 | 「参考になった」投票 |
| AI審査 | Gemini APIによる不適切コンテンツ検出 |
| ステータス | pending → approved / rejected |

**API**:
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/products/[id]/reviews` | GET | レビュー一覧取得 |
| `/api/products/[id]/reviews` | POST | レビュー投稿 |
| `/api/products/[id]/reviews` | PATCH | レビュー投票 |

### 22.2 タグ提案機能

**ファイル**:
- `packages/shared/src/api-handlers/tag-suggestions.ts`
- `packages/shared/src/components/UserContributions/TagSuggestionForm.tsx`
- `packages/shared/src/components/UserContributions/TagSuggestionList.tsx`

**DBスキーマ**:
```sql
CREATE TABLE user_tag_suggestions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id VARCHAR(255) NOT NULL,
    suggested_tag_name VARCHAR(100) NOT NULL,
    existing_tag_id INTEGER REFERENCES tags(id),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_tag_suggestion_votes (
    id SERIAL PRIMARY KEY,
    suggestion_id INTEGER NOT NULL REFERENCES user_tag_suggestions(id),
    user_id VARCHAR(255) NOT NULL,
    vote_type VARCHAR(10) NOT NULL, -- 'up', 'down'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (suggestion_id, user_id)
);
```

**機能**:
| 項目 | 説明 |
|------|------|
| 最小文字数 | 2文字以上 |
| 重複チェック | 既存タグとの大文字小文字無視比較 |
| 投票機能 | Upvote / Downvote |
| 自動昇格 | 一定投票数で正式タグに昇格（管理者承認） |

**API**:
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/products/[id]/tag-suggestions` | GET | 提案一覧取得 |
| `/api/products/[id]/tag-suggestions` | POST | タグ提案 |
| `/api/products/[id]/tag-suggestions` | PATCH | 投票 |

### 22.3 出演者提案機能

**ファイル**:
- `packages/shared/src/api-handlers/performer-suggestions.ts`
- `packages/shared/src/components/UserContributions/PerformerSuggestionForm.tsx`
- `packages/shared/src/components/UserContributions/PerformerSuggestionList.tsx`

**DBスキーマ**:
```sql
CREATE TABLE user_performer_suggestions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id VARCHAR(255) NOT NULL,
    performer_name VARCHAR(100) NOT NULL,
    existing_performer_id INTEGER REFERENCES performers(id),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_performer_suggestion_votes (
    id SERIAL PRIMARY KEY,
    suggestion_id INTEGER NOT NULL REFERENCES user_performer_suggestions(id),
    user_id VARCHAR(255) NOT NULL,
    vote_type VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (suggestion_id, user_id)
);
```

**機能**:
| 項目 | 説明 |
|------|------|
| 最小文字数 | 2文字以上 |
| 既存リンク | 既存出演者IDとの紐付け可能 |
| 検索機能 | 出演者名でオートコンプリート |
| 重複チェック | 既存出演者との重複防止 |

**API**:
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/products/[id]/performer-suggestions` | GET | 提案一覧取得 |
| `/api/products/[id]/performer-suggestions` | POST | 出演者提案 |
| `/api/products/[id]/performer-suggestions` | PATCH | 投票 |

### 22.4 統合UIコンポーネント

**ファイル**:
- `packages/shared/src/components/UserContributions/UserContributionsSection.tsx`
- `packages/shared/src/components/UserContributions/index.ts`

**機能**:
- アコーディオン形式で3つの貢献機能を統合
- ログイン必須コールバック対応
- 多言語対応（日本語・英語）

---

## 23. 公開お気に入りリスト（2025年1月追加）

### 概要

ユーザーがお気に入り作品のリストを作成・公開・共有できる機能。他ユーザーのリストを閲覧・いいねも可能。

### DBスキーマ

```sql
CREATE TABLE public_favorite_lists (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public_favorite_list_items (
    list_id INTEGER NOT NULL REFERENCES public_favorite_lists(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    display_order INTEGER DEFAULT 0,
    note TEXT,
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (list_id, product_id)
);

CREATE TABLE public_favorite_list_likes (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES public_favorite_lists(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (list_id, user_id)
);
```

### ファイル

**API ハンドラー**:
- `packages/shared/src/api-handlers/public-favorite-lists.ts`

**UIコンポーネント**:
- `packages/shared/src/components/PublicFavoriteLists/PublicListCard.tsx`
- `packages/shared/src/components/PublicFavoriteLists/CreateListModal.tsx`
- `packages/shared/src/components/PublicFavoriteLists/PublicListDetail.tsx`
- `packages/shared/src/components/PublicFavoriteLists/AddToListButton.tsx`

### 機能一覧

| 機能 | 説明 |
|------|------|
| リスト作成 | タイトル・説明・公開/非公開設定 |
| リスト編集 | タイトル・説明・公開設定の変更 |
| リスト削除 | 所有者のみ削除可（アイテムもカスケード削除） |
| アイテム追加 | 商品をリストに追加 |
| アイテム削除 | リストから商品を削除 |
| いいね | 他ユーザーの公開リストにいいね |
| いいね解除 | いいねを取り消し |
| 閲覧数カウント | リスト詳細閲覧時にカウント |
| ソート | いいね数順、閲覧数順、作成日順 |

### アクセス制御

| 操作 | 条件 |
|------|------|
| 公開リスト閲覧 | 誰でも可能 |
| 非公開リスト閲覧 | 所有者のみ |
| リスト編集・削除 | 所有者のみ |
| アイテム追加・削除 | 所有者のみ |
| いいね | ログインユーザー（所有者以外） |

### API

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/favorite-lists` | GET | リスト一覧取得 |
| `/api/favorite-lists` | POST | リスト作成 |
| `/api/favorite-lists/[id]` | GET | リスト詳細取得 |
| `/api/favorite-lists/[id]` | PUT | リスト更新 |
| `/api/favorite-lists/[id]` | DELETE | リスト削除 |
| `/api/favorite-lists/[id]/items` | POST | アイテム追加/削除 |
| `/api/favorite-lists/[id]/like` | POST | いいね/いいね解除 |

### ページ

- `/favorites` - 公開リスト一覧・マイリスト
- 商品詳細ページにAddToListButton配置
