import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const baseMetadata: Metadata = {
    title: '法的コンプライアンス | ADULT VIEWER LAB',
    description: 'ADULT VIEWER LABのアフィリエイトプログラム利用規約遵守状況と法的コンプライアンスについて',
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
    <div className="min-h-screen theme-body py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-2">法的コンプライアンス</h1>
        <p className="text-gray-400 mb-8">Legal Compliance Report</p>

        <div className="bg-gray-800 rounded-lg p-6 md:p-8 space-y-8 text-gray-300">

          {/* 概要 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">概要</h2>
            <p className="leading-relaxed">
              当サイト（ADULT VIEWER LAB）は、複数のアフィリエイトプログラムに参加し、
              各プラットフォームの利用規約および日本国法令を遵守してサービスを運営しています。
              本ページでは、当サイトの法的コンプライアンス状況を透明性をもって開示します。
            </p>
          </section>

          {/* DMM/FANZA について */}
          <section className="border-t border-gray-700 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">
                未提携
              </span>
              <h2 className="text-xl font-semibold text-white">DMM/FANZA</h2>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">現在の状況</h3>
                <p className="leading-relaxed">
                  当サイトは現時点でDMM/FANZAアフィリエイトプログラムに<strong className="text-white">未提携</strong>です。
                  DMM APIは使用しておらず、アフィリエイトリンクも生成していません。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">今後の予定</h3>
                <p className="leading-relaxed">
                  DMMアフィリエイトへの登録申請を予定しています。
                  承認後は、公式APIを使用した正規の方法で商品情報を取得し、
                  規約に準拠した形でサービスを提供する予定です。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">参考資料</h3>
                <ul className="text-sm space-y-1">
                  <li>
                    <a href="https://affiliate.dmm.com/" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 transition-colors">
                      DMM アフィリエイト公式サイト
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* DUGA アフィリエイト */}
          <section className="border-t border-gray-700 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                準拠
              </span>
              <h2 className="text-xl font-semibold text-white">DUGA (APEX) アフィリエイト</h2>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">利用方法</h3>
                <p className="leading-relaxed">
                  APEXアフィリエイトプログラムに正式登録し、提供されたアフィリエイトIDを使用しています。
                  商品リンクは click.duga.jp 経由の公式形式で生成しています。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">画像利用</h3>
                <p className="leading-relaxed">
                  公式サンプル画像をダウンロードして使用。
                  規約に基づき、キャプチャーではなく公式素材を使用し、加工は行っていません。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">参考資料</h3>
                <ul className="text-sm space-y-1">
                  <li>
                    <a href="https://www.duga.jp/affiliate/" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 transition-colors">
                      DUGA アフィリエイト公式
                    </a>
                  </li>
                  <li>
                    <a href="https://adabizu.com/duga-affiliate/" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 transition-colors">
                      DUGAアフィリエイトの始め方（参考）
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* MGS アフィリエイト */}
          <section className="border-t border-gray-700 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                準拠
              </span>
              <h2 className="text-xl font-semibold text-white">MGS アフィリエイト</h2>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">利用方法</h3>
                <p className="leading-relaxed">
                  MGSアフィリエイトプログラムに正式登録し、公式提供のウィジェット機能を使用しています。
                  商品ページからのみアフィリエイトリンクを生成し、規約に準拠しています。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">画像・動画利用</h3>
                <p className="leading-relaxed">
                  サンプル動画・画像は公式提供素材を使用。
                  規約に基づき、縮小・拡大以外の加工は行っていません。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">参考資料</h3>
                <ul className="text-sm space-y-1">
                  <li>
                    <a href="https://www.mgstage.com/affiliate_exp/" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 transition-colors">
                      MGS アフィリエイト公式
                    </a>
                  </li>
                  <li>
                    <a href="https://exad.jp/contents.php?c=chlucvkisdn" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 transition-colors">
                      MGSアフィリエイトの始め方（参考）
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* DTI アフィリエイト */}
          <section className="border-t border-gray-700 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                準拠
              </span>
              <h2 className="text-xl font-semibold text-white">DTI CASH アフィリエイト</h2>
            </div>
            <p className="text-sm text-gray-400 mb-3">（カリビアンコム、一本道、HEYZO等）</p>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">利用方法</h3>
                <p className="leading-relaxed">
                  DTI CASHアフィリエイトプログラムに正式登録し、公式提供のアフィリエイトリンク形式を使用しています。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">法的対応（重要）</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="leading-relaxed mb-2">
                    <strong className="text-white">日本国内法令への対応:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>日本サーバーへの無修正画像のアップロードは行っていません</li>
                    <li>サムネイル画像には<strong className="text-white">ぼかし処理（blur）</strong>を適用しています</li>
                    <li>画像は外部サーバー（各プラットフォーム）から直接参照しています</li>
                    <li>刑法175条（わいせつ物頒布等）に抵触しないよう配慮しています</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">参考資料</h3>
                <ul className="text-sm space-y-1">
                  <li>
                    <a href="https://www.dti.ne.jp/partner/" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 transition-colors">
                      DTI CASH 公式サイト
                    </a>
                  </li>
                  <li>
                    <a href="https://afifree.net/affiliate-dti/" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 transition-colors">
                      DTI CASHとは？（参考）
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* スクレイピングについて */}
          <section className="border-t border-gray-700 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                準拠
              </span>
              <h2 className="text-xl font-semibold text-white">データ収集について</h2>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">法的根拠</h3>
                <p className="leading-relaxed">
                  日本においてWebスクレイピングを直接禁止する法律は存在しません。
                  著作権法30条の4（著作物に表現された思想又は感情の享受を目的としない利用）および
                  47条の5（電子計算機による情報処理及びその結果の提供に付随する軽微利用等）に基づき、
                  情報解析目的での収集は法的に許可されています。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">当サイトの対応</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>公開されている情報のみを収集</li>
                  <li>サーバーへの負荷を考慮したレート制限を実装</li>
                  <li>アフィリエイト目的での正当な利用</li>
                  <li>ID/パスワードで保護された領域へのアクセスは行わない</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">参考資料</h3>
                <ul className="text-sm space-y-1">
                  <li>
                    <a href="https://it-bengosi.com/blog/scraping/" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 transition-colors">
                      スクレイピングの法律問題（弁護士解説）
                    </a>
                  </li>
                  <li>
                    <a href="https://topcourt-law.com/internet_security/scraping-illegal" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 transition-colors">
                      スクレイピングは違法？3つの法律問題（トップコート国際法律事務所）
                    </a>
                  </li>
                  <li>
                    <a href="https://elaws.e-gov.go.jp/document?lawid=345AC0000000048" target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-300 transition-colors">
                      著作権法（e-Gov法令検索）
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 著作権表示 */}
          <section className="border-t border-gray-700 pt-6">
            <h2 className="text-xl font-semibold text-white mb-3">著作権・帰属表示</h2>

            <div className="space-y-3">
              <p className="leading-relaxed">
                当サイトに掲載されている商品画像、パッケージ画像、サンプル動画の著作権は、
                各コンテンツプロバイダーおよび制作会社に帰属します。
              </p>

              <div className="bg-gray-900 rounded-lg p-4">
                <h3 className="text-sm font-medium text-white mb-2">画像・コンテンツ提供元</h3>
                <ul className="text-sm space-y-1 text-gray-400">
                  <li>DMM.com LLC</li>
                  <li>DUGA / APEX</li>
                  <li>MGS動画</li>
                  <li>DTI Services, Inc.</li>
                  <li>各制作会社・メーカー</li>
                </ul>
              </div>
            </div>
          </section>

          {/* コンプライアンス評価サマリー */}
          <section className="border-t border-gray-700 pt-6">
            <h2 className="text-xl font-semibold text-white mb-4">コンプライアンス評価サマリー</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-400">項目</th>
                    <th className="text-left py-2 px-3 text-gray-400">評価</th>
                    <th className="text-left py-2 px-3 text-gray-400">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  <tr>
                    <td className="py-2 px-3">DMM/FANZA</td>
                    <td className="py-2 px-3">
                      <span className="text-yellow-400">未提携</span>
                    </td>
                    <td className="py-2 px-3 text-gray-400">申請予定</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">DUGA画像利用</td>
                    <td className="py-2 px-3">
                      <span className="text-green-400">準拠</span>
                    </td>
                    <td className="py-2 px-3 text-gray-400">公式サンプル使用</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">MGSウィジェット</td>
                    <td className="py-2 px-3">
                      <span className="text-green-400">準拠</span>
                    </td>
                    <td className="py-2 px-3 text-gray-400">公式提供機能</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">DTI画像（無修正対応）</td>
                    <td className="py-2 px-3">
                      <span className="text-green-400">準拠</span>
                    </td>
                    <td className="py-2 px-3 text-gray-400">ぼかし処理＋外部参照</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">データ収集</td>
                    <td className="py-2 px-3">
                      <span className="text-green-400">準拠</span>
                    </td>
                    <td className="py-2 px-3 text-gray-400">著作権法例外規定適用</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">年齢確認</td>
                    <td className="py-2 px-3">
                      <span className="text-green-400">実装済</span>
                    </td>
                    <td className="py-2 px-3 text-gray-400">18歳未満アクセス制限</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* お問い合わせ */}
          <section className="border-t border-gray-700 pt-6">
            <h2 className="text-xl font-semibold text-white mb-3">お問い合わせ</h2>
            <p className="leading-relaxed mb-3">
              本ページの内容に関するお問い合わせ、著作権に関するご連絡は以下までお願いいたします。
            </p>
            <p>
              <a
                href="mailto:adult.vvvv@gmail.com"
                className="text-rose-400 hover:text-rose-300 transition-colors"
              >
                adult.vvvv@gmail.com
              </a>
            </p>
          </section>

          <div className="pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              最終更新日: 2024年12月19日
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
