import { Metadata } from 'next';

// 多言語メタデータ
const metaTranslations = {
  ja: {
    title: 'プライバシーポリシー | ADULT VIEWER LAB',
    description: 'ADULT VIEWER LABのプライバシーポリシーページです。',
  },
  en: {
    title: 'Privacy Policy | ADULT VIEWER LAB',
    description: 'Privacy Policy for ADULT VIEWER LAB.',
  },
  zh: {
    title: '隐私政策 | ADULT VIEWER LAB',
    description: 'ADULT VIEWER LAB的隐私政策页面。',
  },
  ko: {
    title: '개인정보 처리방침 | ADULT VIEWER LAB',
    description: 'ADULT VIEWER LAB의 개인정보 처리방침 페이지입니다.',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';
  const meta = metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;

  // hreflang/canonical設定（?hl=形式）
  const alternates = {
    canonical: `${baseUrl}/privacy`,
    languages: {
      ja: `${baseUrl}/privacy`,
      en: `${baseUrl}/privacy?hl=en`,
      zh: `${baseUrl}/privacy?hl=zh`,
      'zh-TW': `${baseUrl}/privacy?hl=zh-TW`,
      ko: `${baseUrl}/privacy?hl=ko`,
      'x-default': `${baseUrl}/privacy`,
    },
  };

  return {
    title: meta.title,
    description: meta.description,
    alternates,
  };
}

// コンテンツ翻訳
const contentTranslations = {
  ja: {
    title: 'プライバシーポリシー',
    section1Title: '1. 個人情報の取得について',
    section1Text:
      '当サイトでは、ユーザーの個人情報を取得することはありません。お問い合わせの際にメールアドレスを使用いただく場合がありますが、それ以外の個人情報を収集することはありません。',
    section2Title: '2. Cookieの使用について',
    section2Text:
      '当サイトでは、ユーザー体験の向上のためにCookieを使用しています。Cookieは年齢確認やお気に入り機能などのサイト機能に使用されます。ブラウザの設定でCookieを無効にすることも可能ですが、一部の機能が正常に動作しない場合があります。',
    section3Title: '3. アクセス解析ツールについて',
    section3Text1:
      '当サイトでは、サイトの利用状況を把握するため、Google Analytics 4（GA4）を使用しています。GA4はCookieを使用してユーザーの行動を匿名で収集します。',
    section3Text2:
      '収集される情報には、訪問したページ、滞在時間、使用デバイス、おおよその地域などが含まれますが、個人を特定できる情報は含まれません。また、IPアドレスは匿名化されています。',
    section3Text3:
      '当サイトでは、GDPR/CCPAに準拠するため、Cookie同意バナーを表示しています。ユーザーが「同意する」を選択した場合のみ、GA4が有効になります。「拒否する」を選択した場合、GA4のトラッキングは行われません。',
    section3Link: 'Googleのプライバシーポリシー',
    section4Title: '4. アフィリエイトプログラムについて',
    section4Text:
      '当サイトはDUGA、MGS、SOKMIL、DTIのアフィリエイトプログラムに参加しています。これらのサービスでは、ユーザーの行動を追跡するためにCookieを使用する場合があります。詳細については、各サービスのプライバシーポリシーをご確認ください。',
    section5Title: '5. 免責事項',
    section5Text:
      '当サイトに掲載されている情報の正確性については万全を期しておりますが、利用者が当サイトの情報を用いて行う一切の行為について、当サイトは責任を負いかねます。',
    section6Title: '6. プライバシーポリシーの変更',
    section6Text:
      '当サイトは、本プライバシーポリシーの内容を適宜見直し、改善・変更することがあります。変更後のプライバシーポリシーは、本ページに掲載した時点で効力を生じるものとします。',
    section7Title: '7. お問い合わせ',
    section7Text: '本プライバシーポリシーに関するお問い合わせは、以下のメールアドレスまでお願いいたします。',
    lastUpdated: '最終更新日: 2025年12月12日',
  },
  en: {
    title: 'Privacy Policy',
    section1Title: '1. Collection of Personal Information',
    section1Text:
      'This site does not collect personal information from users. You may use your email address when contacting us, but we do not collect any other personal information.',
    section2Title: '2. Use of Cookies',
    section2Text:
      'This site uses cookies to improve user experience. Cookies are used for site functions such as age verification and favorites. You can disable cookies in your browser settings, but some features may not work properly.',
    section3Title: '3. Analytics Tools',
    section3Text1:
      'This site uses Google Analytics 4 (GA4) to understand site usage. GA4 uses cookies to anonymously collect user behavior.',
    section3Text2:
      'Information collected includes pages visited, time spent, device used, and approximate location, but does not include personally identifiable information. IP addresses are also anonymized.',
    section3Text3:
      'To comply with GDPR/CCPA, this site displays a cookie consent banner. GA4 is only enabled when users select "Accept". If "Decline" is selected, GA4 tracking will not occur.',
    section3Link: 'Google Privacy Policy',
    section4Title: '4. Affiliate Programs',
    section4Text:
      "This site participates in affiliate programs of DUGA, MGS, SOKMIL, and DTI. These services may use cookies to track user behavior. Please refer to each service's privacy policy for details.",
    section5Title: '5. Disclaimer',
    section5Text:
      'While we strive for accuracy in the information posted on this site, we are not responsible for any actions taken by users based on this information.',
    section6Title: '6. Changes to Privacy Policy',
    section6Text:
      'This site may review and modify this Privacy Policy from time to time. Any changes will take effect when posted on this page.',
    section7Title: '7. Contact',
    section7Text: 'For inquiries regarding this Privacy Policy, please contact us at the following email address.',
    lastUpdated: 'Last Updated: December 12, 2025',
  },
  zh: {
    title: '隐私政策',
    section1Title: '1. 个人信息收集',
    section1Text: '本网站不收集用户的个人信息。联系我们时可能需要使用电子邮件地址，但我们不收集其他个人信息。',
    section2Title: '2. Cookie使用',
    section2Text:
      '本网站使用Cookie来改善用户体验。Cookie用于年龄验证和收藏功能等网站功能。您可以在浏览器设置中禁用Cookie，但某些功能可能无法正常工作。',
    section3Title: '3. 分析工具',
    section3Text1: '本网站使用Google Analytics 4（GA4）来了解网站使用情况。GA4使用Cookie匿名收集用户行为。',
    section3Text2:
      '收集的信息包括访问的页面、停留时间、使用的设备和大致位置，但不包括可识别个人身份的信息。IP地址也被匿名化。',
    section3Text3:
      '为符合GDPR/CCPA规定，本网站显示Cookie同意横幅。只有当用户选择"接受"时，GA4才会启用。如果选择"拒绝"，则不会进行GA4跟踪。',
    section3Link: 'Google隐私政策',
    section4Title: '4. 联盟营销计划',
    section4Text:
      '本网站参与DUGA、MGS、SOKMIL和DTI的联盟营销计划。这些服务可能使用Cookie来跟踪用户行为。详情请参阅各服务的隐私政策。',
    section5Title: '5. 免责声明',
    section5Text: '虽然我们努力确保本网站发布信息的准确性，但我们不对用户基于此信息采取的任何行动负责。',
    section6Title: '6. 隐私政策变更',
    section6Text: '本网站可能会不时审查和修改本隐私政策。任何更改将在本页面发布时生效。',
    section7Title: '7. 联系方式',
    section7Text: '有关本隐私政策的咨询，请通过以下电子邮件地址与我们联系。',
    lastUpdated: '最后更新：2025年12月12日',
  },
  ko: {
    title: '개인정보 처리방침',
    section1Title: '1. 개인정보 수집',
    section1Text:
      '본 사이트는 사용자의 개인정보를 수집하지 않습니다. 문의 시 이메일 주소를 사용하실 수 있으나, 그 외의 개인정보는 수집하지 않습니다.',
    section2Title: '2. 쿠키 사용',
    section2Text:
      '본 사이트는 사용자 경험 향상을 위해 쿠키를 사용합니다. 쿠키는 연령 확인 및 즐겨찾기 기능 등 사이트 기능에 사용됩니다. 브라우저 설정에서 쿠키를 비활성화할 수 있지만, 일부 기능이 정상적으로 작동하지 않을 수 있습니다.',
    section3Title: '3. 분석 도구',
    section3Text1:
      '본 사이트는 사이트 이용 현황을 파악하기 위해 Google Analytics 4(GA4)를 사용합니다. GA4는 쿠키를 사용하여 익명으로 사용자 행동을 수집합니다.',
    section3Text2:
      '수집되는 정보에는 방문한 페이지, 체류 시간, 사용 기기, 대략적인 위치 등이 포함되지만, 개인을 식별할 수 있는 정보는 포함되지 않습니다. IP 주소도 익명화됩니다.',
    section3Text3:
      'GDPR/CCPA를 준수하기 위해 본 사이트는 쿠키 동의 배너를 표시합니다. 사용자가 "동의"를 선택한 경우에만 GA4가 활성화됩니다. "거부"를 선택하면 GA4 추적이 수행되지 않습니다.',
    section3Link: 'Google 개인정보 처리방침',
    section4Title: '4. 제휴 프로그램',
    section4Text:
      '본 사이트는 DUGA, MGS, SOKMIL, DTI의 제휴 프로그램에 참여하고 있습니다. 이러한 서비스는 사용자 행동을 추적하기 위해 쿠키를 사용할 수 있습니다. 자세한 내용은 각 서비스의 개인정보 처리방침을 참조하세요.',
    section5Title: '5. 면책 조항',
    section5Text:
      '본 사이트에 게시된 정보의 정확성을 위해 노력하고 있으나, 사용자가 이 정보를 기반으로 취하는 모든 행동에 대해 책임을 지지 않습니다.',
    section6Title: '6. 개인정보 처리방침 변경',
    section6Text:
      '본 사이트는 수시로 본 개인정보 처리방침을 검토하고 수정할 수 있습니다. 변경 사항은 이 페이지에 게시될 때 효력이 발생합니다.',
    section7Title: '7. 문의',
    section7Text: '본 개인정보 처리방침에 관한 문의는 아래 이메일 주소로 연락해 주세요.',
    lastUpdated: '최종 업데이트: 2025년 12월 12일',
  },
} as const;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const t = contentTranslations[locale as keyof typeof contentTranslations] || contentTranslations.ja;

  return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="container mx-auto max-w-4xl px-4">
        <h1 className="mb-8 text-3xl font-bold text-white">{t.title}</h1>

        <div className="space-y-6 rounded-lg bg-white/5 p-6 text-gray-300 ring-1 ring-white/10 md:p-8">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">{t.section1Title}</h2>
            <p className="leading-relaxed">{t.section1Text}</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">{t.section2Title}</h2>
            <p className="leading-relaxed">{t.section2Text}</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">{t.section3Title}</h2>
            <p className="leading-relaxed">{t.section3Text1}</p>
            <p className="mt-2 leading-relaxed">{t.section3Text2}</p>
            <p className="mt-2 leading-relaxed">{t.section3Text3}</p>
            <p className="mt-2 leading-relaxed">
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-400 underline hover:text-fuchsia-300"
              >
                {t.section3Link}
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">{t.section4Title}</h2>
            <p className="leading-relaxed">{t.section4Text}</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">{t.section5Title}</h2>
            <p className="leading-relaxed">{t.section5Text}</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">{t.section6Title}</h2>
            <p className="leading-relaxed">{t.section6Text}</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">{t.section7Title}</h2>
            <p className="leading-relaxed">{t.section7Text}</p>
            <p className="mt-2">
              <a
                href="mailto:adult.vvvv@gmail.com"
                className="text-fuchsia-400 transition-colors hover:text-fuchsia-300"
              >
                adult.vvvv@gmail.com
              </a>
            </p>
          </section>

          <div className="border-t border-gray-700 pt-6">
            <p className="text-sm text-gray-400">{t.lastUpdated}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
