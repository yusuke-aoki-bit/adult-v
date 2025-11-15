# Adult Viewer Lab

ヘビー視聴者向けに DMM / APEX / SOKMIL / DTI の4つのアダルト配信プラットフォームを横断し、
女優ベースで作品レビュー・ランキング・キャンペーン速報をまとめるアフィリエイトサイトです。

## 特徴

- 👩‍🎤 **女優図鑑**: 女優ごとの出演傾向・対応サービス・指名データを網羅
- 🏅 **ジャンル／ランキング**: 検索意図に合わせたジャンル別ページと週次ランキング
- 📝 **作品レビュー**: プロバイダ横断のレビューカードで比較を可視化
- 🚨 **キャンペーン速報**: DMM / APEX / SOKMIL / DTI の最新割引・サブスク情報を集約
- 🔗 **アフィリエイト対応**: 各サービスのリンク生成をカスタム可能（`lib/affiliate.ts`）

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **デプロイ**: Vercel（推奨）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、DMMアフィリエイトIDを設定してください。

```bash
cp .env.local.example .env.local
```

`.env.local` を編集：

```
NEXT_PUBLIC_DMM_AFFILIATE_ID=あなたのアフィリエイトID
NEXT_PUBLIC_DMM_AFFILIATE_SITE_ID=あなたのサイトID
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## ディレクトリ構成

```
adult-v/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # ルートレイアウト
│   ├── page.tsx            # ホームページ
│   ├── categories/         # カテゴリ一覧ページ
│   ├── featured/           # おすすめ商品ページ
│   ├── new/                # 新着商品ページ
│   └── product/[id]/       # 商品詳細ページ
├── components/             # Reactコンポーネント
│   ├── Header.tsx          # ヘッダー
│   ├── Footer.tsx          # フッター
│   └── ProductCard.tsx     # 商品カード
├── lib/                    # ユーティリティ関数
│   ├── affiliate.ts        # アフィリエイトリンク生成
│   ├── categories.ts       # カテゴリ定義
│   └── mockData.ts         # サンプルデータ
└── types/                  # TypeScript型定義
    └── product.ts          # 商品型定義
```

## アフィリエイトの設定

### 1. アフィリエイト登録

それぞれのプラットフォームでアフィリエイト登録を完了し、ID/サイトIDを取得してください。

- [DMMアフィリエイト](https://affiliate.dmm.com/)
- [APEXアフィリエイト](https://www.apex-pictures.com/affiliate/)
- [SOKMILアフィリエイト](https://www.sokmil.com/affiliate/)
- [DTI/ISP ASP](https://dream.jp/asp/)

### 2. アフィリエイトリンクの設定

`lib/affiliate.ts` で各サービスごとのリンク生成ロジックをカスタマイズできます。

```typescript
export function generateDMMLink(params: DMMAffiliateLinkParams): string {
  // DMMの仕様に合わせてリンクを生成
}
```

### 3. 商品データの更新

`lib/mockData.ts` のサンプルデータを、各配信サービスの実データに置き換えてください。
本番運用では、各社のAPIやCSVを取り込んで動的に更新することを推奨します。

## カスタマイズ

### 商品データの追加

`lib/mockData.ts` に新しい商品を追加：

```typescript
{
  id: 'unique-id',
  title: '商品名',
  description: '商品説明',
  price: 1000,
  category: 'ebook',
  imageUrl: '画像URL',
  affiliateUrl: 'アフィリエイトURL',
  rating: 4.5,
  reviewCount: 100,
  tags: ['タグ1', 'タグ2'],
  isFeatured: true,
}
```

### カテゴリの追加

`lib/categories.ts` で新しいカテゴリを定義できます。

### デザインのカスタマイズ

Tailwind CSSを使用しているため、各コンポーネントのクラス名を編集するだけで簡単にデザインを変更できます。

## デプロイ

### Vercelへのデプロイ（推奨）

1. [Vercel](https://vercel.com)にアカウントを作成
2. GitHubリポジトリと連携
3. 環境変数を設定
4. デプロイ

```bash
# Vercel CLIを使用する場合
npm install -g vercel
vercel
```

### その他のホスティング

Next.jsは様々なプラットフォームにデプロイ可能です：

- Netlify
- AWS Amplify
- Google Cloud Run
- 自前サーバー（Node.js）

## ビルド

```bash
npm run build
npm run start
```

## ライセンス

MIT License

## 注意事項

- 本サイトは DMM / APEX / SOKMIL / DTI のアフィリエイトプログラムを利用します
- 各プログラムの利用規約・年齢確認ポリシーを遵守してください
- 作品・キャンペーン情報は定期的に更新してください
- プライバシーポリシーおよび年齢確認の導線を明記してください

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
