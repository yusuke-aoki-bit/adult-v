# Crawler Testing Guide

## 概要

全クローラのテストスクリプトを使用して、各クローラの動作を検証できます。

## テストスクリプトの実行

```bash
cd C:\Users\yuuku\cursor\adult-v
DATABASE_URL="postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres" npx tsx scripts/test-all-crawlers.ts
```

## 必要な環境変数

### DATABASE_URL (必須)

すべてのクローラで必要です。

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

### DUGA_APP_ID と DUGA_AGENT_ID (DUGA API用)

DUGA APIクローラを使用する場合に必要です。

```bash
export DUGA_APP_ID="your-app-id"
export DUGA_AGENT_ID="your-agent-id"
```

### SOKMIL_API_KEY (SOKMIL API用)

SOKMIL APIクローラを使用する場合に必要です。

```bash
export SOKMIL_API_KEY="your-api-key"
```

## テスト対象クローラ

### DTI Sites (19サイト)

- ✅ 一本道 (1pondo)
- ✅ カリビアンコム (caribbeancom)
- ✅ カリビアンコムプレミアム (caribbeancompr)
- ✅ HEYZO
- ✅ 天然むすめ (10musume)
- ✅ パコパコママ (pacopacomama)
- ✅ 人妻斬り (hitozumagiri)
- ✅ エッチな0930 (av-e-body)
- ✅ エッチな4610 (av-4610)
- ✅ Hey動画 (heydouga)
- ✅ 金髪天國 (kin8tengoku)
- ✅ 女体のしんぴ (nyoshin)
- ✅ NOZOX
- ✅ エッチな0930WORLD
- ✅ エッチな0230
- ✅ うんこたれ (unkotare)
- ✅ 3D-EROS.NET
- ✅ Pikkur
- ✅ Javholic

**タイムアウト**: 300秒 (5分)
**特徴**: すべてDTI無修正テーブル (`uncensored_products`) に格納

### DUGA API

**必要な環境変数**: `DUGA_APP_ID`, `DUGA_AGENT_ID`
**タイムアウト**: 120秒 (2分)

### MGS

**スキップ理由**: 特定の製品URLが必要
**手動テスト**:

```bash
DATABASE_URL="..." npx tsx scripts/crawlers/crawl-mgs.ts "https://www.mgstage.com/product/product_detail/PRODUCT_ID/"
```

### SOKMIL API

**必要な環境変数**: `SOKMIL_API_KEY`
**タイムアウト**: 120秒 (2分)

### B10F CSV

**スキップ理由**: CSVファイルが必要
**手動テスト**:

```bash
DATABASE_URL="..." npx tsx scripts/crawlers/crawl-b10f-csv.ts path/to/data.csv
```

### Nakiny Analyzer

**スキップ理由**: 専用ツール(通常のクローラではない)

## テスト結果の解釈

### ✅ Pass (合格)

クローラが正常に動作し、エラーなく完了しました。

### ❌ Fail (失敗)

以下のいずれかの理由で失敗:

- タイムアウト (設定時間内に完了しなかった)
- 環境変数が未設定
- ネットワークエラー
- データベース接続エラー

### ⏭️ Skip (スキップ)

テストをスキップ:

- 特定のパラメータが必要 (MGS, B10F CSV)
- 通常のクローラではない (Nakiny Analyzer)

## データベース統計

テスト実行後、以下の統計が表示されます:

### Regular Products (通常商品)

ASP別の商品数とサムネイル有無

### Uncensored Products (無修正商品 - DTI)

DTI無修正テーブルの商品数

### Product Images (商品画像)

ASP別の画像付き商品数と総画像数

### Performers (演者)

総演者数と画像有無

## トラブルシューティング

### タイムアウトエラー

```
Error: Command timed out after 300000 milliseconds
```

**原因**: クローラの処理時間が長すぎる
**対策**:

- テスト対象の商品数を減らす (`--limit` パラメータ)
- タイムアウト時間を延長する (test-all-crawlers.ts を編集)

### 環境変数エラー

```
Error: DATABASE_URL must be set in environment variables
```

**原因**: 必要な環境変数が設定されていない
**対策**: 環境変数を設定してから再実行

### データベース接続エラー

```
Error: connect ECONNREFUSED
```

**原因**: データベースに接続できない
**対策**:

- DATABASE_URLが正しいか確認
- データベースが稼働しているか確認
- ネットワーク接続を確認

## 個別クローラのテスト

### DTI Sitesの個別テスト

```bash
DATABASE_URL="..." npx tsx scripts/crawlers/crawl-dti-sites.ts --site 1pondo --limit 5
```

### DUGA APIの個別テスト

```bash
DATABASE_URL="..." DUGA_APP_ID="..." DUGA_AGENT_ID="..." npx tsx scripts/crawlers/crawl-duga-api.ts --limit 10
```

### SOKMIL APIの個別テスト

```bash
DATABASE_URL="..." SOKMIL_API_KEY="..." npx tsx scripts/crawlers/crawl-sokmil-api.ts --limit 10
```

## 定期的なテスト

本番環境にデプロイする前に、必ずテストスクリプトを実行して全クローラが正常に動作することを確認してください。

```bash
# フルテスト
DATABASE_URL="..." \
DUGA_APP_ID="..." \
DUGA_AGENT_ID="..." \
SOKMIL_API_KEY="..." \
npx tsx scripts/test-all-crawlers.ts
```

## 改善履歴

### 2025-11-26

- DTI Sitesのタイムアウトを120秒から300秒に延長
- テストレポート機能を追加
- データベース統計表示機能を追加
- 環境変数設定ガイドを作成
