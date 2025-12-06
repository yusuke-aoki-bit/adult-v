# DTI Crawlers

DTI（Digital Turbine Inc.）グループのアダルト動画サイトをクロールするためのモジュール化されたクローラ群。

## 構造

```
scripts/crawlers/dti/
├── index.ts              # 統合エントリーポイント
├── crawl-1pondo.ts       # 一本道クローラ
├── crawl-caribbeancom.ts # カリビアンコムクローラ
├── crawl-caribbeancompr.ts # カリビアンコムプレミアムクローラ
├── crawl-heyzo.ts        # HEYZOクローラ
├── crawl-10musume.ts     # 天然むすめクローラ
├── crawl-pacopacomama.ts # パコパコママクローラ
├── crawl-hitozumagiri.ts # 人妻斬りクローラ
├── crawl-kin8tengoku.ts  # 金髪天國クローラ
├── crawl-ecchi-sites.ts  # エッチな系サイトクローラ
├── crawl-other-sites.ts  # その他サイトクローラ
└── README.md             # このファイル
```

## 使い方

### 統合クローラ（推奨）

```bash
# サイト一覧を表示
npx tsx scripts/crawlers/dti/index.ts --list

# 特定のサイトをクロール
npx tsx scripts/crawlers/dti/index.ts --site 1pondo --limit 50

# 全サイトをクロール
npx tsx scripts/crawlers/dti/index.ts --all --limit 10

# 優先度でフィルタリング
npx tsx scripts/crawlers/dti/index.ts --priority high --limit 20
```

### 個別クローラ

```bash
# 一本道
npx tsx scripts/crawlers/dti/crawl-1pondo.ts --limit 50

# カリビアンコム
npx tsx scripts/crawlers/dti/crawl-caribbeancom.ts --limit 50

# HEYZO
npx tsx scripts/crawlers/dti/crawl-heyzo.ts --start 0001 --limit 100

# エッチな系サイト
npx tsx scripts/crawlers/dti/crawl-ecchi-sites.ts --site 0930 --limit 50
npx tsx scripts/crawlers/dti/crawl-ecchi-sites.ts --site 4610 --limit 50
```

## オプション

| オプション | 説明 |
|-----------|------|
| `--site <name>` | クロールするサイト名 |
| `--start <id>` | 開始ID（例: `112024_001` or `0001`） |
| `--limit <n>` | 取得する商品数の上限 |
| `--no-ai` | AI機能（説明文生成、翻訳）を無効化 |
| `--all` | 全サイトをクロール |
| `--priority <level>` | 優先度でフィルタ（high/medium/low） |
| `--list` | 利用可能なサイト一覧を表示 |

## サイト一覧

### 高優先度（High Priority）
- `1pondo` - 一本道（JSON API対応）
- `caribbeancom` - カリビアンコム
- `caribbeancompr` - カリビアンコムプレミアム
- `heyzo` - HEYZO

### 中優先度（Medium Priority）
- `10musume` - 天然むすめ
- `pacopacomama` - パコパコママ
- `hitozumagiri` - 人妻斬り
- `kin8tengoku` - 金髪天國

### 低優先度（Low Priority）
- `0930` - エッチな0930
- `4610` - エッチな4610
- `0230` - エッチな0230
- `0930world` - エッチな0930WORLD
- `nozox` - NOZOX
- `3d-eros` - 3D-EROS.NET
- `pikkur` - Pikkur
- `javholic` - Javholic

## 共通ベースクラス

全クローラは `lib/providers/dti-base.ts` の共通ベースクラスを使用しています。

主な機能：
- エンコーディング自動検出（EUC-JP対応）
- 日付ベースのID生成
- gallery.zip からの画像抽出
- AI機能（説明文生成、タグ抽出、多言語翻訳）
- GCSへの生データ保存
- セール情報の検出・保存

## 開発

新しいサイトを追加する場合：

1. `DTIBaseCrawler` を継承したクローラクラスを作成
2. `parseHtmlContent` メソッドを実装
3. `index.ts` の `SITE_REGISTRY` に登録

```typescript
import { DTIBaseCrawler, DTISiteConfig, ParsedProductData } from '../../../lib/providers/dti-base';

const MY_SITE_CONFIG: DTISiteConfig = {
  siteName: 'MySite',
  siteId: '1234',
  baseUrl: 'https://www.mysite.com',
  urlPattern: 'https://www.mysite.com/moviepages/{id}/index.html',
  idFormat: 'MMDDYY_NNN',
  startId: '120624_001',
  endId: '010115_001',
  reverseMode: true,
  maxConcurrent: 3,
};

class MySiteCrawler extends DTIBaseCrawler {
  constructor() {
    super(MY_SITE_CONFIG);
  }

  async parseHtmlContent(html: string, productId: string): Promise<ParsedProductData | null> {
    // サイト固有の解析ロジック
  }
}
```
