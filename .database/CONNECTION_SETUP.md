# Google Cloud SQL接続セットアップガイド

このプロジェクト（`adult-v`）のGoogle Cloud SQLデータベースにDataBase Client拡張機能で接続するための手順です。

## 必要な情報

接続前に以下の情報を確認してください：

1. **Cloud SQLインスタンス名**
   ```bash
   gcloud sql instances list --project=adult-v
   ```

2. **データベース名、ユーザー名、パスワード**
   - Google Cloud Console > SQL > インスタンス > データベース/ユーザー で確認
   - または、既存の `DATABASE_URL` 環境変数から取得

## 接続方法1: Cloud SQL Proxy経由（推奨）

### ステップ1: Cloud SQL Proxyのインストール

**Windows:**
```powershell
# PowerShellで実行
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/cloudsql/cloud_sql_proxy_x64.exe", "$env:USERPROFILE\cloud_sql_proxy.exe")
```

**WSL/Linux/Mac:**
```bash
curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud_sql_proxy
```

### ステップ2: 認証情報の設定

プロジェクトルートにある `adult-v-d8a2b1c2c90f.json` を使用します。

**Windows (PowerShell):**
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\yuuku\cursor\adult-v\adult-v-d8a2b1c2c90f.json"
```

**WSL/Linux/Mac:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./adult-v-d8a2b1c2c90f.json"
```

### ステップ3: Cloud SQL Proxyの起動

**Windows:**
```powershell
# インスタンス名を実際の名前に置き換えてください
$env:USERPROFILE\cloud_sql_proxy.exe -instances=adult-v:asia-east1:INSTANCE_NAME=tcp:5432
```

**WSL/Linux/Mac:**
```bash
./cloud_sql_proxy -instances=adult-v:asia-east1:INSTANCE_NAME=tcp:5432
```

**注意**: `INSTANCE_NAME` は実際のCloud SQLインスタンス名に置き換えてください。

### ステップ4: DataBase Clientで接続

1. `.database/connections.json` を開く
2. `google-cloud-sql` 接続設定を編集：
   - `host`: `localhost`（そのまま）
   - `port`: `5432`（そのまま）
   - `database`: 実際のデータベース名
   - `username`: 実際のユーザー名
   - `password`: 実際のパスワード
3. DataBase Client拡張機能で接続をテスト

## 接続方法2: パブリックIP経由

### 前提条件

- Cloud SQLインスタンスにパブリックIPが設定されている
- 接続元のIPアドレスが承認済みネットワークに追加されている

### ステップ1: パブリックIPの確認

Google Cloud Console > SQL > インスタンス > 接続 > ネットワーク設定 で確認

### ステップ2: IPアドレスの許可

1. Google Cloud Console > SQL > インスタンス > 接続 > ネットワーク
2. 「承認済みネットワーク」に現在のIPアドレスを追加

### ステップ3: DataBase Clientで接続

1. `.database/connections.json` を開く
2. `google-cloud-sql-direct` 接続設定を編集：
   - `host`: インスタンスのパブリックIPアドレス
   - `port`: `5432`
   - `database`: 実際のデータベース名
   - `username`: 実際のユーザー名
   - `password`: 実際のパスワード
   - `ssl.mode`: `require`（本番環境の場合）

## DATABASE_URLから接続情報を取得する方法

既に `DATABASE_URL` 環境変数が設定されている場合、そこから接続情報を抽出できます：

```bash
# DATABASE_URLの形式: postgresql://username:password@host:port/database
# 例: postgresql://myuser:mypass@localhost:5432/mydb

# 環境変数を確認
echo $DATABASE_URL  # Linux/Mac/WSL
echo $env:DATABASE_URL  # Windows PowerShell
```

URLをパースして、以下の情報を取得：
- `username`: URLの `://` と `:` の間
- `password`: 最初の `:` と `@` の間
- `host`: `@` と `:` の間（または `/` の前）
- `port`: `:` と `/` の間（デフォルト: 5432）
- `database`: 最後の `/` の後

## トラブルシューティング

### 接続エラーが発生する場合

1. **Cloud SQL Proxyが起動しているか確認**
   - 別のターミナルでプロキシが実行中か確認
   - エラーメッセージを確認

2. **認証情報が正しいか確認**
   - `GOOGLE_APPLICATION_CREDENTIALS` 環境変数が正しく設定されているか
   - サービスアカウントにCloud SQL Client権限があるか

3. **インスタンス名が正しいか確認**
   ```bash
   gcloud sql instances list --project=adult-v
   ```

4. **ファイアウォール設定を確認**
   - ローカルファイアウォールがポート5432をブロックしていないか

### SSL証明書エラー

パブリックIP経由で接続する場合、`ssl.rejectUnauthorized` を `false` に設定することで開発環境での接続が可能です（本番環境では推奨しません）。

## 参考リンク

- [Cloud SQL Proxy ドキュメント](https://cloud.google.com/sql/docs/postgres/sql-proxy)
- [DataBase Client 拡張機能](https://marketplace.visualstudio.com/items?itemName=wechat-fe-vscode-extensions.database-client)
