# 演者名寄せパイプライン

商品に対して演者を紐付けるための統合パイプラインです。

## 概要

このパイプラインは以下の3ステップで構成されます：

1. **Wikiクローリング** - 各種Wikiサイトから品番-演者のマッピングを収集
2. **名寄せ処理** - 収集したデータを使って商品-演者紐付けを作成
3. **Web検索** - 未紐付け商品についてWikiサイトを個別検索

## 使用方法

### 統計情報の確認

```bash
npx tsx scripts/pipeline/performer-lookup-pipeline.ts status
```

### 全ステップ実行

```bash
# 全ステップを順次実行
npx tsx scripts/pipeline/performer-lookup-pipeline.ts all

# 特定ASPのみ
npx tsx scripts/pipeline/performer-lookup-pipeline.ts all --asp=MGS

# 処理件数を制限
npx tsx scripts/pipeline/performer-lookup-pipeline.ts all --limit=1000

# ドライラン（実際の更新なし）
npx tsx scripts/pipeline/performer-lookup-pipeline.ts all --dry-run
```

### 個別ステップ実行

```bash
# クローリングのみ
npx tsx scripts/pipeline/performer-lookup-pipeline.ts crawl

# 紐付けのみ
npx tsx scripts/pipeline/performer-lookup-pipeline.ts link

# Web検索のみ
npx tsx scripts/pipeline/performer-lookup-pipeline.ts search --asp=DTI --limit=100
```

## データフロー

```
┌─────────────────────────────────────────────────────────────────┐
│                    Step 1: Wikiクローリング                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ seesaawiki  │  │   av-wiki   │  │ shirouto    │             │
│  │  /av_neme   │  │   .net      │  │  name.com   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌──────────────────────┐                           │
│              │   wiki_crawl_data    │                           │
│              │   (品番→演者名)       │                           │
│              └──────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Step 2: 名寄せ処理                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐     ┌──────────────────────┐         │
│  │   wiki_crawl_data    │────▶│     performers       │         │
│  │   (品番→演者名)       │     │     (演者マスタ)      │         │
│  └──────────────────────┘     └──────────────────────┘         │
│                                         │                       │
│  ┌──────────────────────┐               │                       │
│  │      products        │               │                       │
│  │ (normalized_product  │◀──────────────┘                       │
│  │      _id)            │               │                       │
│  └──────────────────────┘               ▼                       │
│                               ┌──────────────────────┐          │
│                               │  product_performers  │          │
│                               │   (商品-演者紐付け)   │          │
│                               └──────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Step 3: Web検索                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐                                       │
│  │   未紐付け商品        │                                       │
│  │   (品番あり)          │                                       │
│  └──────────┬───────────┘                                       │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────────────────────────────┐               │
│  │          Web検索 (レート制限あり)            │               │
│  ├──────────┬──────────┬──────────┬───────────┤               │
│  │みんなのAV│ AV-Wiki  │SeesaaWiki│  タイトル  │               │
│  │  検索    │  検索    │  検索    │   抽出    │               │
│  └──────────┴──────────┴──────────┴───────────┘               │
│             │                                                   │
│             ▼                                                   │
│  ┌──────────────────────┐                                       │
│  │  product_performers  │                                       │
│  │   (追加紐付け)        │                                       │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

## 関連ファイル

### クローラー
- `packages/crawlers/src/performers/wiki-sources/crawl-wiki-performers.ts`
- `packages/crawlers/src/enrichment/wiki/crawl-wiki-parallel.ts`

### 名寄せ処理
- `packages/crawlers/src/enrichment/performer-linking/link-wiki-performers.ts`
- `packages/shared/src/cron-handlers/normalize-performers.ts`

### 検索
- `scripts/normalize-performers-from-wiki.ts`
- `packages/shared/src/db-queries/wiki-performer-search.ts`

## テーブル構造

### wiki_crawl_data
| カラム | 型 | 説明 |
|--------|------|------|
| id | serial | 主キー |
| source | varchar | データソース (seesaawiki, av-wiki等) |
| product_code | varchar | 品番 |
| performer_name | varchar | 演者名 |
| source_url | text | ソースURL |
| created_at | timestamp | 作成日時 |

### product_performer_lookup
| カラム | 型 | 説明 |
|--------|------|------|
| id | serial | 主キー |
| product_code | varchar | 品番（オリジナル） |
| product_code_normalized | varchar | 正規化品番 |
| performer_names | text[] | 演者名配列 |
| source | varchar | データソース |
| title | varchar | 商品タイトル |
| source_url | text | ソースURL |
| crawled_at | timestamp | クロール日時 |

## 注意事項

1. **レート制限**: Web検索は2秒間隔で実行されます（サイト負荷軽減のため）
2. **バリデーション**: 演者名には`performer-validation.ts`のルールが適用されます
3. **重複防止**: ON CONFLICT DO NOTHINGで重複は自動スキップされます

## Cloud Run Job設定

定期実行する場合は、Cloud Schedulerと組み合わせて使用できます：

```bash
# Cloud Run Jobを作成
gcloud run jobs create performer-lookup-pipeline \
  --image=gcr.io/PROJECT_ID/adult-v-crawler \
  --region=us-central1 \
  --memory=2Gi \
  --task-timeout=3600s \
  --set-env-vars="DATABASE_URL=..." \
  --command="npx" \
  --args="tsx,scripts/pipeline/performer-lookup-pipeline.ts,all,--limit=5000"
```
