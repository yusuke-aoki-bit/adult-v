# Google Cloud Translation API セットアップガイド

このドキュメントでは、Google Cloud Translation APIを使用してデータベースの多言語翻訳を行うための設定手順を説明します。

## 前提条件

- Google Cloud Platform (GCP) アカウント
- 請求先アカウントが有効化されていること

## 1. Google Cloud Consoleでの設定

### 1.1 Translation APIの有効化

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを選択または新規作成
3. 「APIとサービス」→「ライブラリ」に移動
4. "Cloud Translation API"を検索
5. 「有効にする」をクリック

### 1.2 サービスアカウントの作成

1. 「APIとサービス」→「認証情報」に移動
2. 「認証情報を作成」→「サービスアカウント」を選択
3. サービスアカウント名を入力(例: `translation-service`)
4. 役割に「Cloud Translation API ユーザー」を追加
5. 「完了」をクリック

### 1.3 サービスアカウントキーの作成

1. 作成したサービスアカウントをクリック
2. 「キー」タブに移動
3. 「鍵を追加」→「新しい鍵を作成」
4. キーのタイプは「JSON」を選択
5. 「作成」をクリックしてJSONファイルをダウンロード

## 2. 環境変数の設定

### 方法A: サービスアカウントキーファイルを使用 (推奨)

ダウンロードしたJSONファイルのパスを環境変数に設定します:

```bash
# Linux/Mac
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your-service-account-key.json"

# Windows (PowerShell)
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your-service-account-key.json"

# Windows (コマンドプロンプト)
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your-service-account-key.json
```

### 方法B: 環境変数に直接設定

JSONファイルの内容から以下の情報を抽出して環境変数に設定します:

```bash
# .env.local に追加
GOOGLE_CLOUD_PROJECT_ID="your-project-id"
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLOUD_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
```

**注意**: プライベートキーの改行は `\n` として記述してください。

## 3. パッケージのインストール

プロジェクトに必要なパッケージがインストールされていることを確認:

```bash
npm install @google-cloud/translate
```

## 4. 翻訳スクリプトの実行

### 4.1 ドライラン(確認のみ)

実際にデータベースを更新せず、翻訳のテストを行います:

```bash
DATABASE_URL="your-database-url" npx tsx scripts/translate-database.ts --table products --limit 5 --dry-run
```

### 4.2 本番実行

#### Products テーブルの翻訳

```bash
DATABASE_URL="your-database-url" npx tsx scripts/translate-database.ts --table products --limit 100
```

#### Performers テーブルの翻訳

```bash
DATABASE_URL="your-database-url" npx tsx scripts/translate-database.ts --table performers --limit 100
```

#### Tags テーブルの翻訳

```bash
DATABASE_URL="your-database-url" npx tsx scripts/translate-database.ts --table tags --limit 100
```

#### すべてのテーブルを翻訳

```bash
DATABASE_URL="your-database-url" npx tsx scripts/translate-database.ts --table all --limit 1000
```

### スクリプトオプション

- `--table <table>` : 翻訳するテーブル (`products`, `performers`, `tags`, `all`)
- `--limit <number>` : 処理する最大レコード数 (デフォルト: 100)
- `--offset <number>` : 開始位置 (デフォルト: 0)
- `--batch-size <number>` : バッチサイズ (デフォルト: 10)
- `--dry-run` : 実際には更新せず確認のみ

### 大量データの翻訳

大量のデータを翻訳する場合は、オフセットを使用してバッチ処理を行います:

```bash
# 最初の1000件
DATABASE_URL="..." npx tsx scripts/translate-database.ts --table products --limit 1000 --offset 0

# 次の1000件
DATABASE_URL="..." npx tsx scripts/translate-database.ts --table products --limit 1000 --offset 1000

# さらに次の1000件
DATABASE_URL="..." npx tsx scripts/translate-database.ts --table products --limit 1000 --offset 2000
```

## 5. 料金について

Google Cloud Translation APIの料金:

- 文字数ベースの課金
- 月次利用量に応じた階層料金
- 最新の料金は[公式サイト](https://cloud.google.com/translate/pricing)を参照

### コスト最適化のヒント

1. **バッチ処理を利用**: 複数のテキストを一度に翻訳することでAPI呼び出し回数を削減
2. **キャッシュの活用**: 同じテキストを複数回翻訳しない
3. **レート制限対策**: スクリプトには自動的に遅延が組み込まれています
4. **段階的な実行**: 大量のデータは少しずつ翻訳

## 6. トラブルシューティング

### エラー: "Google Cloud Translation API credentials not found"

環境変数が正しく設定されているか確認してください:

```bash
# Linux/Mac
echo $GOOGLE_APPLICATION_CREDENTIALS

# Windows (PowerShell)
echo $env:GOOGLE_APPLICATION_CREDENTIALS
```

### エラー: "Translation quota exceeded"

APIの利用量制限に達した可能性があります。Google Cloud Consoleでクォータを確認してください。

### エラー: "Permission denied"

サービスアカウントに適切な権限(Cloud Translation API ユーザー)が付与されているか確認してください。

## 7. 本番環境への適用

### Google Cloud Run での設定

1. Secret Manager にサービスアカウントキーを保存
2. Cloud Run サービスの環境変数に設定:
   ```
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_CLOUD_PRIVATE_KEY=... (Secret Manager から取得)
   GOOGLE_CLOUD_CLIENT_EMAIL=...
   ```

### Cloud Scheduler での定期実行

定期的に新しいデータを翻訳する場合、Cloud Schedulerでジョブを設定:

```bash
gcloud scheduler jobs create http translate-job \
  --schedule="0 2 * * *" \
  --uri="https://your-app.run.app/api/translate" \
  --http-method=POST
```

## 参考リンク

- [Google Cloud Translation API ドキュメント](https://cloud.google.com/translate/docs)
- [Node.js クライアントライブラリ](https://cloud.google.com/nodejs/docs/reference/translate/latest)
- [料金](https://cloud.google.com/translate/pricing)
- [クォータと制限](https://cloud.google.com/translate/quotas)
