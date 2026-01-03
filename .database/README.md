# DataBase Client 拡張機能 - Google Cloud SQL 接続設定

このディレクトリには、DataBase Client拡張機能用のデータベース接続設定が含まれています。

## プロジェクト情報

- **プロジェクトID**: `adult-v`
- **リージョン**: `asia-east1`
- **データベース**: PostgreSQL
- **認証情報ファイル**: `adult-v-d8a2b1c2c90f.json` (プロジェクトルート)

## 接続方法

Google Cloud SQLに接続するには、以下の2つの方法があります：

### 1. Cloud SQL Proxy経由（推奨）

ローカル開発環境では、Cloud SQL Proxyを使用することを強く推奨します。

#### セットアップ手順

1. **Cloud SQL Proxyをインストール**
   ```bash
   # Windows (PowerShell)
   (New-Object Net.WebClient).DownloadFile("https://dl.google.com/cloudsql/cloud_sql_proxy_x64.exe", "$env:USERPROFILE\cloud_sql_proxy.exe")
   
   # Linux/Mac
   curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
   chmod +x cloud_sql_proxy
   ```

2. **認証情報を設定**
   - Google Cloud Consoleからサービスアカウントキーをダウンロード
   - 環境変数を設定：
     ```bash
     export GOOGLE_APPLICATION_CREDENTIALS="path/to/your-service-account-key.json"
     ```

3. **認証情報ファイルを設定**
   - プロジェクトルートの `adult-v-d8a2b1c2c90f.json` を使用するか、新しいサービスアカウントキーをダウンロード
   - 環境変数を設定：
     ```bash
     # Windows (PowerShell)
     $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\yuuku\cursor\adult-v\adult-v-d8a2b1c2c90f.json"
     
     # Linux/Mac/WSL
     export GOOGLE_APPLICATION_CREDENTIALS="./adult-v-d8a2b1c2c90f.json"
     ```

4. **Cloud SQL Proxyを起動**
   ```bash
   # プロジェクト情報: adult-v (リージョン: asia-east1)
   # インスタンス接続名を指定（例: adult-v:asia-east1:INSTANCE_NAME）
   # Windows
   cloud_sql_proxy.exe -instances=adult-v:asia-east1:INSTANCE_NAME=tcp:5432
   
   # Linux/Mac/WSL
   ./cloud_sql_proxy -instances=adult-v:asia-east1:INSTANCE_NAME=tcp:5432
   ```
   
   **注意**: `INSTANCE_NAME` は実際のCloud SQLインスタンス名に置き換えてください。
   Cloud SQLインスタンス名を確認するには：
   ```bash
   gcloud sql instances list --project=adult-v
   ```

5. **DataBase Clientで接続**
   - `.database/connections.json` の `google-cloud-sql` 設定を使用
   - Host: `localhost`
   - Port: `5432` (またはプロキシで指定したポート)
   - Database, Username, Passwordを実際の値に置き換え

### 2. パブリックIP経由（直接接続）

#### 前提条件
- Cloud SQLインスタンスにパブリックIPが設定されていること
- 接続元のIPアドレスが許可リストに追加されていること
- SSL証明書が必要な場合がある

#### 設定手順

1. **Cloud SQLインスタンスのパブリックIPを確認**
   - Google Cloud Console > SQL > インスタンス > 接続 > ネットワーク設定

2. **IPアドレスを許可**
   - 承認済みネットワークに現在のIPアドレスを追加

3. **DataBase Clientで接続**
   - `.database/connections.json` の `google-cloud-sql-direct` 設定を使用
   - Host: インスタンスのパブリックIPアドレス
   - Port: `5432`
   - Database, Username, Passwordを実際の値に置き換え
   - SSL設定を必要に応じて調整

## 設定ファイルの編集

`.database/connections.json` ファイルを編集して、実際の接続情報を設定してください：

- `database`: データベース名
- `username`: データベースユーザー名
- `password`: データベースパスワード
- `host`: ホスト名またはIPアドレス
- `port`: ポート番号（通常5432）

## セキュリティに関する注意事項

- **パスワードをGitにコミットしないでください**
- `.database/connections.json` を `.gitignore` に追加することを推奨します
- 本番環境の認証情報は使用しないでください

## トラブルシューティング

### 接続できない場合

1. **Cloud SQL Proxyを使用している場合**
   - プロキシが正しく起動しているか確認
   - インスタンス接続名が正しいか確認
   - ファイアウォール設定を確認

2. **パブリックIP経由の場合**
   - IPアドレスが許可リストに追加されているか確認
   - SSL設定が正しいか確認
   - ネットワーク接続を確認

### SSL証明書エラー

パブリックIP経由で接続する場合、SSL証明書が必要な場合があります。
`ssl.rejectUnauthorized` を `false` に設定することで、証明書検証をスキップできます（開発環境のみ）。
