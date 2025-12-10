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
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-8">プライバシーポリシー</h1>

        <div className="bg-gray-800 rounded-lg p-6 md:p-8 space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. 個人情報の取得について</h2>
            <p className="leading-relaxed">
              当サイトでは、ユーザーの個人情報を取得することはありません。
              お問い合わせの際にメールアドレスを使用いただく場合がありますが、
              それ以外の個人情報を収集することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Cookieの使用について</h2>
            <p className="leading-relaxed">
              当サイトでは、ユーザー体験の向上のためにCookieを使用しています。
              Cookieは年齢確認やお気に入り機能などのサイト機能に使用されます。
              ブラウザの設定でCookieを無効にすることも可能ですが、
              一部の機能が正常に動作しない場合があります。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. アクセス解析ツールについて</h2>
            <p className="leading-relaxed">
              当サイトでは、サイトの利用状況を把握するため、
              アクセス解析ツールを使用する場合があります。
              これらのツールは匿名の情報のみを収集し、
              個人を特定できる情報は含まれません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. アフィリエイトプログラムについて</h2>
            <p className="leading-relaxed">
              当サイトはDUGA、MGS、SOKMIL、DTIのアフィリエイトプログラムに参加しています。
              これらのサービスでは、ユーザーの行動を追跡するためにCookieを使用する場合があります。
              詳細については、各サービスのプライバシーポリシーをご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. 免責事項</h2>
            <p className="leading-relaxed">
              当サイトに掲載されている情報の正確性については万全を期しておりますが、
              利用者が当サイトの情報を用いて行う一切の行為について、
              当サイトは責任を負いかねます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. プライバシーポリシーの変更</h2>
            <p className="leading-relaxed">
              当サイトは、本プライバシーポリシーの内容を適宜見直し、
              改善・変更することがあります。
              変更後のプライバシーポリシーは、本ページに掲載した時点で効力を生じるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. お問い合わせ</h2>
            <p className="leading-relaxed">
              本プライバシーポリシーに関するお問い合わせは、以下のメールアドレスまでお願いいたします。
            </p>
            <p className="mt-2">
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
              最終更新日: 2024年12月9日
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
