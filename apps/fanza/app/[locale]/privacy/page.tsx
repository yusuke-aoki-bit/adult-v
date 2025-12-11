import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const baseMetadata: Metadata = {
    title: 'プライバシーポリシー | ADULT VIEWER LAB',
    description: 'ADULT VIEWER LABのプライバシーポリシーページです。',
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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">プライバシーポリシー</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 space-y-6 text-gray-600">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. 個人情報の取得について</h2>
            <p className="leading-relaxed">
              当サイトでは、ユーザーの個人情報を取得することはありません。
              お問い合わせの際にメールアドレスを使用いただく場合がありますが、
              それ以外の個人情報を収集することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Cookieの使用について</h2>
            <p className="leading-relaxed">
              当サイトでは、ユーザー体験の向上のためにCookieを使用しています。
              Cookieは年齢確認やお気に入り機能などのサイト機能に使用されます。
              ブラウザの設定でCookieを無効にすることも可能ですが、
              一部の機能が正常に動作しない場合があります。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. アクセス解析ツールについて</h2>
            <p className="leading-relaxed">
              当サイトでは、サイトの利用状況を把握するため、
              Google Analytics 4（GA4）を使用しています。
              GA4はCookieを使用してユーザーの行動を匿名で収集します。
            </p>
            <p className="leading-relaxed mt-2">
              収集される情報には、訪問したページ、滞在時間、使用デバイス、
              おおよその地域などが含まれますが、個人を特定できる情報は含まれません。
              また、IPアドレスは匿名化されています。
            </p>
            <p className="leading-relaxed mt-2">
              当サイトでは、GDPR/CCPAに準拠するため、Cookie同意バナーを表示しています。
              ユーザーが「同意する」を選択した場合のみ、GA4が有効になります。
              「拒否する」を選択した場合、GA4のトラッキングは行われません。
            </p>
            <p className="leading-relaxed mt-2">
              Google Analyticsの詳細については、
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-700 hover:text-rose-800 underline"
              >
                Googleのプライバシーポリシー
              </a>
              をご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. アフィリエイトプログラムについて</h2>
            <p className="leading-relaxed">
              当サイトはDUGA、MGS、SOKMIL、DTIのアフィリエイトプログラムに参加しています。
              これらのサービスでは、ユーザーの行動を追跡するためにCookieを使用する場合があります。
              詳細については、各サービスのプライバシーポリシーをご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. 免責事項</h2>
            <p className="leading-relaxed">
              当サイトに掲載されている情報の正確性については万全を期しておりますが、
              利用者が当サイトの情報を用いて行う一切の行為について、
              当サイトは責任を負いかねます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. プライバシーポリシーの変更</h2>
            <p className="leading-relaxed">
              当サイトは、本プライバシーポリシーの内容を適宜見直し、
              改善・変更することがあります。
              変更後のプライバシーポリシーは、本ページに掲載した時点で効力を生じるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. お問い合わせ</h2>
            <p className="leading-relaxed">
              本プライバシーポリシーに関するお問い合わせは、以下のメールアドレスまでお願いいたします。
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
              最終更新日: 2025年12月12日
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
