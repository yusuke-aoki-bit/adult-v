import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const baseMetadata: Metadata = {
    title: '法的コンプライアンス | FANZA VIEWER LAB',
    description: 'FANZA VIEWER LABのアフィリエイトプログラム利用規約遵守状況と法的コンプライアンスについて',
  };

  if (locale !== 'ja') {
    return {
      ...baseMetadata,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  return baseMetadata;
}

export default function LegalCompliancePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">法的コンプライアンス</h1>
        <p className="text-gray-500 mb-8">Legal Compliance Report</p>

        <div className="bg-white rounded-lg p-6 md:p-8 space-y-8 text-gray-700 shadow-sm border border-gray-200">

          {/* 概要 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">概要</h2>
            <p className="leading-relaxed">
              当サイト（FANZA VIEWER LAB）は、DMM/FANZAアフィリエイトプログラムに参加し、
              利用規約および日本国法令を遵守してサービスを運営しています。
              本ページでは、当サイトの法的コンプライアンス状況を透明性をもって開示します。
            </p>
          </section>

          {/* DMM/FANZA について */}
          <section className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                準拠
              </span>
              <h2 className="text-xl font-semibold text-gray-900">DMM/FANZA アフィリエイト</h2>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">利用方法</h3>
                <p className="leading-relaxed">
                  DMMアフィリエイトプログラムに正式登録し、公式APIを使用して商品情報を取得しています。
                  アフィリエイトリンクは公式形式で生成し、規約に準拠しています。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">画像利用</h3>
                <p className="leading-relaxed">
                  商品画像はDMM APIから取得した公式素材を使用しています。
                  規約に基づき、キャプチャーではなく公式素材を使用し、無断加工は行っていません。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">参考資料</h3>
                <ul className="text-sm space-y-1">
                  <li>
                    <a href="https://affiliate.dmm.com/" target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-500 transition-colors">
                      DMM アフィリエイト公式サイト
                    </a>
                  </li>
                  <li>
                    <a href="https://affiliate.dmm.com/api/" target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-500 transition-colors">
                      DMM API 公式ドキュメント
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* スクレイピングについて */}
          <section className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                準拠
              </span>
              <h2 className="text-xl font-semibold text-gray-900">データ収集について</h2>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">法的根拠</h3>
                <p className="leading-relaxed">
                  日本においてWebスクレイピングを直接禁止する法律は存在しません。
                  著作権法30条の4（著作物に表現された思想又は感情の享受を目的としない利用）および
                  47条の5（電子計算機による情報処理及びその結果の提供に付随する軽微利用等）に基づき、
                  情報解析目的での収集は法的に許可されています。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">当サイトの対応</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>公開されている情報のみを収集</li>
                  <li>サーバーへの負荷を考慮したレート制限を実装</li>
                  <li>アフィリエイト目的での正当な利用</li>
                  <li>ID/パスワードで保護された領域へのアクセスは行わない</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">参考資料</h3>
                <ul className="text-sm space-y-1">
                  <li>
                    <a href="https://it-bengosi.com/blog/scraping/" target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-500 transition-colors">
                      スクレイピングの法律問題（弁護士解説）
                    </a>
                  </li>
                  <li>
                    <a href="https://topcourt-law.com/internet_security/scraping-illegal" target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-500 transition-colors">
                      スクレイピングは違法？3つの法律問題（トップコート国際法律事務所）
                    </a>
                  </li>
                  <li>
                    <a href="https://elaws.e-gov.go.jp/document?lawid=345AC0000000048" target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-500 transition-colors">
                      著作権法（e-Gov法令検索）
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 著作権表示 */}
          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">著作権・帰属表示</h2>

            <div className="space-y-3">
              <p className="leading-relaxed">
                当サイトに掲載されている商品画像、パッケージ画像、サンプル動画の著作権は、
                DMM.com LLCおよび各コンテンツプロバイダー・制作会社に帰属します。
              </p>

              <div className="bg-gray-100 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">画像・コンテンツ提供元</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>DMM.com LLC</li>
                  <li>各制作会社・メーカー</li>
                </ul>
              </div>
            </div>
          </section>

          {/* コンプライアンス評価サマリー */}
          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">コンプライアンス評価サマリー</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-500">項目</th>
                    <th className="text-left py-2 px-3 text-gray-500">評価</th>
                    <th className="text-left py-2 px-3 text-gray-500">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-2 px-3">DMM/FANZAアフィリエイト</td>
                    <td className="py-2 px-3">
                      <span className="text-green-600">準拠</span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">公式API使用</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">画像利用</td>
                    <td className="py-2 px-3">
                      <span className="text-green-600">準拠</span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">公式素材使用</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">データ収集</td>
                    <td className="py-2 px-3">
                      <span className="text-green-600">準拠</span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">著作権法例外規定適用</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">年齢確認</td>
                    <td className="py-2 px-3">
                      <span className="text-green-600">実装済</span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">18歳未満アクセス制限</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* お問い合わせ */}
          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">お問い合わせ</h2>
            <p className="leading-relaxed mb-3">
              本ページの内容に関するお問い合わせ、著作権に関するご連絡は以下までお願いいたします。
            </p>
            <p>
              <a
                href="mailto:adult.vvvv@gmail.com"
                className="text-pink-600 hover:text-pink-500 transition-colors"
              >
                adult.vvvv@gmail.com
              </a>
            </p>
          </section>

          <div className="pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              最終更新日: 2024年12月20日
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
