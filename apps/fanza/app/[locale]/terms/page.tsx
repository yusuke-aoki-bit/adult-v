import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const baseMetadata: Metadata = {
    title: '利用規約 | ADULT VIEWER LAB',
    description: 'ADULT VIEWER LABの利用規約ページです。',
  };

  // 日本語以外のロケールはnoindex（法的文書は日本語のみ正式版）
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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">利用規約</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 space-y-6 text-gray-600">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. 適用範囲</h2>
            <p className="leading-relaxed">
              本利用規約（以下「本規約」）は、ADULT VIEWER LAB（以下「当サイト」）が提供する
              サービスの利用に関する条件を定めるものです。
              当サイトをご利用いただくことで、本規約に同意したものとみなされます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. 年齢制限</h2>
            <p className="leading-relaxed">
              当サイトは18歳未満の方の利用を禁止しています。
              18歳未満の方が当サイトを利用することによって生じた損害について、
              当サイトは一切の責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. サービス内容</h2>
            <p className="leading-relaxed">
              当サイトは、複数のアダルトコンテンツプラットフォームの
              情報を整理し、ユーザーに提供するサービスです。
              当サイトは情報提供のみを目的としており、
              コンテンツの販売や配信は行っておりません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. アフィリエイトについて</h2>
            <p className="leading-relaxed">
              当サイトは複数のアフィリエイトプログラムに参加しており、
              商品リンクから購入された場合、当サイトに紹介料が発生することがあります。
              ただし、アフィリエイトリンクの使用によって、
              ユーザーに追加料金が発生することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. 著作権・知的財産権</h2>
            <p className="leading-relaxed">
              当サイトに掲載されているコンテンツ（テキスト、画像、デザインなど）の著作権は、
              当サイトまたは各権利者に帰属します。
              商品画像、女優写真などは各プラットフォームから提供されたものであり、
              それらの著作権は各権利者に帰属します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. 著作権侵害の申告（DMCA）</h2>
            <p className="leading-relaxed mb-3">
              当サイトは著作権を尊重しており、デジタルミレニアム著作権法（DMCA）に基づく
              著作権侵害の申告に対応いたします。
              著作権侵害があると思われるコンテンツを発見された場合は、
              以下の情報を含めて当サイトまでご連絡ください:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4 mb-3">
              <li>著作権者または代理人の署名（電子署名可）</li>
              <li>侵害されたと主張する著作物の特定</li>
              <li>侵害コンテンツの場所（URL）</li>
              <li>連絡先情報（住所、電話番号、メールアドレス）</li>
              <li>善意に基づき、当該使用が著作権者により許可されていないと信じる旨の声明</li>
              <li>偽証罪の制裁のもと、申告内容が正確であることの声明</li>
            </ul>
            <p className="leading-relaxed">
              DMCA申告先: <a href="mailto:adult.vvvv@gmail.com" className="text-rose-700 hover:text-rose-800 transition-colors">adult.vvvv@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. 禁止事項</h2>
            <p className="leading-relaxed mb-3">
              ユーザーは、以下の行為を行ってはなりません:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>当サイトのサーバーやネットワークの機能を破壊したり、妨害したりする行為</li>
              <li>当サイトのサービスの運営を妨害する行為</li>
              <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
              <li>不正アクセス行為</li>
              <li>当サイトのコンテンツを無断で複製、転載、配布する行為</li>
              <li>その他、当サイトが不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. 免責事項</h2>
            <p className="leading-relaxed">
              当サイトは、提供する情報の正確性、完全性、有用性について保証するものではありません。
              当サイトの利用により生じた損害について、当サイトは一切の責任を負いません。
              また、当サイトは外部サイトへのリンクを含んでいますが、
              リンク先のサイトの内容については責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">9. サービスの変更・中断・終了</h2>
            <p className="leading-relaxed">
              当サイトは、ユーザーへの事前の通知なく、
              サービスの内容を変更、中断、または終了することができるものとします。
              これによりユーザーに生じた損害について、当サイトは一切の責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">10. 利用規約の変更</h2>
            <p className="leading-relaxed">
              当サイトは、必要に応じて本規約を変更することができるものとします。
              変更後の規約は、本ページに掲載した時点で効力を生じるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">11. 準拠法・裁判管轄</h2>
            <p className="leading-relaxed">
              本規約の解釈にあたっては、日本法を準拠法とします。
              当サイトに関して紛争が生じた場合には、
              当サイト運営者の所在地を管轄する裁判所を専属的合意管轄とします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">12. お問い合わせ</h2>
            <p className="leading-relaxed">
              本規約に関するお問い合わせは、以下のメールアドレスまでお願いいたします。
            </p>
            <p className="mt-2">
              <a
                href="mailto:adult.vvvv@gmail.com"
                className="text-rose-700 hover:text-rose-800 transition-colors"
              >
                adult.vvvv@gmail.com
              </a>
            </p>
          </section>

          <div className="pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              最終更新日: 2024年12月9日
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
