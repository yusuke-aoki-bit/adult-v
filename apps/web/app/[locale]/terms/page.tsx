import { Metadata } from 'next';

// 多言語メタデータ
const metaTranslations = {
  ja: {
    title: '利用規約 | ADULT VIEWER LAB',
    description: 'ADULT VIEWER LABの利用規約ページです。',
  },
  en: {
    title: 'Terms of Service | ADULT VIEWER LAB',
    description: 'Terms of Service for ADULT VIEWER LAB.',
  },
  zh: {
    title: '使用条款 | ADULT VIEWER LAB',
    description: 'ADULT VIEWER LAB的使用条款页面。',
  },
  ko: {
    title: '이용약관 | ADULT VIEWER LAB',
    description: 'ADULT VIEWER LAB의 이용약관 페이지입니다.',
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
  const meta = metaTranslations[locale as keyof typeof metaTranslations] || metaTranslations.ja;

  // hreflang/canonical設定（?hl=形式）
  const alternates = {
    canonical: `${baseUrl}/terms`,
    languages: {
      'ja': `${baseUrl}/terms`,
      'en': `${baseUrl}/terms?hl=en`,
      'zh': `${baseUrl}/terms?hl=zh`,
      'zh-TW': `${baseUrl}/terms?hl=zh-TW`,
      'ko': `${baseUrl}/terms?hl=ko`,
      'x-default': `${baseUrl}/terms`,
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
    title: '利用規約',
    section1Title: '1. 適用範囲',
    section1Text: '本利用規約（以下「本規約」）は、ADULT VIEWER LAB（以下「当サイト」）が提供するサービスの利用に関する条件を定めるものです。当サイトをご利用いただくことで、本規約に同意したものとみなされます。',
    section2Title: '2. 年齢制限',
    section2Text: '当サイトは18歳未満の方の利用を禁止しています。18歳未満の方が当サイトを利用することによって生じた損害について、当サイトは一切の責任を負いません。',
    section3Title: '3. サービス内容',
    section3Text: '当サイトは、複数のアダルトコンテンツプラットフォームの情報を整理し、ユーザーに提供するサービスです。当サイトは情報提供のみを目的としており、コンテンツの販売や配信は行っておりません。',
    section4Title: '4. アフィリエイトについて',
    section4Text: '当サイトは複数のアフィリエイトプログラムに参加しており、商品リンクから購入された場合、当サイトに紹介料が発生することがあります。ただし、アフィリエイトリンクの使用によって、ユーザーに追加料金が発生することはありません。',
    section5Title: '5. 著作権・知的財産権',
    section5Text: '当サイトに掲載されているコンテンツ（テキスト、画像、デザインなど）の著作権は、当サイトまたは各権利者に帰属します。商品画像、女優写真などは各プラットフォームから提供されたものであり、それらの著作権は各権利者に帰属します。',
    section6Title: '6. 著作権侵害の申告（DMCA）',
    section6Text: '当サイトは著作権を尊重しており、デジタルミレニアム著作権法（DMCA）に基づく著作権侵害の申告に対応いたします。',
    section6List: [
      '著作権者または代理人の署名（電子署名可）',
      '侵害されたと主張する著作物の特定',
      '侵害コンテンツの場所（URL）',
      '連絡先情報（住所、電話番号、メールアドレス）',
      '善意に基づき、当該使用が著作権者により許可されていないと信じる旨の声明',
      '偽証罪の制裁のもと、申告内容が正確であることの声明',
    ],
    section7Title: '7. 禁止事項',
    section7Text: 'ユーザーは、以下の行為を行ってはなりません:',
    section7List: [
      '法令または公序良俗に違反する行為',
      '犯罪行為に関連する行為',
      '当サイトのサーバーやネットワークの機能を破壊したり、妨害したりする行為',
      '当サイトのサービスの運営を妨害する行為',
      '他のユーザーに関する個人情報等を収集または蓄積する行為',
      '不正アクセス行為',
      '当サイトのコンテンツを無断で複製、転載、配布する行為',
      'その他、当サイトが不適切と判断する行為',
    ],
    section8Title: '8. 免責事項',
    section8Text: '当サイトは、提供する情報の正確性、完全性、有用性について保証するものではありません。当サイトの利用により生じた損害について、当サイトは一切の責任を負いません。また、当サイトは外部サイトへのリンクを含んでいますが、リンク先のサイトの内容については責任を負いません。',
    section9Title: '9. サービスの変更・中断・終了',
    section9Text: '当サイトは、ユーザーへの事前の通知なく、サービスの内容を変更、中断、または終了することができるものとします。これによりユーザーに生じた損害について、当サイトは一切の責任を負いません。',
    section10Title: '10. 利用規約の変更',
    section10Text: '当サイトは、必要に応じて本規約を変更することができるものとします。変更後の規約は、本ページに掲載した時点で効力を生じるものとします。',
    section11Title: '11. 準拠法・裁判管轄',
    section11Text: '本規約の解釈にあたっては、日本法を準拠法とします。当サイトに関して紛争が生じた場合には、当サイト運営者の所在地を管轄する裁判所を専属的合意管轄とします。',
    section12Title: '12. お問い合わせ',
    section12Text: '本規約に関するお問い合わせは、以下のメールアドレスまでお願いいたします。',
    lastUpdated: '最終更新日: 2024年12月9日',
  },
  en: {
    title: 'Terms of Service',
    section1Title: '1. Scope of Application',
    section1Text: 'These Terms of Service (hereinafter "Terms") set forth the conditions for using the services provided by ADULT VIEWER LAB (hereinafter "this Site"). By using this Site, you are deemed to have agreed to these Terms.',
    section2Title: '2. Age Restriction',
    section2Text: 'This Site prohibits use by persons under 18 years of age. This Site assumes no responsibility for any damages arising from use of this Site by persons under 18.',
    section3Title: '3. Service Description',
    section3Text: 'This Site is a service that organizes and provides information from multiple adult content platforms. This Site is intended for information provision only and does not sell or distribute content.',
    section4Title: '4. Affiliate Programs',
    section4Text: 'This Site participates in multiple affiliate programs. When purchases are made through product links, this Site may receive referral fees. However, using affiliate links does not result in additional charges to users.',
    section5Title: '5. Copyright and Intellectual Property',
    section5Text: 'Copyright for content on this Site (text, images, design, etc.) belongs to this Site or respective rights holders. Product images and performer photos are provided by each platform, and their copyrights belong to respective rights holders.',
    section6Title: '6. Copyright Infringement Claims (DMCA)',
    section6Text: 'This Site respects copyright and responds to copyright infringement claims under the Digital Millennium Copyright Act (DMCA).',
    section6List: [
      'Signature of copyright owner or authorized agent (electronic signature acceptable)',
      'Identification of copyrighted work claimed to be infringed',
      'Location of infringing content (URL)',
      'Contact information (address, phone number, email)',
      'Statement of good faith belief that use is not authorized',
      'Statement under penalty of perjury that information is accurate',
    ],
    section7Title: '7. Prohibited Activities',
    section7Text: 'Users must not engage in the following activities:',
    section7List: [
      'Activities that violate laws or public order and morals',
      'Activities related to criminal acts',
      'Activities that destroy or interfere with server or network functions',
      'Activities that interfere with service operations',
      'Collection or accumulation of personal information of other users',
      'Unauthorized access',
      'Unauthorized reproduction, reprinting, or distribution of content',
      'Other activities deemed inappropriate by this Site',
    ],
    section8Title: '8. Disclaimer',
    section8Text: 'This Site does not guarantee the accuracy, completeness, or usefulness of provided information. This Site assumes no responsibility for damages arising from use of this Site. This Site includes links to external sites but is not responsible for their content.',
    section9Title: '9. Service Changes, Suspension, Termination',
    section9Text: 'This Site may change, suspend, or terminate services without prior notice to users. This Site assumes no responsibility for damages arising from such changes.',
    section10Title: '10. Changes to Terms',
    section10Text: 'This Site may change these Terms as necessary. Changed Terms take effect when posted on this page.',
    section11Title: '11. Governing Law and Jurisdiction',
    section11Text: 'These Terms shall be interpreted under Japanese law. Any disputes related to this Site shall be subject to the exclusive jurisdiction of the court having jurisdiction over the location of this Site\'s operator.',
    section12Title: '12. Contact',
    section12Text: 'For inquiries regarding these Terms, please contact us at the following email address.',
    lastUpdated: 'Last Updated: December 9, 2024',
  },
  zh: {
    title: '使用条款',
    section1Title: '1. 适用范围',
    section1Text: '本使用条款（以下简称"条款"）规定了使用ADULT VIEWER LAB（以下简称"本网站"）提供的服务的条件。使用本网站即表示您同意本条款。',
    section2Title: '2. 年龄限制',
    section2Text: '本网站禁止18岁以下人员使用。对于18岁以下人员使用本网站造成的任何损害，本网站不承担任何责任。',
    section3Title: '3. 服务内容',
    section3Text: '本网站是一项整理并向用户提供多个成人内容平台信息的服务。本网站仅用于提供信息，不销售或分发内容。',
    section4Title: '4. 联盟营销',
    section4Text: '本网站参与多个联盟营销计划。通过产品链接购买时，本网站可能会收到推荐费。但是，使用联盟链接不会向用户收取额外费用。',
    section5Title: '5. 版权和知识产权',
    section5Text: '本网站内容（文字、图片、设计等）的版权归本网站或各权利人所有。产品图片和演员照片由各平台提供，其版权归各权利人所有。',
    section6Title: '6. 版权侵权申诉（DMCA）',
    section6Text: '本网站尊重版权，并根据数字千年版权法（DMCA）处理版权侵权申诉。',
    section6List: [
      '版权所有者或授权代理人的签名（可接受电子签名）',
      '被侵权作品的识别',
      '侵权内容的位置（URL）',
      '联系信息（地址、电话、电子邮件）',
      '善意声明，相信该使用未经授权',
      '伪证处罚下信息准确的声明',
    ],
    section7Title: '7. 禁止行为',
    section7Text: '用户不得从事以下行为：',
    section7List: [
      '违反法律或公序良俗的行为',
      '与犯罪行为相关的行为',
      '破坏或干扰服务器或网络功能的行为',
      '干扰服务运营的行为',
      '收集或积累其他用户个人信息的行为',
      '非法访问',
      '未经授权复制、转载或分发内容的行为',
      '本网站认为不当的其他行为',
    ],
    section8Title: '8. 免责声明',
    section8Text: '本网站不保证所提供信息的准确性、完整性或有用性。本网站对因使用本网站而产生的损害不承担任何责任。本网站包含外部网站的链接，但不对其内容负责。',
    section9Title: '9. 服务变更、暂停、终止',
    section9Text: '本网站可能在不事先通知用户的情况下变更、暂停或终止服务。本网站对由此产生的损害不承担任何责任。',
    section10Title: '10. 条款变更',
    section10Text: '本网站可根据需要变更本条款。变更后的条款在本页面发布时生效。',
    section11Title: '11. 准据法和管辖权',
    section11Text: '本条款应根据日本法律解释。与本网站相关的任何争议应由本网站运营者所在地的法院专属管辖。',
    section12Title: '12. 联系方式',
    section12Text: '有关本条款的咨询，请通过以下电子邮件地址与我们联系。',
    lastUpdated: '最后更新：2024年12月9日',
  },
  ko: {
    title: '이용약관',
    section1Title: '1. 적용 범위',
    section1Text: '본 이용약관(이하 "약관")은 ADULT VIEWER LAB(이하 "본 사이트")이 제공하는 서비스 이용에 관한 조건을 정합니다. 본 사이트를 이용함으로써 본 약관에 동의한 것으로 간주됩니다.',
    section2Title: '2. 연령 제한',
    section2Text: '본 사이트는 18세 미만의 이용을 금지합니다. 18세 미만이 본 사이트를 이용하여 발생한 손해에 대해 본 사이트는 어떠한 책임도 지지 않습니다.',
    section3Title: '3. 서비스 내용',
    section3Text: '본 사이트는 여러 성인 콘텐츠 플랫폼의 정보를 정리하여 사용자에게 제공하는 서비스입니다. 본 사이트는 정보 제공만을 목적으로 하며, 콘텐츠 판매나 배포는 하지 않습니다.',
    section4Title: '4. 제휴 프로그램',
    section4Text: '본 사이트는 여러 제휴 프로그램에 참여하고 있으며, 상품 링크를 통해 구매할 경우 본 사이트에 소개료가 발생할 수 있습니다. 단, 제휴 링크 사용으로 인해 사용자에게 추가 비용이 발생하지는 않습니다.',
    section5Title: '5. 저작권 및 지적재산권',
    section5Text: '본 사이트에 게재된 콘텐츠(텍스트, 이미지, 디자인 등)의 저작권은 본 사이트 또는 각 권리자에게 귀속됩니다. 상품 이미지, 배우 사진 등은 각 플랫폼에서 제공한 것이며, 그 저작권은 각 권리자에게 귀속됩니다.',
    section6Title: '6. 저작권 침해 신고(DMCA)',
    section6Text: '본 사이트는 저작권을 존중하며, 디지털 밀레니엄 저작권법(DMCA)에 따른 저작권 침해 신고에 대응합니다.',
    section6List: [
      '저작권자 또는 대리인의 서명(전자 서명 가능)',
      '침해되었다고 주장하는 저작물의 특정',
      '침해 콘텐츠의 위치(URL)',
      '연락처 정보(주소, 전화번호, 이메일)',
      '해당 사용이 저작권자에 의해 허가되지 않았다고 믿는다는 선의의 진술',
      '위증 처벌 하에 정보가 정확하다는 진술',
    ],
    section7Title: '7. 금지 사항',
    section7Text: '사용자는 다음 행위를 해서는 안 됩니다:',
    section7List: [
      '법령 또는 공서양속에 위반하는 행위',
      '범죄 행위에 관련된 행위',
      '서버나 네트워크 기능을 파괴하거나 방해하는 행위',
      '서비스 운영을 방해하는 행위',
      '다른 사용자의 개인정보 등을 수집 또는 축적하는 행위',
      '부정 접근',
      '무단으로 콘텐츠를 복제, 전재, 배포하는 행위',
      '기타 본 사이트가 부적절하다고 판단하는 행위',
    ],
    section8Title: '8. 면책 조항',
    section8Text: '본 사이트는 제공하는 정보의 정확성, 완전성, 유용성에 대해 보증하지 않습니다. 본 사이트 이용으로 인해 발생한 손해에 대해 본 사이트는 어떠한 책임도 지지 않습니다. 또한 본 사이트는 외부 사이트로의 링크를 포함하고 있지만, 링크된 사이트의 내용에 대해서는 책임을 지지 않습니다.',
    section9Title: '9. 서비스 변경, 중단, 종료',
    section9Text: '본 사이트는 사용자에게 사전 통지 없이 서비스 내용을 변경, 중단 또는 종료할 수 있습니다. 이로 인해 사용자에게 발생한 손해에 대해 본 사이트는 어떠한 책임도 지지 않습니다.',
    section10Title: '10. 약관 변경',
    section10Text: '본 사이트는 필요에 따라 본 약관을 변경할 수 있습니다. 변경된 약관은 본 페이지에 게시된 시점에 효력이 발생합니다.',
    section11Title: '11. 준거법 및 관할권',
    section11Text: '본 약관은 일본법에 따라 해석됩니다. 본 사이트에 관한 분쟁이 발생한 경우, 본 사이트 운영자의 소재지를 관할하는 법원을 전속적 합의관할로 합니다.',
    section12Title: '12. 문의',
    section12Text: '본 약관에 관한 문의는 아래 이메일 주소로 연락해 주세요.',
    lastUpdated: '최종 업데이트: 2024년 12월 9일',
  },
} as const;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = contentTranslations[locale as keyof typeof contentTranslations] || contentTranslations.ja;

  return (
    <div className="min-h-screen theme-body py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-8">{t.title}</h1>

        <div className="bg-gray-800 rounded-lg p-6 md:p-8 space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section1Title}</h2>
            <p className="leading-relaxed">{t.section1Text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section2Title}</h2>
            <p className="leading-relaxed">{t.section2Text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section3Title}</h2>
            <p className="leading-relaxed">{t.section3Text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section4Title}</h2>
            <p className="leading-relaxed">{t.section4Text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section5Title}</h2>
            <p className="leading-relaxed">{t.section5Text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section6Title}</h2>
            <p className="leading-relaxed mb-3">{t.section6Text}</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              {t.section6List.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <p className="leading-relaxed mt-3">
              DMCA: <a href="mailto:adult.vvvv@gmail.com" className="text-rose-400 hover:text-rose-300 transition-colors">adult.vvvv@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section7Title}</h2>
            <p className="leading-relaxed mb-3">{t.section7Text}</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              {t.section7List.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section8Title}</h2>
            <p className="leading-relaxed">{t.section8Text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section9Title}</h2>
            <p className="leading-relaxed">{t.section9Text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section10Title}</h2>
            <p className="leading-relaxed">{t.section10Text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section11Title}</h2>
            <p className="leading-relaxed">{t.section11Text}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">{t.section12Title}</h2>
            <p className="leading-relaxed">{t.section12Text}</p>
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
            <p className="text-sm text-gray-400">{t.lastUpdated}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
